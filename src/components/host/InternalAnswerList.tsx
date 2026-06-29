import type { Room } from '../../types/room';
import type { Answer } from '../../types/answers';

export function InternalAnswerList({ room }: { room: Room }) {
  if (!room.current.answers?.length) {
    return (
      <div className="internal-answers empty">
        Nach dem Mischen siehst du hier intern, wer A–E geschrieben hat.
      </div>
    );
  }
  const authorName = (answer: Answer) => {
    if (answer.authorType === 'host') return room.host.name || 'Host';
    return room.players.find((p) => p.id === answer.authorId)?.name || 'Unbekannter Spieler';
  };
  return (
    <div className="internal-answers">
      <div className="internal-title">Nur für dich sichtbar</div>
      {room.current.answers.map((answer) => (
        <div
          key={answer.id}
          className={answer.authorType === 'host' ? 'internal-row host-answer' : 'internal-row'}
        >
          <span className="internal-letter">{answer.letter}</span>
          <span className="internal-text">{answer.text}</span>
          <span className="internal-author">
            {answer.authorType === 'host' ? 'Echter Text' : 'Autor'}: {authorName(answer)}
          </span>
        </div>
      ))}
    </div>
  );
}
