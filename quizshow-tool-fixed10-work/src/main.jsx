import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { Camera, Check, Clipboard, Crown, Eye, Gamepad2, ImagePlus, MonitorPlay, Plus, RefreshCcw, Save, Sparkles, Timer, Upload, Users } from 'lucide-react';
import './styles.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const API_BASE = import.meta.env.VITE_API_URL || (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:3001' : '');
let socket;
function getSocket() {
  if (!API_BASE) return null;
  if (!socket) socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  return socket;
}
async function fetchRoomRemote(code) {
  if (!API_BASE || !code) return null;
  try {
    const res = await fetch(`${API_BASE}/api/rooms/${code}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
async function saveRoomRemote(room) {
  if (!API_BASE || !room?.code) return;
  try {
    await fetch(`${API_BASE}/api/rooms/${room.code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room)
    });
  } catch {}
}

const PHASES = {
  lobby: 'Lobby',
  writing: 'Texte schreiben',
  answers: 'Antworten sichtbar',
  voting: 'Abstimmung',
  reveal: 'Auflösung',
  result: 'Rundenergebnis'
};

const defaultPlayers = [1, 2, 3, 4].map((slot) => ({
  id: `p${slot}`,
  slot,
  name: '',
  connected: false,
  points: 0,
  vdoUrl: '',
  icon: '',
  color: ['#ef4444', '#38bdf8', '#a78bfa', '#f59e0b'][slot - 1]
}));

const demoRounds = [
  {
    id: crypto.randomUUID(),
    title: 'Beispielrunde: Verdächtiger Blick',
    image: '',
    hostText: 'Wenn du so tust, als hättest du den Plan verstanden, aber gerade erst beigetreten bist.',
    note: 'Demo-Runde'
  }
];

function createRoom(code = randomCode()) {
  return {
    code,
    createdAt: Date.now(),
    phase: 'lobby',
    activeRoundId: null,
    host: { name: 'Host', points: 0, vdoUrl: '', icon: '', color: '#f8fafc' },
    players: defaultPlayers,
    rounds: demoRounds,
    current: {
      image: '',
      title: '',
      hostText: '',
      submissions: {},
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
      events: []
    },
    settings: { sounds: true, volume: 0.55 }
  };
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function storageKey(code) { return `quizshow-room-${code}`; }
function listKey() { return 'quizshow-room-list'; }

function saveRoom(room) {
  localStorage.setItem(storageKey(room.code), JSON.stringify(room));
  const list = JSON.parse(localStorage.getItem(listKey()) || '[]');
  if (!list.includes(room.code)) localStorage.setItem(listKey(), JSON.stringify([room.code, ...list].slice(0, 20)));
  window.dispatchEvent(new CustomEvent('room-updated', { detail: room }));
  try { new BroadcastChannel(`quizshow-${room.code}`).postMessage(room); } catch {}
  saveRoomRemote(room);
}

function loadRoom(code) {
  const raw = localStorage.getItem(storageKey(code));
  return raw ? JSON.parse(raw) : null;
}

function useRoom(code) {
  const [room, setRoom] = useState(() => code ? loadRoom(code) : null);
  useEffect(() => {
    if (!code) return;
    let mounted = true;
    fetchRoomRemote(code).then(remote => {
      if (remote && mounted) {
        localStorage.setItem(storageKey(code), JSON.stringify(remote));
        setRoom(remote);
      }
    });
    const update = () => {
      const local = loadRoom(code);
      if (local) setRoom(local);
    };
    const onCustom = (e) => { if (e.detail?.code === code) setRoom(e.detail); };
    window.addEventListener('storage', update);
    window.addEventListener('room-updated', onCustom);
    let bc;
    try { bc = new BroadcastChannel(`quizshow-${code}`); bc.onmessage = (e) => setRoom(e.data); } catch {}
    const s = getSocket();
    const onSocketUpdate = (next) => {
      if (next?.code === code) {
        localStorage.setItem(storageKey(code), JSON.stringify(next));
        setRoom(next);
      }
    };
    if (s) { s.emit('room:join', code); s.on('room:update', onSocketUpdate); }
    const t = setInterval(async () => {
      const remote = await fetchRoomRemote(code);
      if (remote && mounted) {
        localStorage.setItem(storageKey(code), JSON.stringify(remote));
        setRoom(remote);
      } else update();
    }, 2000);
    return () => {
      mounted = false;
      window.removeEventListener('storage', update);
      window.removeEventListener('room-updated', onCustom);
      clearInterval(t);
      if (bc) bc.close();
      if (s) s.off('room:update', onSocketUpdate);
    };
  }, [code]);
  const patch = (fn) => {
    const fresh = loadRoom(code) || room;
    if (!fresh) return;
    const next = typeof fn === 'function' ? fn(structuredClone(fresh)) : { ...fresh, ...fn };
    saveRoom(next);
    setRoom(next);
  };
  return [room, patch];
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeVdoUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('vdo.ninja') && !u.searchParams.has('view') && u.searchParams.has('push')) {
      const push = u.searchParams.get('push');
      return `https://vdo.ninja/?view=${encodeURIComponent(push)}&cleanoutput&transparent&autoplay`;
    }
    return url;
  } catch {
    return url;
  }
}


