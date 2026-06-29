import { Check } from 'lucide-react';
import { PlayerMarker } from './PlayerMarker';
import type { Room } from '../../types/room';
import type { Answer } from '../../types/answers';

interface AnswerCardProps {
  answer: Answer;
  room: Room;
  onVote?: (id: string) => void;
  onConfirmVote?: (id: string) => void;
  onCancelVote?: () => void;
  pendingVote: boolean;
  canVote: boolean;
}

export function AnswerCard({ answer, room, onVote, onConfirmVote, onCancelVote, pendingVote, canVote }: AnswerCardProps) {
  const votes = Object.entries(room.current.votes)
    .filter(([, answerId]) => answerId === answer.id)
    .map(([pid]) => room.players.find((p) => p.id === pid))
    .filter((p): p is (typeof room.players)[0] => !!p);
  const revealed = room.current.revealed[answer.id];
  const author = answer.authorType === 'player' ? room.players.find((p) => p.id === answer.authorId) : undefined;
  return (
    <div
      className={`answer-card ${revealed ? 'revealed' : ''} ${revealed && answer.authorType === 'host' ? 'real' : ''} ${canVote ? 'clickable' : ''} ${pendingVote ? 'pending-vote' : ''}`}
      onClick={() => canVote && onVote?.(answer.id)}
      role={canVote ? 'button' : undefined}
      tabIndex={canVote ? 0 : undefined}
      onKeyDown={(e) => {
        if (canVote && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onVote?.(answer.id);
        }
      }}
    >
      <div
        className={`answer-letter ${revealed ? 'reveal-token' : ''} ${revealed && answer.authorType === 'host' ? 'host-check' : ''}`}
      >
        {revealed ? (
          answer.authorType === 'host' ? (
            <Check size={34} strokeWidth={4} />
          ) : (
            <PlayerMarker player={author} large />
          )
        ) : (
          answer.letter
        )}
      </div>
      <div className="answer-main">
        <div className="answer-text">{answer.text}</div>
        {pendingVote && (
          <div className="inline-confirm vote-confirm" onClick={(e) => e.stopPropagation()}>
            <span>Hierfür abstimmen?</span>
            <div className="inline-confirm-actions">
              <button type="button" className="confirm-yes" onClick={() => onConfirmVote?.(answer.id)}>
                Ja
              </button>
              <button type="button" className="confirm-no" onClick={() => onCancelVote?.()}>
                Nein
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="vote-markers">
        {votes.map((p, index) => (
          <PlayerMarker key={p.id} player={p} fly style={{ '--fly-delay': `${index * 70}ms` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
