import { useEffect, useState } from 'react';
import { useRoom } from '../../hooks/useRoom';
import { pushEvent } from '../../lib/utils';
import { ShowLayout } from '../layout/ShowLayout';

export function PlayerPage({ code }: { code: string }) {
  const [room, patch] = useRoom(code);
  const [name, setName] = useState(localStorage.getItem(`quizshow-name-${code}`) || '');
  const [playerId, setPlayerId] = useState(localStorage.getItem(`quizshow-player-${code}`) || '');
  const [text, setText] = useState('');
  const [viewMode, setViewMode] = useState(localStorage.getItem(`quizshow-player-view-${code}`) || 'fullhd');
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [pendingVoteId, setPendingVoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!room || !playerId) return;
    const existing = room.current.submissions?.[playerId] || room.current.drafts?.[playerId] || '';
    setText(existing.slice(0, 200));
    setSubmitConfirmOpen(false);
    setPendingVoteId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.activeRoundId, room?.phase, playerId]);

  if (!room)
    return (
      <main className="shell">
        <div className="panel">
          <h1>Raum nicht gefunden</h1>
          <a href="/">Zur Startseite</a>
        </div>
      </main>
    );

  const me = room.players.find((p) => p.id === playerId);
  const active = room.current.activeVoterId === playerId;
  const isEditing = !!room.current.editing?.[playerId];
  const hasSubmitted = !!room.current.submissions?.[playerId]?.trim() && !isEditing;

  function join() {
    patch((r) => {
      let slot =
        r.players.find((p) => p.id === playerId) ||
        r.players.find((p) => !p.name || p.name === name) ||
        r.players.find((p) => !p.connected);
      if (!slot) return r;
      const id = slot.id;
      r.players = r.players.map((p) => (p.id === id ? { ...p, name, connected: true } : p));
      localStorage.setItem(`quizshow-player-${code}`, id);
      localStorage.setItem(`quizshow-name-${code}`, name);
      setPlayerId(id);
      return r;
    });
  }

  function submitText() {
    const safeText = (text || '').slice(0, 200).trim();
    if (!safeText || hasSubmitted) return;
    patch((r) => {
      r.current.submissions[playerId] = safeText;
      if (!r.current.drafts) r.current.drafts = {};
      r.current.drafts[playerId] = safeText;
      if (r.current.editing) r.current.editing[playerId] = false;
      if (r.current.answers?.length) {
        r.current.answers = r.current.answers.map((a) => (a.authorId === playerId ? { ...a, text: safeText } : a));
      }
      r.current.events = pushEvent(r.current.events, 'submission', { playerId });
      return r;
    });
    setSubmitConfirmOpen(false);
  }

  function requestSubmit() {
    const safeText = (text || '').slice(0, 200).trim();
    if (!safeText || hasSubmitted) return;
    setSubmitConfirmOpen(true);
  }

  function updateTextLive(nextText: string) {
    setText((nextText || '').slice(0, 200));
  }

  function requestVote(answerId: string) {
    if (!active) return;
    setPendingVoteId(answerId);
  }

  function confirmVote(answerId: string) {
    if (!active) return;
    patch((r) => {
      r.current.votes[playerId] = answerId;
      const order = r.current.voteOrder;
      const idx = order.indexOf(playerId);
      r.current.activeVoterId = order[idx + 1] || null;
      r.current.events = pushEvent(r.current.events, 'vote', { playerId, answerId });
      return r;
    });
    setPendingVoteId(null);
  }

  function toggleViewMode() {
    const next = viewMode === 'fullhd' ? '4k' : 'fullhd';
    setViewMode(next);
    localStorage.setItem(`quizshow-player-view-${code}`, next);
  }

  if (!me)
    return (
      <main className="join-screen shell">
        <section className="hero-card small-card">
          <h1>Raum {code}</h1>
          <p>Wähle deinen Namen. Das Spiel hat exakt 4 Slots.</p>
          <input placeholder="Dein Name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="primary big" disabled={!name} onClick={join}>
            Beitreten / Reconnect
          </button>
        </section>
      </main>
    );

  const showTextInput = room.phase === 'writing' || isEditing;
  const playerControls = showTextInput
    ? {
        text,
        setText: updateTextLive,
        submitText,
        requestSubmit,
        submitConfirmOpen,
        setSubmitConfirmOpen,
        isEditing,
        hasSubmitted,
        canSubmit: !hasSubmitted && !!text.trim(),
        charCount: text.length,
      }
    : null;
  const playerObsUrl = `${window.location.origin}/player-obs/${code}/${playerId}`;

  return (
    <div className={`player-page player-res-${viewMode}`}>
      <ShowLayout
        room={room}
        mode="player"
        onVote={requestVote}
        onConfirmVote={confirmVote}
        onCancelVote={() => setPendingVoteId(null)}
        pendingVoteId={pendingVoteId}
        activePlayerId={playerId}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        playerControls={playerControls}
        playerObsUrl={playerObsUrl}
      />
    </div>
  );
}
