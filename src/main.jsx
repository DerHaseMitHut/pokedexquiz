import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { createClient } from '@supabase/supabase-js';
import { Camera, Check, Clipboard, Crown, Eye, Gamepad2, ImagePlus, MonitorPlay, Plus, RefreshCcw, Save, Settings, Sparkles, Timer, Upload, Users } from 'lucide-react';
import './styles.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const DEFAULT_SOUND_SETTINGS = {
  sounds: true,
  volume: 55,
  timerVolume: 35,
  events: {
    timerTick: true,
    answerShow: true,
    answerReveal: true,
    voteCast: true,
    scoreAward: true
  }
};

function soundSettings(settings = {}) {
  return {
    ...DEFAULT_SOUND_SETTINGS,
    ...settings,
    events: { ...DEFAULT_SOUND_SETTINGS.events, ...(settings.events || {}) }
  };
}

function volumePercent(value, fallback = 55) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return value <= 1 ? Math.round(value * 100) : value;
}

function volumeToGain(value, fallback = 55) {
  const percent = Math.max(0, Math.min(200, volumePercent(value, fallback)));
  if (percent <= 0) return 0;
  // Quadratic curve gives much finer control at low/medium volume than a linear slider.
  return Math.min(1, Math.pow(percent / 200, 2));
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xfsirzvqpypbxxymznct.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SjLbqIxvkHwNKKWeCgZKYQ_yzhe-sAm';
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const API_BASE = import.meta.env.VITE_API_URL || (!supabase && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:3001' : '');
let socket;
function getSocket() {
  if (!API_BASE) return null;
  if (!socket) socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  return socket;
}
async function fetchRoomRemote(code) {
  if (!code) return null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from('quiz_rooms').select('state').eq('code', code).maybeSingle();
      if (error) { console.warn('Supabase fetch failed:', error.message); return null; }
      return data?.state || null;
    } catch (error) { console.warn('Supabase fetch failed:', error); return null; }
  }
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/rooms/${code}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
async function saveRoomRemote(room) {
  if (!room?.code) return;
  if (supabase) {
    try {
      const { error } = await supabase.from('quiz_rooms').upsert({ code: room.code, state: room }, { onConflict: 'code' });
      if (error) console.warn('Supabase save failed:', error.message);
    } catch (error) { console.warn('Supabase save failed:', error); }
    return;
  }
  if (!API_BASE) return;
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
    settings: soundSettings()
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
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

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

    let channel;
    if (supabase) {
      channel = supabase
        .channel(`quiz-room-${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_rooms', filter: `code=eq.${code}` }, payload => {
          const next = payload.new?.state;
          if (next?.code === code) {
            localStorage.setItem(storageKey(code), JSON.stringify(next));
            setRoom(next);
          }
        })
        .subscribe();
    }

    const s = getSocket();
    const onSocketUpdate = (next) => {
      if (next?.code === code) {
        localStorage.setItem(storageKey(code), JSON.stringify(next));
        setRoom(next);
      }
    };
    if (s) { s.emit('room:join', code); s.on('room:update', onSocketUpdate); }

    const t = !supabase ? setInterval(async () => {
      const remote = await fetchRoomRemote(code);
      if (remote && mounted) {
        localStorage.setItem(storageKey(code), JSON.stringify(remote));
        setRoom(remote);
      } else update();
    }, 2000) : null;

    return () => {
      mounted = false;
      window.removeEventListener('storage', update);
      window.removeEventListener('room-updated', onCustom);
      if (t) clearInterval(t);
      if (bc) bc.close();
      if (s) s.off('room:update', onSocketUpdate);
      if (channel) supabase.removeChannel(channel);
    };
  }, [code]);

  const patch = (fn) => {
    const fresh = loadRoom(code) || roomRef.current || room;
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
  const [editingRoundId, setEditingRoundId] = useState(null);
  const [editingRound, setEditingRound] = useState({ title: '', image: '', hostText: '', note: '' });
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
  function updateSettings(data) { patch(r => { r.settings = soundSettings({ ...(r.settings || {}), ...data, events: { ...(r.settings?.events || {}), ...(data.events || {}) } }); return r; }); }
  function addRound() {
    if (!newRound.title && !newRound.hostText && !newRound.image) return;
    patch(r => { r.rounds.push({ ...newRound, id: crypto.randomUUID() }); return r; });
    setNewRound({ title: '', image: '', hostText: '', note: '' });
  }
  function deleteRound(id) { patch(r => { r.rounds = r.rounds.filter(x => x.id !== id); return r; }); }
  function beginEditRound(round) {
    setEditingRoundId(round.id);
    setEditingRound({ title: round.title || '', image: round.image || '', hostText: round.hostText || '', note: round.note || '' });
  }
  function saveEditedRound() {
    if (!editingRoundId) return;
    patch(r => {
      r.rounds = r.rounds.map(round => round.id === editingRoundId ? { ...round, ...editingRound } : round);
      return r;
    });
    setEditingRoundId(null);
    setEditingRound({ title: '', image: '', hostText: '', note: '' });
  }
  function cancelEditRound() {
    setEditingRoundId(null);
    setEditingRound({ title: '', image: '', hostText: '', note: '' });
  }
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
      const awards = {};
      if (ans && !r.current.awarded[awardKey]) {
        if (ans.authorType === 'host') {
          for (const voterId of voters) awards[voterId] = (awards[voterId] || 0) + 1;
        } else {
          const validVotes = voters.filter(voterId => voterId !== ans.authorId).length;
          if (validVotes > 0) awards[ans.authorId] = validVotes;
        }
        for (const [pid, amount] of Object.entries(awards)) {
          const p = r.players.find(x => x.id === pid);
          if (p) p.points += amount;
        }
        r.current.awarded[awardKey] = true;
      }
      r.current.events = pushEvent(r.current.events, ans?.authorType === 'host' ? 'host-reveal' : 'answer-reveal', { answerId, voters, awards });
      if (Object.keys(awards).length) r.current.events = pushEvent(r.current.events, 'score-award', { answerId, awards });
      return r;
    });
  }
  function finishRound() {
    patch(r => {
      const previousEvents = r.current.events || [];
      r.phase = 'result';
      r.activeRoundId = null;
      r.current = {
        ...r.current,
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
        timerRemaining: 90,
        events: pushEvent(previousEvents, 'round-result')
      };
      return r;
    });
  }
  function restartTimer() { patch(r => { r.current.timerDuration = 90; r.current.timerRemaining = 90; r.current.timerStartedAt = Date.now(); r.current.timerRunning = true; r.current.events = pushEvent(r.current.events, 'timer-restart'); return r; }); }
  function stopTimer() { patch(r => { r.current.timerRemaining = getTimerRemaining(r.current); r.current.timerStartedAt = null; r.current.timerRunning = false; r.current.events = pushEvent(r.current.events, 'timer-stop'); return r; }); }
  function resetTimer() { patch(r => { r.current.timerDuration = 90; r.current.timerRemaining = 90; r.current.timerStartedAt = null; r.current.timerRunning = false; r.current.events = pushEvent(r.current.events, 'timer-reset'); return r; }); }
  function testSound() { patch(r => { r.current.events = pushEvent(r.current.events, 'sound-test'); return r; }); }
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

      // Wichtig: Testdaten bereiten nur Spieler, Icons und Beispieltexte vor.
      // Antworten werden weiterhin manuell mit „A–E mischen" und „Nächste Antwort zeigen" eingeblendet,
      // damit der echte Ablauf getestet werden kann.
      r.current.events = pushEvent(r.current.events, 'test-fill');
      return r;
    });
  }

  function castTestVote() {
    patch(r => {
      if (r.phase !== 'voting' || !r.current.activeVoterId || !r.current.answers?.length) return r;
      const voterId = r.current.activeVoterId;
      const order = r.current.voteOrder?.length ? r.current.voteOrder : r.players.map(p => p.id);
      const idx = Math.max(0, order.indexOf(voterId));
      const hostAnswer = r.current.answers.find(a => a.authorType === 'host');
      const playerAnswers = r.current.answers.filter(a => a.authorType === 'player');

      // Demonstration: Die ersten zwei Testspieler wählen bewusst dieselbe Antwort,
      // damit sichtbar ist, dass mehrere Marker auf einer Antwort liegen können.
      const demoChoice = idx < 2
        ? (hostAnswer || r.current.answers[0])
        : (playerAnswers.find(a => a.authorId !== voterId) || hostAnswer || r.current.answers[idx % r.current.answers.length]);

      if (!demoChoice) return r;
      r.current.votes = { ...(r.current.votes || {}), [voterId]: demoChoice.id };
      r.current.activeVoterId = order[idx + 1] || null;
      r.current.events = pushEvent(r.current.events, 'vote', { playerId: voterId, answerId: demoChoice.id, test: true });
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
      <SoundSettingsCard room={room} onChange={updateSettings} onTest={testSound} compact />
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
            {room.rounds.map(round => editingRoundId === round.id ? <div className="round-item editing" key={round.id}>
              <div className="round-edit-form">
                <input placeholder="Rundentitel" value={editingRound.title} onChange={e => setEditingRound({ ...editingRound, title: e.target.value })} />
                <ImageInput label="Bild ändern" value={editingRound.image} onChange={(image) => setEditingRound({ ...editingRound, image })} />
                <textarea placeholder="Dein echter Text" value={editingRound.hostText} onChange={e => setEditingRound({ ...editingRound, hostText: e.target.value })} />
                <input placeholder="Notiz nur für dich optional" value={editingRound.note} onChange={e => setEditingRound({ ...editingRound, note: e.target.value })} />
                <div className="button-row"><button className="primary" onClick={saveEditedRound}>Änderungen speichern</button><button onClick={cancelEditRound}>Abbrechen</button></div>
              </div>
            </div> : <div className="round-item" key={round.id}>
              <div className="thumb">{round.image ? <img src={round.image} /> : <ImagePlus />}</div>
              <div><strong>{round.title || 'Unbenannte Runde'}</strong><p>{round.hostText}</p></div>
              <button onClick={() => startRound(round)}>Starten</button>
              <button onClick={() => beginEditRound(round)}>Bearbeiten</button>
              <button className="icon danger" onClick={() => deleteRound(round.id)}>×</button>
            </div>)}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2><Gamepad2 /> Live-Steuerung</h2>
        <div className="test-tools">
          <button onClick={fillTestData}>Testdaten auffüllen</button>
          <span>Füllt leere Spieler-Slots, Platzhalter-Icons und in der Schreibphase fehlende Texte. Antworten und Stimmen bleiben manuell steuerbar.</span>
        </div>
        <div className="live-workbench">
          <div className="host-preview"><ShowLayout room={room} mode="host" /></div>
          <div className="control-stack">
            <div className="control-card"><b>1. Texte sammeln</b><p>{submissionsReady ? 'Alle Texte sind da.' : 'Warte auf Spielertexte.'}</p><StatusDots room={room} /><SubmissionReview room={room} onUnlock={unlockSubmission} /><div className="timer-controls"><TimerDisplay room={room} compact /><button onClick={restartTimer}>90s neu starten</button><button onClick={stopTimer}>Timer stoppen</button><button onClick={resetTimer}>Timer auf 1:30 setzen</button></div></div>
            <div className="control-card"><b>2. Antworten einblenden</b><button disabled={!submissionsReady || !room.current.hostText} onClick={prepareAnswers}>A–E mischen</button><button disabled={room.current.answers.length !== 5 || (room.current.visibleAnswerCount || 0) >= 5} onClick={showNextAnswer}>Nächste Antwort zeigen ({Math.min((room.current.visibleAnswerCount || 0) + 1, 5)}/5)</button><InternalAnswerList room={room} /></div>
            <div className="control-card"><b>3. Abstimmung starten</b><div className="button-row">{room.players.map(p => <button key={p.id} disabled={room.current.answers.length !== 5 || (room.current.visibleAnswerCount || 0) < 5} onClick={() => startVoting(p.id)}>{p.name || `S${p.slot}`} startet</button>)}</div><button disabled={room.phase !== 'voting' || !room.current.activeVoterId} onClick={castTestVote}>Nächste Teststimme abgeben</button><p className="mini-hint">Zum Testen der Marker. Mehrere Spieler können dieselbe Antwort wählen.</p></div>
            <div className="control-card"><b>4. Auflösen</b><div className="button-row">{room.current.answers.map(a => <button key={a.id} className={room.current.revealed[a.id] ? 'done' : ''} onClick={() => revealAnswer(a.id)}>{a.letter}</button>)}</div><button onClick={finishRound}>Runde beenden</button></div>
          </div>
        </div>
      </section>
    </main>
  </div>
}


function SoundSettingsCard({ room, onChange, onTest, compact }) {
  const settings = soundSettings(room.settings);
  const setEvent = (key, value) => onChange({ events: { [key]: value } });
  const [previewAudio, setPreviewAudio] = useState(null);
  useEffect(() => () => { if (previewAudio) previewAudio.pause(); }, [previewAudio]);

  function testTimerAudio() {
    if (!settings.timerAudio) return;
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      setPreviewAudio(null);
      return;
    }
    const audio = playCustomAudio(settings.timerAudio, settings.timerVolume ?? 35, true);
    if (audio) {
      setPreviewAudio(audio);
      audio.addEventListener('ended', () => setPreviewAudio(null), { once: true });
    }
  }

  return <details className={`sound-settings-card ${compact ? 'sidebar-sound' : 'control-card'}`} open={!compact}>
    <summary>Sound-Einstellungen</summary>
    <label className="toggle-row"><input type="checkbox" checked={settings.sounds !== false} onChange={e => onChange({ sounds: e.target.checked })} /> Sounds aktiv</label>
    <label className="range-row volume-row"><span>Show-Sounds <b>{volumePercent(settings.volume, 55)}%</b></span><input type="range" min="0" max="200" step="2" value={volumePercent(settings.volume, 55)} onChange={e => onChange({ volume: Number(e.target.value) })} /></label>
    <label className="range-row volume-row"><span>Timer-Musik <b>{volumePercent(settings.timerVolume, 35)}%</b></span><input type="range" min="0" max="200" step="2" value={volumePercent(settings.timerVolume, 35)} onChange={e => onChange({ timerVolume: Number(e.target.value) })} /></label>
    <div className="sound-toggle-grid">
      <label><input type="checkbox" checked={settings.events.timerTick} onChange={e => setEvent('timerTick', e.target.checked)} /> Timer-Musik</label>
      <label><input type="checkbox" checked={settings.events.answerShow} onChange={e => setEvent('answerShow', e.target.checked)} /> Antworten einblenden</label>
      <label><input type="checkbox" checked={settings.events.answerReveal} onChange={e => setEvent('answerReveal', e.target.checked)} /> Antworten auflösen</label>
      <label><input type="checkbox" checked={settings.events.voteCast} onChange={e => setEvent('voteCast', e.target.checked)} /> Kandidat wählt Antwort</label>
      <label><input type="checkbox" checked={settings.events.scoreAward} onChange={e => setEvent('scoreAward', e.target.checked)} /> Punktevergabe</label>
    </div>
    <AudioInput value={settings.timerAudio} name={settings.timerAudioName} onChange={(timerAudio, timerAudioName) => { if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); } onChange({ timerAudio, timerAudioName }); }} />
    <div className="sound-buttons"><button onClick={onTest}>Show-Sound testen</button>{settings.timerAudio && <button onClick={testTimerAudio}>{previewAudio ? 'Timer-Test stoppen' : 'Timer-Melodie testen'}</button>}</div>
  </details>;
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



function AudioInput({ value, name, onChange }) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handle(file) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      if (supabase) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-90) || 'timer-audio';
        const path = `timer-audio/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('quiz-assets')
          .upload(path, file, { contentType: file.type || 'audio/mpeg', upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('quiz-assets').getPublicUrl(path);
        onChange(data.publicUrl, file.name);
      } else {
        onChange(await fileToDataUrl(file), file.name);
      }
    } catch (err) {
      console.error('Timer audio upload failed:', err);
      setError('Upload fehlgeschlagen. Bitte kleinere MP3/WAV/OGG-Datei testen.');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return <div className="audio-input">
    <button type="button" disabled={uploading} onClick={() => ref.current.click()}><Upload /> {uploading ? 'Timer-Melodie lädt…' : 'Timer-Melodie wählen'}</button>
    <input ref={ref} type="file" accept="audio/*" hidden onChange={e => handle(e.target.files[0])} />
    {error && <div className="audio-error">{error}</div>}
    {value && <div className="audio-file-row"><span>{name || 'Eigene Timer-Melodie aktiv'}</span><button type="button" onClick={() => onChange('', '')}>Entfernen</button></div>}
  </div>;
}

function StatusDots({ room }) {
  return <div className="status-dots">{room.players.map(p => <span key={p.id} className={room.current.submissions[p.id] ? 'ready' : ''}>{p.name || `S${p.slot}`}</span>)}</div>
}

function PlayerPage({ code }) {
  const [room, patch] = useRoom(code);
  const [name, setName] = useState(localStorage.getItem(`quizshow-name-${code}`) || '');
  const [playerId, setPlayerId] = useState(localStorage.getItem(`quizshow-player-${code}`) || '');
  const [text, setText] = useState('');
  const [viewMode, setViewMode] = useState(localStorage.getItem(`quizshow-player-view-${code}`) || 'fullhd');
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [pendingVoteId, setPendingVoteId] = useState(null);
  useEffect(() => {
    if (!room || !playerId) return;
    const existing = room.current.submissions?.[playerId] || '';
    setText(existing.slice(0, 200));
    setSubmitConfirmOpen(false);
    setPendingVoteId(null);
  }, [room?.activeRoundId, room?.phase, playerId]);
  if (!room) return <main className="shell"><div className="panel"><h1>Raum nicht gefunden</h1><a href="/">Zur Startseite</a></div></main>;
  const me = room.players.find(p => p.id === playerId);
  const active = room.current.activeVoterId === playerId;
  const isEditing = !!room.current.editing?.[playerId];
  const hasSubmitted = !!room.current.submissions?.[playerId]?.trim() && !isEditing;
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
  function submitText() {
    const safeText = (text || '').slice(0, 200).trim();
    if (!safeText || hasSubmitted) return;
    patch(r => {
      r.current.submissions[playerId] = safeText;
      if (r.current.editing) r.current.editing[playerId] = false;
      if (r.current.answers?.length) {
        r.current.answers = r.current.answers.map(a => a.authorId === playerId ? { ...a, text: safeText } : a);
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
  function requestVote(answerId) {
    if (!active) return;
    setPendingVoteId(answerId);
  }
  function confirmVote(answerId) {
    if (!active) return;
    patch(r => {
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
  if (!me) return <main className="join-screen shell"><section className="hero-card small-card"><h1>Raum {code}</h1><p>Wähle deinen Namen. Das Spiel hat exakt 4 Slots.</p><input placeholder="Dein Name" value={name} onChange={e => setName(e.target.value)} /><button className="primary big" disabled={!name} onClick={join}>Beitreten / Reconnect</button></section></main>;
  const showTextInput = room.phase === 'writing' || isEditing;
  const playerControls = showTextInput ? {
    text,
    setText,
    submitText,
    requestSubmit,
    submitConfirmOpen,
    setSubmitConfirmOpen,
    isEditing,
    hasSubmitted,
    canSubmit: !hasSubmitted && !!text.trim(),
    charCount: text.length
  } : null;
  return <div className={`player-page player-res-${viewMode}`}>
    <ShowLayout room={room} mode="player" onVote={requestVote} onConfirmVote={confirmVote} onCancelVote={() => setPendingVoteId(null)} pendingVoteId={pendingVoteId} activePlayerId={playerId} viewMode={viewMode} onToggleViewMode={toggleViewMode} playerControls={playerControls} />
  </div>
}

function ObsPage({ code }) {
  const [room] = useRoom(code);
  if (!room) return <Loading />;
  return <ShowLayout room={room} mode="obs" />;
}

function ShowLayout({ room, mode, onVote, onConfirmVote, onCancelVote, pendingVoteId, activePlayerId, viewMode, onToggleViewMode, playerControls }) {
  const players = room.players;
  const people = [players[0], players[1], { ...room.host, id: 'host', slot: 0, name: room.host.name || 'Host', points: null, isHost: true }, players[2], players[3]];
  const activeVoter = players.find(p => p.id === room.current.activeVoterId);
  const scoreEffects = useScoreEffects(room);
  const isPlayerWriting = mode === 'player' && playerControls;
  return <div className={`show-layout ${mode} ${isPlayerWriting ? 'player-writing' : ''}`}>
    <SoundEngine room={room} />
    <div className="show-bg" />
    <div className="top-cams">
      {people.map(person => <CamCard key={person.id} person={person} active={person.id === room.current.activeVoterId} scoreEffect={scoreEffects[person.id]} />)}
    </div>
    {mode === 'host' && <div className="show-status">
      <span>{room.current.title || PHASES[room.phase]}</span>
      {activeVoter && <b>Am Zug: {activeVoter.name}</b>}
    </div>}
    <section className="round-image-panel">
      {room.current.image ? <img src={room.current.image} /> : <div className="empty-image"><span>Pokémon</span></div>}
    </section>
    <section className="answers-panel">
      <div className="answers-title"><Eye /> Antworten {mode === 'player' && <button className="player-view-toggle" type="button" onClick={onToggleViewMode} title={`Ansicht: ${viewMode === 'fullhd' ? 'FullHD' : '4K'}`}><Settings size={20} /> <span>{viewMode === 'fullhd' ? 'FullHD' : '4K'}</span></button>}</div>
      {isPlayerWriting ? <><TimerDisplay room={room} /><PlayerWritingPanel controls={playerControls} /></> : room.current.answers.length ? room.current.answers.slice(0, room.current.visibleAnswerCount ?? room.current.answers.length).map(answer => <AnswerCard key={answer.id} answer={answer} room={room} onVote={onVote} onConfirmVote={onConfirmVote} onCancelVote={onCancelVote} pendingVote={pendingVoteId === answer.id} canVote={mode === 'player' && room.current.activeVoterId === activePlayerId} />) : <><div className="waiting-card">Warte auf Antworten…</div><TimerDisplay room={room} /></>}
    </section>
  </div>
}


function PlayerWritingPanel({ controls }) {
  const buttonLabel = controls.isEditing ? 'Korrektur erneut absenden' : controls.hasSubmitted ? 'Antwort abgegeben' : 'Text abgeben';
  return <div className="player-writing-panel">
    <div className="player-writing-title">{controls.isEditing ? 'Korrektur' : controls.hasSubmitted ? 'Antwort abgegeben' : 'Antwort schreiben'}</div>
    <div className="answer-input-wrap"><textarea maxLength={200} placeholder="Dein Text zur Runde" value={controls.text} disabled={controls.hasSubmitted} onChange={e => controls.setText(e.target.value.slice(0, 200))} /><div className="char-counter">{controls.charCount} / 200 Zeichen</div></div>
    <button className="primary" disabled={!controls.canSubmit} onClick={controls.requestSubmit}>{buttonLabel}</button>
    {controls.submitConfirmOpen && <div className="inline-confirm submit-confirm"><span>Antwort so abschicken?</span><div className="inline-confirm-actions"><button type="button" className="confirm-yes" onClick={controls.submitText}>Ja</button><button type="button" className="confirm-no" onClick={() => controls.setSubmitConfirmOpen(false)}>Nein</button></div></div>}
    {controls.isEditing && <p className="edit-notice">Der Host hat deine Antwort zur Korrektur freigegeben. Dein bisheriger Text ist schon eingetragen.</p>}
  </div>;
}

function useScoreEffects(room) {
  const [effects, setEffects] = useState({});
  const lastScoreEventId = useRef(null);
  useEffect(() => {
    const latestScore = [...(room.current.events || [])].reverse().find(e => e.type === 'score-award');
    if (!latestScore || latestScore.id === lastScoreEventId.current) return;
    lastScoreEventId.current = latestScore.id;
    const awards = latestScore.payload?.awards || {};
    if (!Object.keys(awards).length) return;
    const next = {};
    for (const [playerId, amount] of Object.entries(awards)) {
      next[playerId] = { amount: Number(amount || 0), eventId: latestScore.id };
    }
    setEffects(next);
    const timer = setTimeout(() => setEffects(current => {
      const stillCurrent = Object.values(current).some(e => e.eventId === latestScore.id);
      return stillCurrent ? {} : current;
    }), 1800);
    return () => clearTimeout(timer);
  }, [room.current.events]);
  return effects;
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
  const hidden = !compact && !['writing', 'lobby', 'result'].includes(room.phase);
  if (hidden) return null;
  return <div className={`timer-display ${compact ? 'compact' : ''} ${isUrgent ? 'urgent' : ''}`}>
    <div className="timer-ring" style={{ '--progress': `${progress * 360}deg` }}><Timer /><span>{formatTime(remaining)}</span></div>
    {!compact && <div className="timer-label">Zeit für eure Antworten</div>}
  </div>
}

function CamCard({ person, active, scoreEffect }) {
  const url = normalizeVdoUrl(person.vdoUrl);
  const awardAmount = Number(scoreEffect?.amount || 0);
  const scoreKey = scoreEffect?.eventId || 'idle';
  return <div className={`cam-card ${person.isHost ? 'host' : ''} ${active ? 'active' : ''} ${awardAmount ? 'score-hit' : ''}`} data-score-event={scoreKey}>
    <div className="cam-frame" key={`frame-${scoreKey}`}>
      {url ? <iframe src={url} allow="camera;microphone;autoplay;fullscreen;display-capture" /> : <div className="cam-placeholder"><Camera /><span>{person.isHost ? 'HOST CAM' : 'CAM'}</span></div>}
    </div>
    <div className="nameplate">
      <span className="name-icon">{!person.isHost && <PlayerMarker player={person} small home />} {person.isHost && <Crown size={15} />}</span>
      <span className="name-text">{person.name || (person.isHost ? 'Host' : `Spieler ${person.slot}`)}</span>
      {!person.isHost && <b className="score-badge" key={`badge-${scoreKey}`}>{person.points} P</b>}
      {awardAmount > 0 && <em className="score-pop" key={`pop-${scoreKey}`}>+{awardAmount}</em>}
    </div>
  </div>
}

function AnswerCard({ answer, room, onVote, onConfirmVote, onCancelVote, pendingVote, canVote }) {
  const votes = Object.entries(room.current.votes).filter(([, answerId]) => answerId === answer.id).map(([pid]) => room.players.find(p => p.id === pid)).filter(Boolean);
  const revealed = room.current.revealed[answer.id];
  const author = answer.authorType === 'host' ? { name: room.host.name || 'Host', icon: room.host.icon, color: '#facc15', isHost: true } : room.players.find(p => p.id === answer.authorId);
  return <div className={`answer-card ${revealed ? 'revealed' : ''} ${revealed && answer.authorType === 'host' ? 'real' : ''} ${canVote ? 'clickable' : ''} ${pendingVote ? 'pending-vote' : ''}`} onClick={() => canVote && onVote?.(answer.id)} role={canVote ? 'button' : undefined} tabIndex={canVote ? 0 : undefined} onKeyDown={e => { if (canVote && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onVote?.(answer.id); } }}>
    <div className={`answer-letter ${revealed ? 'reveal-token' : ''} ${revealed && answer.authorType === 'host' ? 'host-check' : ''}`}>
      {revealed ? (answer.authorType === 'host' ? <Check size={34} strokeWidth={4} /> : <PlayerMarker player={author} large />) : answer.letter}
    </div>
    <div className="answer-main">
      <div className="answer-text">{answer.text}</div>
      {pendingVote && <div className="inline-confirm vote-confirm" onClick={e => e.stopPropagation()}><span>Hierfür abstimmen?</span><div className="inline-confirm-actions"><button type="button" className="confirm-yes" onClick={() => onConfirmVote?.(answer.id)}>Ja</button><button type="button" className="confirm-no" onClick={() => onCancelVote?.()}>Nein</button></div></div>}
    </div>
    <div className="vote-markers">{votes.map((p, index) => <PlayerMarker key={p.id} player={p} fly style={{ '--fly-delay': `${index * 70}ms` }} />)}</div>
  </div>
}

function PlayerMarker({ player, large, small, home, fly, style }) {
  if (!player) return null;
  const classes = ['marker', large ? 'large' : '', small ? 'small' : '', home ? 'home-marker' : '', fly ? 'fly-marker' : ''].filter(Boolean).join(' ');
  return <span className={classes} title={player.name} style={{ borderColor: player.color, ...(style || {}) }}>{player.icon ? <img src={player.icon} /> : <b>{(player.name || '?').slice(0, 1).toUpperCase()}</b>}</span>
}


function SoundEngine({ room }) {
  const lastEventId = useRef(room.current.events?.at(-1)?.id || null);
  const lastTickSecond = useRef(null);
  const customTimerAudioRef = useRef(null);
  const settings = soundSettings(room.settings);
  useEffect(() => {
    const latest = room.current.events?.at(-1);
    if (!latest || latest.id === lastEventId.current) return;
    lastEventId.current = latest.id;
    if (settings.sounds === false) return;
    if (shouldPlayEventSound(latest.type, settings)) {
      playUiSound(latest.type, settings.volume ?? 55);
    }
  }, [room.current.events, room.settings]);

  useEffect(() => {
    if (customTimerAudioRef.current) {
      customTimerAudioRef.current.pause();
      customTimerAudioRef.current = null;
    }
    if (settings.sounds === false || !settings.events?.timerTick) return;
    if (!room.current.timerRunning || room.current.answers?.length) return;
    if (settings.timerAudio) {
      const audio = new Audio(settings.timerAudio);
      audio.loop = true;
      audio.volume = volumeToGain(settings.timerVolume, 35);
      customTimerAudioRef.current = audio;
      audio.play().catch(() => {});
      const stopAtZero = window.setInterval(() => {
        if (getTimerRemaining(room.current) <= 0) {
          audio.pause();
          audio.currentTime = 0;
          customTimerAudioRef.current = null;
          window.clearInterval(stopAtZero);
        }
      }, 250);
      return () => {
        window.clearInterval(stopAtZero);
        audio.pause();
        customTimerAudioRef.current = null;
      };
    }
    const tick = () => {
      const remaining = getTimerRemaining(room.current);
      const second = Math.ceil(remaining);
      if (second > 0 && second !== lastTickSecond.current) {
        lastTickSecond.current = second;
        playUiSound('timer-tick', Math.min(200, volumePercent(settings.timerVolume, 35) * (second <= 10 ? .75 : .32)));
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [room.current.timerRunning, room.current.timerStartedAt, room.current.timerRemaining, room.current.answers?.length, room.settings]);
  return null;
}

function shouldPlayEventSound(type, settings) {
  if (type === 'sound-test') return true;
  if (type === 'answer-show') return !!settings.events?.answerShow;
  if (type === 'answer-reveal' || type === 'host-reveal') return !!settings.events?.answerReveal;
  if (type === 'vote') return !!settings.events?.voteCast;
  if (type === 'score-award') return !!settings.events?.scoreAward;
  return false;
}

let audioContext;
function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function playCustomAudio(src, volume = 55, loop = false) {
  if (!src) return;
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = volumeToGain(volume, 55);
  audio.play().catch(() => {});
  return audio;
}

function playUiSound(type, volume = 55) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const v = volumeToGain(volume, 55);
  const presets = {
    'sound-test': [[520, 0, .09], [780, .09, .12]],
    'timer-tick': [[980, 0, .025]],
    'round-start': [[392, 0, .10], [523, .11, .12], [784, .23, .16]],
    'submission': [[660, 0, .07]],
    'answers-prepared': [[330, 0, .06], [440, .07, .06]],
    'answer-show': [[520, 0, .055], [690, .06, .06]],
    'voting-start': [[440, 0, .08], [590, .09, .10]],
    'vote': [[760, 0, .06]],
    'answer-reveal': [[300, 0, .08], [520, .09, .12]],
    'host-reveal': [[523, 0, .08], [659, .09, .08], [880, .18, .18]],
    'round-result': [[440, 0, .08], [660, .1, .08], [880, .2, .16]],
    'score-award': [[880, 0, .08], [1175, .09, .12]],
    'timer-restart': [[620, 0, .06]],
    'timer-stop': [[260, 0, .08]],
    'timer-reset': [[310, 0, .06], [310, .07, .06]],
    'submission-unlock': [[720, 0, .05], [480, .06, .08]],
    'test-fill': [[360, 0, .05], [460, .06, .05]]
  };
  const sequence = presets[type] || [[500, 0, .06]];
  const master = ctx.createGain();
  master.gain.value = 0.16 * v;
  master.connect(ctx.destination);
  const now = ctx.currentTime;
  sequence.forEach(([freq, delay, dur]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === 'host-reveal' || type === 'round-result' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(1, now + delay + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
    osc.connect(gain).connect(master);
    osc.start(now + delay);
    osc.stop(now + delay + dur + 0.03);
  });
}

function pushEvent(events, type, payload = {}) { return [...(events || []).slice(-20), { id: crypto.randomUUID(), type, payload, at: Date.now() }]; }
function Loading() { return <main className="shell"><div className="panel"><h1>Lade…</h1></div></main> }

createRoot(document.getElementById('root')).render(<App />);