function getTimerRemaining(current) {
  const duration = current?.timerDuration ?? 90;
  if (!current?.timerRunning) {
    if (typeof current?.timerRemaining === 'number') return Math.max(0, current.timerRemaining);
    if (!current?.timerStartedAt) return duration;
    const elapsed = Math.floor((Date.now() - current.timerStartedAt) / 1000);
    return Math.max(0, duration - elapsed);
  }
  if (!current?.timerStartedAt) return duration;
  const elapsed = Math.floor((Date.now() - current.timerStartedAt) / 1000);
  return Math.max(0, duration - elapsed);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function App() {
  const path = window.location.pathname.split('/').filter(Boolean);
  if (path[0] === 'host' && path[1]) return <HostPage code={path[1].toUpperCase()} />;
  if (path[0] === 'player' && path[1]) return <PlayerPage code={path[1].toUpperCase()} />;
  if (path[0] === 'obs' && path[1]) return <ObsPage code={path[1].toUpperCase()} />;
  return <Home />;
}

function Home() {
  const [join, setJoin] = useState('');
  const recent = JSON.parse(localStorage.getItem(listKey()) || '[]');
  function startRoom() {
    let code = randomCode();
    while (loadRoom(code)) code = randomCode();
    const room = createRoom(code);
    saveRoom(room);
    window.location.href = `/host/${code}`;
  }
  return <main className="home shell">
    <section className="hero-card">
      <div className="brand"><Sparkles /> Quizshow Tool</div>
      <h1>Bild. Texte. Bluff. Auflösung.</h1>
      <p>Eine 16:9-Showoberfläche für OBS mit Host-Steuerung, Spieleransicht, VDO.Ninja-Kameras, A–E-Antwortkarten und animierter Punktevergabe.</p>
      <div className="home-actions">
        <button className="primary big" onClick={startRoom}><Plus /> Neuen Raum starten</button>
        <div className="join-box">
          <input placeholder="Raumcode" value={join} onChange={e => setJoin(e.target.value.toUpperCase())} />
          <button onClick={() => join && (window.location.href = `/player/${join}`)}>Beitreten</button>
        </div>
      </div>
      {recent.length > 0 && <div className="recent"><span>Zuletzt:</span>{recent.map(c => <a key={c} href={`/host/${c}`}>{c}</a>)}</div>}
    </section>
  </main>
}

function HostPage({ code }) {
  const [room, patch] = useRoom(code);
  const [newRound, setNewRound] = useState({ title: '', image: '', hostText: '', note: '' });
  const [copyHint, setCopyHint] = useState('');
  useEffect(() => { if (!room) { const r = createRoom(code); saveRoom(r); } }, [room, code]);
  if (!room) return <Loading />;

  const allReady = room.players.every(p => p.name);
  const submissionsReady = room.players.every(p => room.current.submissions[p.id]?.trim());
  const answerMap = Object.fromEntries(room.current.answers.map(a => [a.id, a]));

  async function copy(text, label = 'Link') {
    try { await navigator.clipboard?.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopyHint(`${label} kopiert`); setTimeout(() => setCopyHint(''), 1400);
  }
  function updatePlayer(id, data) { patch(r => { r.players = r.players.map(p => p.id === id ? { ...p, ...data } : p); return r; }); }
  function updateHost(data) { patch(r => { r.host = { ...r.host, ...data }; return r; }); }
  function addRound() {
    if (!newRound.title && !newRound.hostText && !newRound.image) return;
    patch(r => { r.rounds.push({ ...newRound, id: crypto.randomUUID() }); return r; });
    setNewRound({ title: '', image: '', hostText: '', note: '' });
  }
  function deleteRound(id) { patch(r => { r.rounds = r.rounds.filter(x => x.id !== id); return r; }); }
  function startRound(round) {
    patch(r => {
      r.phase = 'writing';
      r.activeRoundId = round.id;
      r.current = { image: round.image, title: round.title, hostText: round.hostText, submissions: {}, answers: [], votes: {}, revealed: {}, voteOrder: [], activeVoterId: null, awarded: {}, visibleAnswerCount: 0, editing: {}, timerDuration: 90, timerStartedAt: Date.now(), timerRunning: true, timerRemaining: 90, events: pushEvent(r.current.events, 'round-start') };
      return r;
    });
  }
  function prepareAnswers() {
    patch(r => {
      const items = [
        { id: crypto.randomUUID(), authorType: 'host', authorId: 'host', text: r.current.hostText },
        ...r.players.map(p => ({ id: crypto.randomUUID(), authorType: 'player', authorId: p.id, text: r.current.submissions[p.id] || '' }))
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
    patch(r => {
      if (!r.current.answers.length) return r;
      r.current.visibleAnswerCount = Math.min(5, (r.current.visibleAnswerCount || 0) + 1);
      r.current.events = pushEvent(r.current.events, 'answer-show', { count: r.current.visibleAnswerCount });
      return r;
    });
  }
  function startVoting(startId) {
    patch(r => {
      const idx = r.players.findIndex(p => p.id === startId);
      const order = [...r.players.slice(idx), ...r.players.slice(0, idx)].map(p => p.id);
      r.current.voteOrder = order;
      r.current.activeVoterId = order[0];
      r.phase = 'voting';
      r.current.events = pushEvent(r.current.events, 'voting-start');
      return r;
    });
  }
  function revealAnswer(answerId) {
    patch(r => {
      r.phase = 'reveal';
      r.current.revealed[answerId] = true;
      const ans = r.current.answers.find(a => a.id === answerId);
      const voters = Object.entries(r.current.votes).filter(([, voted]) => voted === answerId).map(([pid]) => pid);
      const awardKey = `answer-${answerId}`;
      if (!r.current.awarded[awardKey]) {
        for (const voterId of voters) {
          if (ans.authorType === 'host') {
            const p = r.players.find(x => x.id === voterId); if (p) p.points += 1;
          } else if (ans.authorId !== voterId) {
            const p = r.players.find(x => x.id === ans.authorId); if (p) p.points += 1;
          }
        }
        r.current.awarded[awardKey] = true;
      }
      r.current.events = pushEvent(r.current.events, ans.authorType === 'host' ? 'host-reveal' : 'answer-reveal', { answerId, voters });
      return r;
    });
  }
  function finishRound() { patch(r => { r.phase = 'result'; r.current.events = pushEvent(r.current.events, 'round-result'); return r; }); }
  function restartTimer() { patch(r => { r.current.timerDuration = 90; r.current.timerRemaining = 90; r.current.timerStartedAt = Date.now(); r.current.timerRunning = true; r.current.events = pushEvent(r.current.events, 'timer-restart'); return r; }); }
  function stopTimer() { patch(r => { r.current.timerRemaining = getTimerRemaining(r.current); r.current.timerStartedAt = null; r.current.timerRunning = false; r.current.events = pushEvent(r.current.events, 'timer-stop'); return r; }); }
  function unlockSubmission(playerId) {
    patch(r => {
      r.current.editing = { ...(r.current.editing || {}), [playerId]: true };
      r.current.events = pushEvent(r.current.events, 'submission-unlock', { playerId });
      return r;
    });
  }
  function resetGame() { if (confirm('Aktuellen Spielstand wirklich zurücksetzen?')) patch(r => ({ ...createRoom(r.code), rounds: r.rounds })); }
  function fillTestData() {
    patch(r => {
      const demoNames = ['Testspieler 1', 'Testspieler 2', 'Testspieler 3', 'Testspieler 4'];
      const demoIcons = ['🦊', '🐧', '🐲', '⭐'];
      const makeIcon = (emoji, color) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="${color}"/><circle cx="64" cy="64" r="54" fill="rgba(255,255,255,.16)"/><text x="64" y="78" text-anchor="middle" font-size="58" font-family="Arial, sans-serif">${emoji}</text></svg>`)}`;
      r.players = r.players.map((p, i) => ({
        ...p,
        name: p.name || demoNames[i],
        connected: true,
        icon: p.icon || makeIcon(demoIcons[i], p.color || ['#ef4444', '#38bdf8', '#a78bfa', '#f59e0b'][i])
      }));

      const demoTexts = [
        'Ich bin mir sicher, dass das gleich komplett aus dem Kontext gerissen wird.',
        'Wenn du merkst, dass du die Aufgabe falsch verstanden hast, aber schon überzeugend guckst.',
        'Das ist der Moment, in dem der Plan von Anfang an keiner war.',
        'Ich würde gerne widersprechen, aber leider sieht das sehr nach mir aus.'
      ];

      if (r.phase === 'writing' || Object.keys(r.current.submissions || {}).length === 0) {
        r.players.forEach((p, i) => {
          if (!r.current.submissions[p.id]) r.current.submissions[p.id] = demoTexts[i];
        });
      }

      const hasAllSubmissions = r.players.every(p => r.current.submissions[p.id]?.trim());
      if (!r.current.answers.length && hasAllSubmissions && r.current.hostText?.trim()) {
        const items = [
          { id: crypto.randomUUID(), authorType: 'host', authorId: 'host', text: r.current.hostText },
          ...r.players.map(p => ({ id: crypto.randomUUID(), authorType: 'player', authorId: p.id, text: r.current.submissions[p.id] || '' }))
        ];
        r.current.answers = shuffle(items).map((x, i) => ({ ...x, letter: LETTERS[i] }));
        r.current.visibleAnswerCount = 5;
        r.phase = 'voting';
        r.current.timerRunning = false;
      } else if (r.current.answers.length) {
        r.current.visibleAnswerCount = 5;
      }

      if (r.current.answers.length) {
        const orderedAnswers = r.current.answers;
        const voteChoices = r.players.map((player, i) => {
          const notOwn = orderedAnswers.find(a => a.authorId !== player.id);
          return orderedAnswers[(i + 1) % orderedAnswers.length] || notOwn || orderedAnswers[0];
        });
        r.current.votes = { ...(r.current.votes || {}) };
        r.players.forEach((p, i) => {
          if (!r.current.votes[p.id] && voteChoices[i]) r.current.votes[p.id] = voteChoices[i].id;
        });
        r.current.voteOrder = r.players.map(p => p.id);
        r.current.activeVoterId = null;
      }

      r.current.events = pushEvent(r.current.events, 'test-fill');
      return r;
    });
  }

  return <div className="admin-page">
    <aside className="admin-sidebar">
      <div className="brand small"><Sparkles /> Quizshow</div>
      <div className="room-code">{code}</div>
      <button onClick={() => copy(`${location.origin}/player/${code}`, 'Spieler-Link')}><Clipboard /> Spieler-Link kopieren</button>
      <button onClick={() => copy(`${location.origin}/obs/${code}`, 'OBS-Link')}><MonitorPlay /> OBS-Link kopieren</button>
      {copyHint && <div className="copy-hint">{copyHint}</div>}
      <a className="ghost-link" href={`/obs/${code}`} target="_blank">OBS öffnen</a>
      <div className="phase-pill">{PHASES[room.phase]}</div>
      <button className="danger" onClick={resetGame}><RefreshCcw /> Reset</button>
    </aside>

    <main className="admin-main">
      <section className="panel">
        <h2><Users /> Lobby & Kameras</h2>
        <div className="host-grid">
          <PersonEditor label="Host" person={room.host} onChange={updateHost} isHost />
          {room.players.map(p => <PersonEditor key={p.id} label={`Spieler ${p.slot}`} person={p} onChange={(data) => updatePlayer(p.id, data)} />)}
        </div>
      </section>

      <section className="panel two-col">
        <div>
          <h2><ImagePlus /> Runde vorbereiten</h2>
          <input placeholder="Rundentitel" value={newRound.title} onChange={e => setNewRound({ ...newRound, title: e.target.value })} />
          <ImageInput label="Bild hochladen" value={newRound.image} onChange={(image) => setNewRound({ ...newRound, image })} />
          <textarea placeholder="Dein echter Text" value={newRound.hostText} onChange={e => setNewRound({ ...newRound, hostText: e.target.value })} />
          <input placeholder="Notiz nur für dich optional" value={newRound.note} onChange={e => setNewRound({ ...newRound, note: e.target.value })} />
          <button className="primary" onClick={addRound}><Save /> Runde speichern</button>
        </div>
        <div>
          <h2>Gespeicherte Runden</h2>
          <div className="round-list">
            {room.rounds.map(round => <div className="round-item" key={round.id}>
              <div className="thumb">{round.image ? <img src={round.image} /> : <ImagePlus />}</div>
              <div><strong>{round.title || 'Unbenannte Runde'}</strong><p>{round.hostText}</p></div>
              <button onClick={() => startRound(round)}>Starten</button>
              <button className="icon danger" onClick={() => deleteRound(round.id)}>×</button>
            </div>)}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2><Gamepad2 /> Live-Steuerung</h2>
        <div className="test-tools">
          <button onClick={fillTestData}>Testdaten auffüllen</button>
          <span>Füllt leere Spieler-Slots und in der Schreibphase fehlende Texte, damit du alleine testen kannst.</span>
        </div>
        <div className="live-workbench">
          <div className="host-preview"><ShowLayout room={room} mode="host" /></div>
          <div className="control-stack">
            <div className="control-card"><b>1. Texte sammeln</b><p>{submissionsReady ? 'Alle Texte sind da.' : 'Warte auf Spielertexte.'}</p><StatusDots room={room} /><SubmissionReview room={room} onUnlock={unlockSubmission} /><div className="timer-controls"><TimerDisplay room={room} compact /><button onClick={restartTimer}>90s neu starten</button><button onClick={stopTimer}>Timer stoppen</button></div></div>
            <div className="control-card"><b>2. Antworten einblenden</b><button disabled={!submissionsReady || !room.current.hostText} onClick={prepareAnswers}>A–E mischen</button><button disabled={room.current.answers.length !== 5 || (room.current.visibleAnswerCount || 0) >= 5} onClick={showNextAnswer}>Nächste Antwort zeigen ({Math.min((room.current.visibleAnswerCount || 0) + 1, 5)}/5)</button><InternalAnswerList room={room} /></div>
            <div className="control-card"><b>3. Abstimmung starten</b><div className="button-row">{room.players.map(p => <button key={p.id} disabled={room.current.answers.length !== 5 || (room.current.visibleAnswerCount || 0) < 5} onClick={() => startVoting(p.id)}>{p.name || `S${p.slot}`} startet</button>)}</div></div>
            <div className="control-card"><b>4. Auflösen</b><div className="button-row">{room.current.answers.map(a => <button key={a.id} className={room.current.revealed[a.id] ? 'done' : ''} onClick={() => revealAnswer(a.id)}>{a.letter}</button>)}</div><button onClick={finishRound}>Runde beenden</button></div>
          </div>
        </div>
      </section>
    </main>
  </div>
}


function SubmissionReview({ room, onUnlock }) {
  const canReview = ['writing', 'answers'].includes(room.phase);
  if (!canReview) return null;
  return <div className="submission-review">
    <div className="internal-title">Antworten prüfen</div>
    {room.players.map(player => {
      const submitted = room.current.submissions[player.id]?.trim();
      const unlocked = room.current.editing?.[player.id];
      return <div key={player.id} className={`submission-row ${submitted ? 'ready' : ''} ${unlocked ? 'unlocked' : ''}`}>
        <div className="submission-meta"><b>{player.name || `Spieler ${player.slot}`}</b>{unlocked && <span>Korrektur frei</span>}</div>
        <div className="submission-text">{submitted || 'Noch keine Antwort abgegeben.'}</div>
        <button disabled={!submitted} onClick={() => onUnlock(player.id)}>{unlocked ? 'erneut freigegeben' : 'Korrektur freigeben'}</button>
      </div>;
    })}
  </div>;
}

function InternalAnswerList({ room }) {
  if (!room.current.answers?.length) {
    return <div className="internal-answers empty">Nach dem Mischen siehst du hier intern, wer A–E geschrieben hat.</div>;
  }
  const authorName = (answer) => {
    if (answer.authorType === 'host') return room.host.name || 'Host';
    return room.players.find(p => p.id === answer.authorId)?.name || 'Unbekannter Spieler';
  };
  return <div className="internal-answers">
    <div className="internal-title">Nur für dich sichtbar</div>
    {room.current.answers.map(answer => <div key={answer.id} className={answer.authorType === 'host' ? 'internal-row host-answer' : 'internal-row'}>
      <span className="internal-letter">{answer.letter}</span>
      <span className="internal-text">{answer.text}</span>
      <span className="internal-author">{answer.authorType === 'host' ? 'Echter Text' : 'Autor'}: {authorName(answer)}</span>
    </div>)}
  </div>;
}

function PersonEditor({ label, person, onChange, isHost }) {
  return <div className="person-editor">
    <div className="editor-head"><span>{isHost ? <Crown size={16} /> : <Users size={16} />}{label}</span><span className={person.connected ? 'online' : 'offline'}>{person.connected ? 'online' : 'slot'}</span></div>
    <input placeholder="Name" value={person.name} onChange={e => onChange({ name: e.target.value })} />
    {!isHost && <input type="number" placeholder="Punkte" value={person.points} onChange={e => onChange({ points: Number(e.target.value) })} />}
    <input placeholder="VDO.Ninja View-Link" value={person.vdoUrl} onChange={e => onChange({ vdoUrl: e.target.value })} />
    <ImageInput label="Marker/Icon" value={person.icon} onChange={(icon) => onChange({ icon })} compact />
  </div>
}

function ImageInput({ label, value, onChange, compact }) {
  const ref = useRef(null);
  async function handle(file) { if (file) onChange(await fileToDataUrl(file)); }
  return <div className={compact ? 'image-input compact' : 'image-input'}>
    <button type="button" onClick={() => ref.current.click()}><Upload /> {label}</button>
    <input ref={ref} type="file" accept="image/*" hidden onChange={e => handle(e.target.files[0])} />
    {value && <img src={value} />}
  </div>
}

function StatusDots({ room }) {
  return <div className="status-dots">{room.players.map(p => <span key={p.id} className={room.current.submissions[p.id] ? 'ready' : ''}>{p.name || `S${p.slot}`}</span>)}</div>
}

function PlayerPage({ code }) {
  const [room, patch] = useRoom(code);
  const [name, setName] = useState(localStorage.getItem(`quizshow-name-${code}`) || '');
  const [playerId, setPlayerId] = useState(localStorage.getItem(`quizshow-player-${code}`) || '');
  const [text, setText] = useState('');
  useEffect(() => {
    if (!room || !playerId) return;
    const existing = room.current.submissions?.[playerId] || '';
    if (existing && !text) setText(existing);
  }, [room?.activeRoundId, playerId]);
  if (!room) return <main className="shell"><div className="panel"><h1>Raum nicht gefunden</h1><a href="/">Zur Startseite</a></div></main>;
  const me = room.players.find(p => p.id === playerId);
  const active = room.current.activeVoterId === playerId;
  function join() {
    patch(r => {
      let slot = r.players.find(p => p.id === playerId) || r.players.find(p => !p.name || p.name === name) || r.players.find(p => !p.connected);
      if (!slot) return r;
      const id = slot.id;
      r.players = r.players.map(p => p.id === id ? { ...p, name, connected: true } : p);
      localStorage.setItem(`quizshow-player-${code}`, id); localStorage.setItem(`quizshow-name-${code}`, name); setPlayerId(id);
      return r;
    });
  }
  function submitText() { patch(r => {
    r.current.submissions[playerId] = text;
    if (r.current.editing) r.current.editing[playerId] = false;
    if (r.current.answers?.length) {
      r.current.answers = r.current.answers.map(a => a.authorId === playerId ? { ...a, text } : a);
    }
    r.current.events = pushEvent(r.current.events, 'submission');
    return r;
  }); }
  function vote(answerId) {
    if (!active) return;
    patch(r => {
      r.current.votes[playerId] = answerId;
      const order = r.current.voteOrder;
      const idx = order.indexOf(playerId);
      r.current.activeVoterId = order[idx + 1] || null;
      r.current.events = pushEvent(r.current.events, 'vote', { playerId, answerId });
      return r;
    });
  }
  if (!me) return <main className="join-screen shell"><section className="hero-card small-card"><h1>Raum {code}</h1><p>Wähle deinen Namen. Das Spiel hat exakt 4 Slots.</p><input placeholder="Dein Name" value={name} onChange={e => setName(e.target.value)} /><button className="primary big" disabled={!name} onClick={join}>Beitreten / Reconnect</button></section></main>;
  return <div className="player-page">
    <ShowLayout room={room} mode="player" onVote={vote} activePlayerId={playerId} />
    <div className="player-panel">
      <h2>{PHASES[room.phase]}</h2>
      {(room.phase === 'writing' || room.current.editing?.[playerId]) && <><textarea placeholder="Dein Text zur Runde" value={text || room.current.submissions[playerId] || ''} onChange={e => setText(e.target.value)} /><button className="primary" onClick={submitText}>{room.current.editing?.[playerId] ? 'Korrektur erneut absenden' : 'Text abgeben'}</button>{room.current.editing?.[playerId] && <p className="edit-notice">Der Host hat deine Antwort zur Korrektur freigegeben. Dein bisheriger Text ist schon eingetragen.</p>}</>}
      {room.phase === 'voting' && <p>{active ? 'Du bist dran. Wähle A–E in der Tabelle.' : 'Warte auf deine Abstimmung.'}</p>}
    </div>
  </div>
}

function ObsPage({ code }) {
  const [room] = useRoom(code);
  if (!room) return <Loading />;
  return <ShowLayout room={room} mode="obs" />;
}

function ShowLayout({ room, mode, onVote, activePlayerId }) {
  const players = room.players;
  const people = [players[0], players[1], { ...room.host, id: 'host', slot: 0, name: room.host.name || 'Host', points: null, isHost: true }, players[2], players[3]];
  const activeVoter = players.find(p => p.id === room.current.activeVoterId);
  return <div className={`show-layout ${mode}`}>
    <div className="show-bg" />
    <div className="top-cams">
      {people.map(person => <CamCard key={person.id} person={person} active={person.id === room.current.activeVoterId} />)}
    </div>
    {mode !== 'obs' && <div className="show-status">
      <span>{room.current.title || PHASES[room.phase]}</span>
      {activeVoter && <b>Am Zug: {activeVoter.name}</b>}
    </div>}
    <section className="round-image-panel">
      {room.current.image ? <img src={room.current.image} /> : <div className="empty-image"><Camera /><span>Rundenbild</span></div>}
    </section>
    <section className="answers-panel">
      <div className="answers-title"><Eye /> Antworten</div>
      {room.current.answers.length ? room.current.answers.slice(0, room.current.visibleAnswerCount ?? room.current.answers.length).map(answer => <AnswerCard key={answer.id} answer={answer} room={room} onVote={onVote} canVote={mode === 'player' && room.current.activeVoterId === activePlayerId} />) : <><div className="waiting-card">Warte auf Antworten…</div><TimerDisplay room={room} /></>}
    </section>
  </div>
}


function TimerDisplay({ room, compact }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 250);
    return () => clearInterval(id);
  }, []);
  const remaining = getTimerRemaining(room.current);
  const duration = room.current.timerDuration || 90;
  const progress = Math.max(0, Math.min(1, remaining / duration));
  const isUrgent = remaining <= 10;
  const hidden = room.phase !== 'writing' && !compact;
  if (hidden) return null;
  return <div className={`timer-display ${compact ? 'compact' : ''} ${isUrgent ? 'urgent' : ''}`}>
    <div className="timer-ring" style={{ '--progress': `${progress * 360}deg` }}><Timer /><span>{formatTime(remaining)}</span></div>
    {!compact && <div className="timer-label">Zeit für eure Antworten</div>}
  </div>
}

function CamCard({ person, active }) {
  const url = normalizeVdoUrl(person.vdoUrl);
  return <div className={`cam-card ${person.isHost ? 'host' : ''} ${active ? 'active' : ''}`}>
    <div className="cam-frame">
      {url ? <iframe src={url} allow="camera;microphone;autoplay;fullscreen;display-capture" /> : <div className="cam-placeholder"><Camera /><span>{person.isHost ? 'HOST CAM' : 'CAM'}</span></div>}
    </div>
    <div className="nameplate">
      <span>{person.isHost && <Crown size={15} />} {person.name || (person.isHost ? 'Host' : `Spieler ${person.slot}`)}</span>
      {!person.isHost && <b>{person.points} P</b>}
    </div>
  </div>
}

function AnswerCard({ answer, room, onVote, canVote }) {
  const votes = Object.entries(room.current.votes).filter(([, answerId]) => answerId === answer.id).map(([pid]) => room.players.find(p => p.id === pid)).filter(Boolean);
  const revealed = room.current.revealed[answer.id];
  const author = answer.authorType === 'host' ? { name: room.host.name || 'Host', icon: room.host.icon, color: '#facc15', isHost: true } : room.players.find(p => p.id === answer.authorId);
  return <button className={`answer-card ${revealed ? 'revealed' : ''} ${revealed && answer.authorType === 'host' ? 'real' : ''}`} onClick={() => canVote && onVote?.(answer.id)} disabled={!canVote}>
    <div className={`answer-letter ${revealed ? 'reveal-token' : ''} ${revealed && answer.authorType === 'host' ? 'host-check' : ''}`}>
      {revealed ? (answer.authorType === 'host' ? <Check size={34} strokeWidth={4} /> : <PlayerMarker player={author} large />) : answer.letter}
    </div>
    <div className="answer-text">{answer.text}</div>
    <div className="vote-markers">{votes.map(p => <PlayerMarker key={p.id} player={p} />)}</div>
  </button>
}

function PlayerMarker({ player, large }) {
  if (!player) return null;
  return <span className={`marker ${large ? 'large' : ''}`} title={player.name} style={{ borderColor: player.color }}>{player.icon ? <img src={player.icon} /> : <b>{(player.name || '?').slice(0, 1).toUpperCase()}</b>}</span>
}

function pushEvent(events, type, payload = {}) { return [...(events || []).slice(-20), { id: crypto.randomUUID(), type, payload, at: Date.now() }]; }
function Loading() { return <main className="shell"><div className="panel"><h1>Lade…</h1></div></main> }

createRoot(document.getElementById('root')).render(<App />);
