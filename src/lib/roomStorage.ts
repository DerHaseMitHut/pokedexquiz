import { defaultPlayers, demoRounds } from '../config/constants';
import { soundSettings } from './utils';
import { saveRoomRemote } from './roomSync';
import type { Room } from '../types/room';

export function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function createRoom(code = randomCode()): Room {
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
      events: [],
    },
    settings: soundSettings(),
  };
}

export function storageKey(code: string): string {
  return `quizshow-room-${code}`;
}

export function listKey(): string {
  return 'quizshow-room-list';
}

export function saveRoom(room: Room): void {
  localStorage.setItem(storageKey(room.code), JSON.stringify(room));
  const list = JSON.parse(localStorage.getItem(listKey()) || '[]') as string[];
  if (!list.includes(room.code))
    localStorage.setItem(listKey(), JSON.stringify([room.code, ...list].slice(0, 20)));
  window.dispatchEvent(new CustomEvent('room-updated', { detail: room }));
  try {
    new BroadcastChannel(`quizshow-${room.code}`).postMessage(room);
  } catch {}
  saveRoomRemote(room);
}

export function loadRoom(code: string): Room | null {
  const raw = localStorage.getItem(storageKey(code));
  return raw ? (JSON.parse(raw) as Room) : null;
}
