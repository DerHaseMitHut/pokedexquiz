import { Eye } from 'lucide-react';
import { PHASES } from '../../config/constants';
import { useScoreEffects } from '../../hooks/useScoreEffects';
import { SoundEngine } from '../sound/SoundEngine';
import { CamCard } from './CamCard';
import { AnswerCard } from './AnswerCard';
import { TimerDisplay } from './TimerDisplay';
import { PlayerViewMenu } from './PlayerViewMenu';
import { PlayerWritingPanel } from './PlayerWritingPanel';
import type { Room, PlayerControls, HostCard } from '../../types/room';

interface ShowLayoutProps {
  room: Room;
  mode: 'host' | 'player' | 'obs';
  onVote?: (id: string) => void;
  onConfirmVote?: (id: string) => void;
  onCancelVote?: () => void;
  pendingVoteId?: string | null;
  activePlayerId?: string;
  viewMode?: string;
  onToggleViewMode?: () => void;
  playerControls?: PlayerControls | null;
  playerObsUrl?: string;
  participantObs?: boolean;
}

export function ShowLayout({
  room,
  mode,
  onVote,
  onConfirmVote,
  onCancelVote,
  pendingVoteId,
  activePlayerId,
  viewMode,
  onToggleViewMode,
  playerControls,
  playerObsUrl,
  participantObs,
}: ShowLayoutProps) {
  const players = room.players;
  const hostCard: HostCard = { ...room.host, id: 'host', slot: 0, points: null, isHost: true, name: room.host.name || 'Host' };
  const people = [players[0], players[1], hostCard, players[2], players[3]];
  const activeVoter = players.find((p) => p.id === room.current.activeVoterId);
  const scoreEffects = useScoreEffects(room);
  const isPlayerWriting = mode === 'player' && playerControls;
  return (
    <div className={`show-layout ${mode} ${isPlayerWriting ? 'player-writing' : ''}`}>
      <SoundEngine room={room} />
      <div className="show-bg" />
      <div className="top-cams">
        {people.map((person) => (
          <CamCard
            key={person.id}
            person={person}
            active={person.id === room.current.activeVoterId}
            scoreEffect={scoreEffects[person.id]}
          />
        ))}
      </div>
      {mode === 'host' && (
        <div className="show-status">
          <span>{room.current.title || PHASES[room.phase]}</span>
          {activeVoter && <b>Am Zug: {activeVoter.name}</b>}
        </div>
      )}
      <section className="round-image-panel">
        {room.current.image ? (
          <img src={room.current.image} />
        ) : (
          <div className="empty-image">
            <span>Pokémon</span>
          </div>
        )}
      </section>
      <section className="answers-panel">
        <div className="answers-title">
          <Eye /> Antworten{' '}
          {mode === 'player' && !participantObs && viewMode !== undefined && onToggleViewMode && playerObsUrl !== undefined && (
            <PlayerViewMenu viewMode={viewMode} onToggleViewMode={onToggleViewMode} playerObsUrl={playerObsUrl} />
          )}
        </div>
        {isPlayerWriting ? (
          <>
            <TimerDisplay room={room} />
            <PlayerWritingPanel controls={playerControls} />
          </>
        ) : room.current.answers.length ? (
          room.current.answers
            .slice(0, room.current.visibleAnswerCount ?? room.current.answers.length)
            .map((answer) => (
              <AnswerCard
                key={answer.id}
                answer={answer}
                room={room}
                onVote={onVote}
                onConfirmVote={onConfirmVote}
                onCancelVote={onCancelVote}
                pendingVote={pendingVoteId === answer.id}
                canVote={mode === 'player' && room.current.activeVoterId === activePlayerId}
              />
            ))
        ) : (
          <>
            <div className="waiting-card">Warte auf Antworten…</div>
            <TimerDisplay room={room} />
          </>
        )}
      </section>
    </div>
  );
}
