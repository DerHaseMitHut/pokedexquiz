import type { Answer } from './answers';
import type { GameEvent } from './events';
import type { SoundSettings } from './sound';

export type GamePhase = 'lobby' | 'writing' | 'answers' | 'voting' | 'reveal' | 'result';

export interface Player {
  id: string;
  slot: 1 | 2 | 3 | 4;
  name: string;
  connected: boolean;
  points: number;
  vdoUrl: string;
  icon: string;
  color: string;
}

export interface Host {
  name: string;
  points: number;
  vdoUrl: string;
  icon: string;
  color: string;
}

export interface HostCard extends Omit<Host, 'points'> {
  id: 'host';
  slot: 0;
  isHost: true;
  points: null;
}

export type PersonCard = Player | HostCard;

export interface RoundDef {
  id: string;
  title: string;
  image: string;
  hostText: string;
  note: string;
}

export interface CurrentState {
  image: string;
  title: string;
  hostText: string;
  submissions: Record<string, string>;
  drafts: Record<string, string>;
  answers: Answer[];
  votes: Record<string, string>;
  revealed: Record<string, boolean>;
  voteOrder: string[];
  activeVoterId: string | null;
  awarded: Record<string, boolean>;
  visibleAnswerCount: number;
  editing: Record<string, boolean>;
  timerDuration: number;
  timerStartedAt: number | null;
  timerRunning: boolean;
  timerRemaining?: number;
  events: GameEvent[];
}

export interface Room {
  code: string;
  createdAt: number;
  phase: GamePhase;
  activeRoundId: string | null;
  host: Host;
  players: Player[];
  rounds: RoundDef[];
  current: CurrentState;
  settings: SoundSettings;
}

export type PatchFn = (room: Room) => Room;
export type Patch = (fn: PatchFn) => void;

export interface PlayerControls {
  text: string;
  setText: (text: string) => void;
  submitText: () => void;
  requestSubmit: () => void;
  submitConfirmOpen: boolean;
  setSubmitConfirmOpen: (open: boolean) => void;
  isEditing: boolean;
  hasSubmitted: boolean;
  canSubmit: boolean;
  charCount: number;
  readOnly?: boolean;
}

export interface ScoreEffect {
  amount: number;
  eventId: string;
}
