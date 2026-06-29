export type EventType =
  | 'round-start'
  | 'answers-prepared'
  | 'answer-show'
  | 'voting-start'
  | 'vote'
  | 'answer-reveal'
  | 'host-reveal'
  | 'round-result'
  | 'score-award'
  | 'submission'
  | 'submission-unlock'
  | 'timer-restart'
  | 'timer-stop'
  | 'timer-reset'
  | 'sound-test'
  | 'test-fill';

export interface GameEvent {
  id: string;
  type: EventType;
  payload: Record<string, unknown>;
  at: number;
}
