import { useState } from 'react';
import { useRoom } from '../../hooks/useRoom';
import { Loading } from '../Loading';
import { ShowLayout } from '../layout/ShowLayout';

export function PlayerObsPage({ code, playerId }: { code: string; playerId: string }) {
  const [room] = useRoom(code);
  const [viewMode] = useState<string>(new URLSearchParams(window.location.search).get('view') || 'fullhd');
  if (!room) return <Loading />;
  const player = room.players.find((p) => p.id === playerId);
  if (!player)
    return (
      <main className="shell">
        <div className="panel">
          <h1>Spieler nicht gefunden</h1>
          <p>Der OBS-Link gehört zu keinem aktuellen Spieler-Slot.</p>
        </div>
      </main>
    );
  const isEditing = !!room.current.editing?.[playerId];
  const showTextInput = room.phase === 'writing' || isEditing;
  const liveText = (room.current.submissions?.[playerId] || room.current.drafts?.[playerId] || '').slice(0, 200);
  const hasSubmitted = !!room.current.submissions?.[playerId]?.trim() && !isEditing;
  const playerControls = showTextInput
    ? {
        text: liveText,
        setText: () => {},
        submitText: () => {},
        requestSubmit: () => {},
        submitConfirmOpen: false,
        setSubmitConfirmOpen: () => {},
        isEditing,
        hasSubmitted,
        canSubmit: false,
        charCount: liveText.length,
        readOnly: true,
      }
    : null;
  return (
    <div className={`player-page player-obs-page player-res-${viewMode}`}>
      <ShowLayout room={room} mode="player" participantObs activePlayerId={playerId} viewMode={viewMode} playerControls={playerControls} />
    </div>
  );
}
