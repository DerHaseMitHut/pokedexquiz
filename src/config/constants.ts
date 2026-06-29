import type { Player, RoundDef } from '../types/room';
import type { SoundSettings } from '../types/sound';

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export const PHASES: Record<string, string> = {
  lobby: 'Lobby',
  writing: 'Texte schreiben',
  answers: 'Antworten sichtbar',
  voting: 'Abstimmung',
  reveal: 'Auflösung',
  result: 'Rundenergebnis',
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  sounds: true,
  volume: 55,
  timerVolume: 35,
  events: {
    timerTick: true,
    answerShow: true,
    answerReveal: true,
    voteCast: true,
    scoreAward: true,
  },
};

export const defaultPlayers: Player[] = [1, 2, 3, 4].map((slot) => ({
  id: `p${slot}`,
  slot: slot as 1 | 2 | 3 | 4,
  name: '',
  connected: false,
  points: 0,
  vdoUrl: '',
  icon: '',
  color: ['#ef4444', '#38bdf8', '#a78bfa', '#f59e0b'][slot - 1],
}));

export const demoRounds: RoundDef[] = [
  {
    id: crypto.randomUUID(),
    title: 'Beispielrunde: Verdächtiger Blick',
    image: '',
    hostText: 'Wenn du so tust, als hättest du den Plan verstanden, aber gerade erst beigetreten bist.',
    note: 'Demo-Runde',
  },
];
