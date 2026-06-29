import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { formatTime, getTimerRemaining } from '../../lib/utils';
import type { Room } from '../../types/room';

export function TimerDisplay({ room, compact }: { room: Room; compact?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(id);
  }, []);
  const remaining = getTimerRemaining(room.current);
  const duration = room.current.timerDuration || 90;
  const progress = Math.max(0, Math.min(1, remaining / duration));
  const isUrgent = remaining <= 10;
  const hidden = !compact && !['writing', 'lobby', 'result'].includes(room.phase);
  if (hidden) return null;
  return (
    <div className={`timer-display ${compact ? 'compact' : ''} ${isUrgent ? 'urgent' : ''}`}>
      <div className="timer-ring" style={{ '--progress': `${progress * 360}deg` } as React.CSSProperties}>
        <Timer />
        <span>{formatTime(remaining)}</span>
      </div>
      {!compact && <div className="timer-label">Zeit für eure Antworten</div>}
    </div>
  );
}
