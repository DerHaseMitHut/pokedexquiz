import type { Room } from '../../types/room';

export function SubmissionReview({ room, onUnlock }: { room: Room; onUnlock: (playerId: string) => void }) {
  const canReview = ['writing', 'answers'].includes(room.phase);
  if (!canReview) return null;
  return (
    <div className="submission-review">
      <div className="internal-title">Antworten prüfen</div>
      {room.players.map((player) => {
        const submitted = room.current.submissions[player.id]?.trim();
        const unlocked = room.current.editing?.[player.id];
        return (
          <div
            key={player.id}
            className={`submission-row ${submitted ? 'ready' : ''} ${unlocked ? 'unlocked' : ''}`}
          >
            <div className="submission-meta">
              <b>{player.name || `Spieler ${player.slot}`}</b>
              {unlocked && <span>Korrektur frei</span>}
            </div>
            <div className="submission-text">{submitted || 'Noch keine Antwort abgegeben.'}</div>
            <button disabled={!submitted} onClick={() => onUnlock(player.id)}>
              {unlocked ? 'erneut freigegeben' : 'Korrektur freigeben'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
