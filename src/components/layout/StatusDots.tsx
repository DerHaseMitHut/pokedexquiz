import type { Room } from '../../types/room';

export function StatusDots({ room }: { room: Room }) {
  return (
    <div className="status-dots">
      {room.players.map((p) => (
        <span key={p.id} className={room.current.submissions[p.id] ? 'ready' : ''}>
          {p.name || `S${p.slot}`}
        </span>
      ))}
    </div>
  );
}
