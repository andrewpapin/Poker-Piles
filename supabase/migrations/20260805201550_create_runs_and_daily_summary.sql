-- Anonymous daily score collection for Poker Piles.
--
-- There are no accounts, so a run is attributed to a random client id the
-- browser generates once and keeps in localStorage. One row per client per
-- UTC day: the first finished run of the day is the one that counts, and
-- replays are dropped by the unique constraint rather than by the client.

create table public.runs (
  id bigint generated always as identity primary key,
  -- Set server-side from the UTC clock, never from the request body, so a
  -- forged payload cannot backfill or pre-fill another day's average.
  date_key date not null,
  client_id uuid not null,
  score integer not null,
  hands smallint not null,
  gave_up boolean not null,
  created_at timestamptz not null default now(),
  -- 56 cards is at most 12 hands; 11 royal flushes plus change is ~2300, so
  -- 5000 is a generous sanity bound rather than a tight one.
  constraint runs_score_range check (score >= 0 and score <= 5000),
  constraint runs_hands_range check (hands >= 0 and hands <= 56),
  constraint runs_one_per_client_per_day unique (date_key, client_id)
);

-- RLS on with deliberately no policies: the anon key can never touch this
-- table directly, only through the two security-definer functions below.
-- That keeps raw rows (and client ids) unreadable while still letting the
-- static site publish a score and read back an aggregate. Supabase's linter
-- flags this pattern ("RLS enabled, no policy" and "public can execute
-- SECURITY DEFINER function") — both are the design working, not findings.
alter table public.runs enable row level security;
revoke all on table public.runs from anon, authenticated;

create function public.daily_summary(p_date date default null)
returns table (average numeric, plays bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    round(coalesce(avg(score), 0), 1)::numeric,
    count(*)::bigint
  from public.runs
  where date_key = coalesce(p_date, (now() at time zone 'utc')::date);
$$;

create function public.submit_run(
  p_client_id uuid,
  p_score integer,
  p_hands integer,
  p_gave_up boolean
)
returns table (average numeric, plays bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  if p_score is null or p_score < 0 or p_score > 5000 then
    raise exception 'score out of range';
  end if;

  insert into public.runs (date_key, client_id, score, hands, gave_up)
  values (
    v_today,
    p_client_id,
    p_score,
    least(greatest(coalesce(p_hands, 0), 0), 56),
    coalesce(p_gave_up, false)
  )
  on conflict on constraint runs_one_per_client_per_day do nothing;

  -- Always hand back the current aggregate, whether or not this run counted,
  -- so a replay still gets something to show without a second round trip.
  return query select * from public.daily_summary(v_today);
end;
$$;

revoke all on function public.daily_summary(date) from public;
revoke all on function public.submit_run(uuid, integer, integer, boolean) from public;
grant execute on function public.daily_summary(date) to anon, authenticated;
grant execute on function public.submit_run(uuid, integer, integer, boolean) to anon, authenticated;
