import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientId, fetchDailySummary, submitRun } from './scores';

const CLIENT_ID_KEY = 'pokerpiles:clientId';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same Map-backed Storage stub as storage.test.ts, with per-method overrides
 * for the Safari-private-mode paths where a real localStorage throws. */
function makeFakeStorage(overrides: Partial<Storage> = {}): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    ...overrides,
  };
}

/** Stubs fetch with a single JSON response, and hands back the mock to inspect. */
function stubFetch(body: unknown, init: { ok?: boolean } = {}) {
  const mock = vi.fn(async () => ({
    ok: init.ok ?? true,
    json: async () => body,
  }));
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/** The parsed JSON body of the nth fetch call. */
function sentBody(mock: ReturnType<typeof stubFetch>, call = 0) {
  return JSON.parse((mock.mock.calls[call] as unknown as [string, RequestInit])[1].body as string);
}

beforeEach(() => {
  globalThis.localStorage = makeFakeStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('clientId', () => {
  it('mints a uuid and reuses it', () => {
    const first = clientId();
    expect(first).toMatch(UUID_RE);
    expect(clientId()).toBe(first);
    expect(localStorage.getItem(CLIENT_ID_KEY)).toBe(first);
  });

  it('replaces a malformed stored id rather than sending it', () => {
    localStorage.setItem(CLIENT_ID_KEY, 'not-a-uuid');
    expect(clientId()).toMatch(UUID_RE);
  });

  it('still returns an id when storage throws on write', () => {
    globalThis.localStorage = makeFakeStorage({
      setItem: () => {
        throw new Error('private mode');
      },
    });
    expect(clientId()).toMatch(UUID_RE);
  });

  it('still returns an id when storage throws on read', () => {
    globalThis.localStorage = makeFakeStorage({
      getItem: () => {
        throw new Error('private mode');
      },
    });
    expect(clientId()).toMatch(UUID_RE);
  });
});

describe('submitRun', () => {
  it('posts the run and parses the summary back', async () => {
    const mock = stubFetch([{ average: 128.4, plays: 37 }]);
    await expect(submitRun({ score: 150, hands: 12, gaveUp: false })).resolves.toEqual({
      average: 128.4,
      plays: 37,
    });

    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/submit_run$/);
    expect(init.method).toBe('POST');
    expect(sentBody(mock)).toMatchObject({ p_score: 150, p_hands: 12, p_gave_up: false });
    expect(sentBody(mock).p_client_id).toMatch(UUID_RE);
  });

  // PostgREST may render `numeric` as a JSON string; the display path divides
  // and rounds against it, so a string would silently produce NaN.
  it('coerces numeric fields that arrive as strings', async () => {
    stubFetch([{ average: '90.0', plays: '2' }]);
    await expect(submitRun({ score: 60, hands: 8, gaveUp: true })).resolves.toEqual({
      average: 90,
      plays: 2,
    });
  });

  it('sends the date nowhere — the server stamps it', async () => {
    const mock = stubFetch([{ average: 10, plays: 1 }]);
    await submitRun({ score: 10, hands: 1, gaveUp: false });
    expect(Object.keys(sentBody(mock)).sort()).toEqual([
      'p_client_id',
      'p_gave_up',
      'p_hands',
      'p_score',
    ]);
  });

  // Every failure mode collapses to null, because the results sheet has to
  // render regardless of whether the network answered.
  it('resolves null on a non-ok response', async () => {
    stubFetch({ message: 'nope' }, { ok: false });
    await expect(submitRun({ score: 10, hands: 1, gaveUp: false })).resolves.toBeNull();
  });

  it('resolves null when fetch rejects', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(submitRun({ score: 10, hands: 1, gaveUp: false })).resolves.toBeNull();
  });

  it('resolves null on a malformed payload', async () => {
    stubFetch([{ average: 'not a number', plays: 3 }]);
    await expect(submitRun({ score: 10, hands: 1, gaveUp: false })).resolves.toBeNull();
  });

  it('resolves null on an empty result set', async () => {
    stubFetch([]);
    await expect(submitRun({ score: 10, hands: 1, gaveUp: false })).resolves.toBeNull();
  });

  it('refuses to send a nonsensical score', async () => {
    const mock = stubFetch([{ average: 10, plays: 1 }]);
    await expect(submitRun({ score: -5, hands: 1, gaveUp: false })).resolves.toBeNull();
    await expect(submitRun({ score: NaN, hands: 1, gaveUp: false })).resolves.toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('fetchDailySummary', () => {
  it('reads the average without posting a run', async () => {
    const mock = stubFetch([{ average: 77.5, plays: 4 }]);
    await expect(fetchDailySummary()).resolves.toEqual({ average: 77.5, plays: 4 });
    expect((mock.mock.calls[0] as unknown as [string])[0]).toMatch(/\/rpc\/daily_summary$/);
    expect(sentBody(mock)).toEqual({});
  });
});
