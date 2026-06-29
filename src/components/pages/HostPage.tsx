import { useEffect, useState } from 'react';
import { Clipboard, Gamepad2, ImagePlus, MonitorPlay, RefreshCcw, Save, Sparkles, Users } from 'lucide-react';
import { useRoom } from '../../hooks/useRoom';
import { createRoom, saveRoom } from '../../lib/roomStorage';
import { soundSettings, pushEvent, getTimerRemaining, shuffle } from '../../lib/utils';
import { LETTERS, PHASES } from '../../config/constants';
import { ShowLayout } from '../layout/ShowLayout';
import { TimerDisplay } from '../layout/TimerDisplay';
import { StatusDots } from '../layout/StatusDots';
import { SoundSettingsCard } from '../host/SoundSettingsCard';
import { SubmissionReview } from '../host/SubmissionReview';
import { InternalAnswerList } from '../host/InternalAnswerList';
import { PersonEditor } from '../host/PersonEditor';
import { ImageInput } from '../shared/ImageInput';
import { Loading } from '../Loading';
import type { RoundDef, Player, Host } from '../../types/room';
import type { SoundSettings } from '../../types/sound';

export function HostPage({ code }: { code: string }) {
  const [room, patch] = useRoom(code);
  type RoundForm = Omit<RoundDef, 'id'>;
  const [newRound, setNewRound] = useState<RoundForm>({ title: '', image: '', hostText: '', note: '' });
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [editingRound, setEditingRound] = useState<RoundForm>({ title: '', image: '', hostText: '', note: '' });
  const [copyHint, setCopyHint] = useState('');
  useEffect(() => {
    if (!room) {
      const r = createRoom(code);
      saveRoom(r);
    }
  }, [room, code]);
  if (!room) return <Loading />;

  const submissionsReady = room.players.every((p) => room.current.submissions[p.id]?.trim());

  async function copy(text: string, label = 'Link') {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopyHint(`${label} kopiert`);
    setTimeout(() => setCopyHint(''), 1400);
  }

  function updatePlayer(id: string, data: Partial<Player>) {
    patch((r) => {
      r.players = r.players.map((p) => (p.id === id ? { ...p, ...data } : p));
      return r;
    });
  }
  function updateHost(data: Partial<Host>) {
    patch((r) => {
      r.host = { ...r.host, ...data };
      return r;
    });
  }
  function updateSettings(data: Partial<SoundSettings>) {
    patch((r) => {
      r.settings = soundSettings({
        ...(r.settings || {}),
        ...data,
        events: { ...(r.settings?.events || {}), ...(data.events || {}) },
      });
      return r;
    });
  }
  function addRound() {
    if (!newRound.title && !newRound.hostText && !newRound.image) return;
    patch((r) => {
      r.rounds.push({ ...newRound, id: crypto.randomUUID() });
      return r;
    });
    setNewRound({ title: '', image: '', hostText: '', note: '' });
  }
  function deleteRound(id: string) {
    patch((r) => {
      r.rounds = r.rounds.filter((x) => x.id !== id);
      return r;
    });
  }
  function beginEditRound(round: RoundDef) {
    setEditingRoundId(round.id);
    setEditingRound({ title: round.title || '', image: round.image || '', hostText: round.hostText || '', note: round.note || '' });
  }
  function saveEditedRound() {
    if (!editingRoundId) return;
    patch((r) => {
      r.rounds = r.rounds.map((round) => (round.id === editingRoundId ? { ...round, ...editingRound } : round));
      return r;
    });
    setEditingRoundId(null);
    setEditingRound({ title: '', image: '', hostText: '', note: '' });
  }
  function cancelEditRound() {
    setEditingRoundId(null);
    setEditingRound({ title: '', image: '', hostText: '', note: '' });
  }
  function startRound(round: RoundDef) {
    patch((r) => {
      r.phase = 'writing';
      r.activeRoundId = round.id;
      r.current = {
        image: round.image,
        title: round.title,
        hostText: round.hostText,
        submissions: {},
        drafts: {},
        answers: [],
        votes: {},
        revealed: {},
        voteOrder: [],
        activeVoterId: null,
        awarded: {},
        visibleAnswerCount: 0,
        editing: {},
        timerDuration: 90,
        timerStartedAt: Date.now(),
        timerRunning: true,
        timerRemaining: 90,
        events: pushEvent(r.current.events, 'round-start'),
      };
      return r;
    });
  }
  function prepareAnswers() {
    patch((r) => {
      const items = [
        { id: crypto.randomUUID(), authorType: 'host' as const, authorId: 'host', text: r.current.hostText },
        ...r.players.map((p) => ({ id: crypto.randomUUID(), authorType: 'player' as const, authorId: p.id, text: r.current.submissions[p.id] || '' })),
      ];
      r.current.answers = shuffle(items).map((x, i) => ({ ...x, letter: LETTERS[i] }));
      r.current.visibleAnswerCount = 0;
      r.phase = 'answers';
      r.current.timerRunning = false;
      r.current.events = pushEvent(r.current.events, 'answers-prepared');
      return r;
    });
  }
  function showNextAnswer() {
    patch((r) => {
      if (!r.current.answers.length) return r;
      r.current.visibleAnswerCount = Math.min(5, (r.current.visibleAnswerCount || 0) + 1);
      r.current.events = pushEvent(r.current.events, 'answer-show', { count: r.current.visibleAnswerCount });
      return r;
    });
  }
  function startVoting(startId: string) {
    patch((r) => {
      const idx = r.players.findIndex((p) => p.id === startId);
      const order = [...r.players.slice(idx), ...r.players.slice(0, idx)].map((p) => p.id);
      r.current.voteOrder = order;
      r.current.activeVoterId = order[0];
      r.phase = 'voting';
      r.current.events = pushEvent(r.current.events, 'voting-start');
      return r;
    });
  }
  function revealAnswer(answerId: string) {
    patch((r) => {
      r.phase = 'reveal';
      r.current.revealed[answerId] = true;
      const ans = r.current.answers.find((a) => a.id === answerId);
      const voters = Object.entries(r.current.votes)
        .filter(([, voted]) => voted === answerId)
        .map(([pid]) => pid);
      const awardKey = `answer-${answerId}`;
      const awards: Record<string, number> = {};
      if (ans && !r.current.awarded[awardKey]) {
        if (ans.authorType === 'host') {
          for (const voterId of voters) awards[voterId] = (awards[voterId] || 0) + 1;
        } else {
          const validVotes = voters.filter((voterId) => voterId !== ans.authorId).length;
          if (validVotes > 0) awards[ans.authorId] = validVotes;
        }
        for (const [pid, amount] of Object.entries(awards)) {
          const p = r.players.find((x) => x.id === pid);
          if (p) p.points += amount;
        }
        r.current.awarded[awardKey] = true;
      }
      r.current.events = pushEvent(
        r.current.events,
        ans?.authorType === 'host' ? 'host-reveal' : 'answer-reveal',
        { answerId, voters, awards }
      );
      if (Object.keys(awards).length) r.current.events = pushEvent(r.current.events, 'score-award', { answerId, awards });
      return r;
    });
  }
  function finishRound() {
    patch((r) => {
      const previousEvents = r.current.events || [];
      r.phase = 'result';
      r.activeRoundId = null;
      r.current = {
        ...r.current,
        image: '',
        title: '',
        hostText: '',
        submissions: {},
        drafts: {},
        answers: [],
        votes: {},
        revealed: {},
        voteOrder: [],
        activeVoterId: null,
        awarded: {},
        visibleAnswerCount: 0,
        editing: {},
        timerDuration: 90,
        timerStartedAt: null,
        timerRunning: false,
        timerRemaining: 90,
        events: pushEvent(previousEvents, 'round-result'),
      };
      return r;
    });
  }
  function restartTimer() {
    patch((r) => {
      r.current.timerDuration = 90;
      r.current.timerRemaining = 90;
      r.current.timerStartedAt = Date.now();
      r.current.timerRunning = true;
      r.current.events = pushEvent(r.current.events, 'timer-restart');
      return r;
    });
  }
  function stopTimer() {
    patch((r) => {
      r.current.timerRemaining = getTimerRemaining(r.current);
      r.current.timerStartedAt = null;
      r.current.timerRunning = false;
      r.current.events = pushEvent(r.current.events, 'timer-stop');
      return r;
    });
  }
  function resetTimer() {
    patch((r) => {
      r.current.timerDuration = 90;
      r.current.timerRemaining = 90;
      r.current.timerStartedAt = null;
      r.current.timerRunning = false;
      r.current.events = pushEvent(r.current.events, 'timer-reset');
      return r;
    });
  }
  function testSound() {
    patch((r) => {
      r.current.events = pushEvent(r.current.events, 'sound-test');
      return r;
    });
  }
  function unlockSubmission(playerId: string) {
    patch((r) => {
      r.current.editing = { ...(r.current.editing || {}), [playerId]: true };
      r.current.events = pushEvent(r.current.events, 'submission-unlock', { playerId });
      return r;
    });
  }
  function resetGame() {
    if (confirm('Aktuellen Spielstand wirklich zurücksetzen?'))
      patch((r) => ({ ...createRoom(r.code), rounds: r.rounds }));
  }
  function fillTestData() {
    patch((r) => {
      const demoNames = ['Testspieler 1', 'Testspieler 2', 'Testspieler 3', 'Testspieler 4'];
      const demoIcons = ['🦊', '🐧', '🐲', '⭐'];
      const makeIcon = (emoji: string, color: string) =>
        `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="${color}"/><circle cx="64" cy="64" r="54" fill="rgba(255,255,255,.16)"/><text x="64" y="78" text-anchor="middle" font-size="58" font-family="Arial, sans-serif">${emoji}</text></svg>`
        )}`;
      r.players = r.players.map((p, i) => ({
        ...p,
        name: p.name || demoNames[i],
        connected: true,
        icon: p.icon || makeIcon(demoIcons[i], p.color || ['#ef4444', '#38bdf8', '#a78bfa', '#f59e0b'][i]),
      }));
      const demoTexts = [
        'Ich bin mir sicher, dass das gleich komplett aus dem Kontext gerissen wird.',
        'Wenn du merkst, dass du die Aufgabe falsch verstanden hast, aber schon überzeugend guckst.',
        'Das ist der Moment, in dem der Plan von Anfang an keiner war.',
        'Ich würde gerne widersprechen, aber leider sieht das sehr nach mir aus.',
      ];
      if (r.phase === 'writing' || Object.keys(r.current.submissions || {}).length === 0) {
        r.players.forEach((p, i) => {
          if (!r.current.submissions[p.id]) r.current.submissions[p.id] = demoTexts[i];
        });
      }
      // Wichtig: Testdaten bereiten nur Spieler, Icons und Beispieltexte vor.
      // Antworten werden weiterhin manuell mit „A–E mischen" und „Nächste Antwort zeigen" eingeblendet,
      // damit der echte Ablauf getestet werden kann.
      r.current.events = pushEvent(r.current.events, 'test-fill');
      return r;
    });
  }
  function castTestVote() {
    patch((r) => {
      if (r.phase !== 'voting' || !r.current.activeVoterId || !r.current.answers?.length) return r;
      const voterId = r.current.activeVoterId;
      const order = r.current.voteOrder?.length ? r.current.voteOrder : r.players.map((p) => p.id);
      const idx = Math.max(0, order.indexOf(voterId));
      const hostAnswer = r.current.answers.find((a) => a.authorType === 'host');
      const playerAnswers = r.current.answers.filter((a) => a.authorType === 'player');
      // Demonstration: Die ersten zwei Testspieler wählen bewusst dieselbe Antwort,
      // damit sichtbar ist, dass mehrere Marker auf einer Antwort liegen können.
      const demoChoice =
        idx < 2
          ? hostAnswer || r.current.answers[0]
          : playerAnswers.find((a) => a.authorId !== voterId) || hostAnswer || r.current.answers[idx % r.current.answers.length];
      if (!demoChoice) return r;
      r.current.votes = { ...(r.current.votes || {}), [voterId]: demoChoice.id };
      r.current.activeVoterId = order[idx + 1] || null;
      r.current.events = pushEvent(r.current.events, 'vote', { playerId: voterId, answerId: demoChoice.id, test: true });
      return r;
    });
  }

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="brand small">
          <Sparkles /> Quizshow
        </div>
        <div className="room-code">{code}</div>
        <button onClick={() => copy(`${location.origin}/player/${code}`, 'Spieler-Link')}>
          <Clipboard /> Spieler-Link kopieren
        </button>
        <button onClick={() => copy(`${location.origin}/obs/${code}`, 'OBS-Link')}>
          <MonitorPlay /> OBS-Link kopieren
        </button>
        {copyHint && <div className="copy-hint">{copyHint}</div>}
        <a className="ghost-link" href={`/obs/${code}`} target="_blank" rel="noreferrer">
          OBS öffnen
        </a>
        <div className="phase-pill">{PHASES[room.phase]}</div>
        <SoundSettingsCard room={room} onChange={updateSettings} onTest={testSound} compact />
        <button className="danger" onClick={resetGame}>
          <RefreshCcw /> Reset
        </button>
      </aside>

      <main className="admin-main">
        <section className="panel">
          <h2>
            <Users /> Lobby &amp; Kameras
          </h2>
          <div className="host-grid">
            <PersonEditor label="Host" person={room.host} onChange={updateHost} isHost />
            {room.players.map((p) => (
              <PersonEditor key={p.id} label={`Spieler ${p.slot}`} person={p} onChange={(data) => updatePlayer(p.id, data)} />
            ))}
          </div>
        </section>

        <section className="panel two-col">
          <div>
            <h2>
              <ImagePlus /> Runde vorbereiten
            </h2>
            <input
              placeholder="Rundentitel"
              value={newRound.title}
              onChange={(e) => setNewRound({ ...newRound, title: e.target.value })}
            />
            <ImageInput label="Bild hochladen" value={newRound.image} onChange={(image) => setNewRound({ ...newRound, image })} />
            <textarea
              placeholder="Dein echter Text"
              value={newRound.hostText}
              onChange={(e) => setNewRound({ ...newRound, hostText: e.target.value })}
            />
            <input
              placeholder="Notiz nur für dich optional"
              value={newRound.note}
              onChange={(e) => setNewRound({ ...newRound, note: e.target.value })}
            />
            <button className="primary" onClick={addRound}>
              <Save /> Runde speichern
            </button>
          </div>
          <div>
            <h2>Gespeicherte Runden</h2>
            <div className="round-list">
              {room.rounds.map((round) =>
                editingRoundId === round.id ? (
                  <div className="round-item editing" key={round.id}>
                    <div className="round-edit-form">
                      <input
                        placeholder="Rundentitel"
                        value={editingRound.title}
                        onChange={(e) => setEditingRound({ ...editingRound, title: e.target.value })}
                      />
                      <ImageInput
                        label="Bild ändern"
                        value={editingRound.image}
                        onChange={(image) => setEditingRound({ ...editingRound, image })}
                      />
                      <textarea
                        placeholder="Dein echter Text"
                        value={editingRound.hostText}
                        onChange={(e) => setEditingRound({ ...editingRound, hostText: e.target.value })}
                      />
                      <input
                        placeholder="Notiz nur für dich optional"
                        value={editingRound.note}
                        onChange={(e) => setEditingRound({ ...editingRound, note: e.target.value })}
                      />
                      <div className="button-row">
                        <button className="primary" onClick={saveEditedRound}>
                          Änderungen speichern
                        </button>
                        <button onClick={cancelEditRound}>Abbrechen</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="round-item" key={round.id}>
                    <div className="thumb">{round.image ? <img src={round.image} /> : <ImagePlus />}</div>
                    <div>
                      <strong>{round.title || 'Unbenannte Runde'}</strong>
                      <p>{round.hostText}</p>
                    </div>
                    <button onClick={() => startRound(round)}>Starten</button>
                    <button onClick={() => beginEditRound(round)}>Bearbeiten</button>
                    <button className="icon danger" onClick={() => deleteRound(round.id)}>
                      ×
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>
            <Gamepad2 /> Live-Steuerung
          </h2>
          <div className="test-tools">
            <button onClick={fillTestData}>Testdaten auffüllen</button>
            <span>
              Füllt leere Spieler-Slots, Platzhalter-Icons und in der Schreibphase fehlende Texte. Antworten und Stimmen bleiben
              manuell steuerbar.
            </span>
          </div>
          <div className="live-workbench">
            <div className="host-preview">
              <ShowLayout room={room} mode="host" />
            </div>
            <div className="control-stack">
              <div className="control-card">
                <b>1. Texte sammeln</b>
                <p>{submissionsReady ? 'Alle Texte sind da.' : 'Warte auf Spielertexte.'}</p>
                <StatusDots room={room} />
                <SubmissionReview room={room} onUnlock={unlockSubmission} />
                <div className="timer-controls">
                  <TimerDisplay room={room} compact />
                  <button onClick={restartTimer}>90s neu starten</button>
                  <button onClick={stopTimer}>Timer stoppen</button>
                  <button onClick={resetTimer}>Timer auf 1:30 setzen</button>
                </div>
              </div>
              <div className="control-card">
                <b>2. Antworten einblenden</b>
                <button disabled={!submissionsReady || !room.current.hostText} onClick={prepareAnswers}>
                  A–E mischen
                </button>
                <button
                  disabled={room.current.answers.length !== 5 || (room.current.visibleAnswerCount || 0) >= 5}
                  onClick={showNextAnswer}
                >
                  Nächste Antwort zeigen ({Math.min((room.current.visibleAnswerCount || 0) + 1, 5)}/5)
                </button>
                <InternalAnswerList room={room} />
              </div>
              <div className="control-card">
                <b>3. Abstimmung starten</b>
                <div className="button-row">
                  {room.players.map((p) => (
                    <button
                      key={p.id}
                      disabled={room.current.answers.length !== 5 || (room.current.visibleAnswerCount || 0) < 5}
                      onClick={() => startVoting(p.id)}
                    >
                      {p.name || `S${p.slot}`} startet
                    </button>
                  ))}
                </div>
                <button disabled={room.phase !== 'voting' || !room.current.activeVoterId} onClick={castTestVote}>
                  Nächste Teststimme abgeben
                </button>
                <p className="mini-hint">Zum Testen der Marker. Mehrere Spieler können dieselbe Antwort wählen.</p>
              </div>
              <div className="control-card">
                <b>4. Auflösen</b>
                <div className="button-row">
                  {room.current.answers.map((a) => (
                    <button key={a.id} className={room.current.revealed[a.id] ? 'done' : ''} onClick={() => revealAnswer(a.id)}>
                      {a.letter}
                    </button>
                  ))}
                </div>
                <button onClick={finishRound}>Runde beenden</button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
