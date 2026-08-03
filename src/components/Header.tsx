import { formatPuzzleDate } from '../game/share';

type Props = {
  dateKey: string;
  total: number;
  handsPlayed: number;
  cardsLeft: number;
  onNewGame: () => void;
  onHelp: () => void;
};

export function Header({ dateKey, total, handsPlayed, cardsLeft, onNewGame, onHelp }: Props) {
  return (
    <header className="header">
      <div className="header-row">
        <h1 className="header-title">
          Poker Piles <span className="header-date">{formatPuzzleDate(dateKey)}</span>
        </h1>
        <div className="header-tools">
          <button type="button" className="icon-btn" onClick={onHelp} aria-label="How to play">
            ?
          </button>
          <button type="button" className="icon-btn" onClick={onNewGame} aria-label="Restart">
            ↺
          </button>
        </div>
      </div>

      <div className="header-stats">
        <span className="score" aria-label={`Score ${total}`}>
          {total}
        </span>
        <span className="header-meta">
          {handsPlayed} hand{handsPlayed === 1 ? '' : 's'} · {cardsLeft} card
          {cardsLeft === 1 ? '' : 's'} left
        </span>
      </div>
    </header>
  );
}
