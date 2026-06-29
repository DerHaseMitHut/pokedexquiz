import type { SoundSettings } from '../types/sound';
import type { EventType } from '../types/events';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export function volumePercent(value: number, fallback = 55): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return value <= 1 ? Math.round(value * 100) : value;
}

export function volumeToGain(value: number, fallback = 55): number {
  const percent = Math.max(0, Math.min(200, volumePercent(value, fallback)));
  if (percent <= 0) return 0;
  // Quadratic curve gives much finer control at low/medium volume than a linear slider.
  return Math.min(1, Math.pow(percent / 200, 2));
}

export function shouldPlayEventSound(type: EventType, settings: SoundSettings): boolean {
  if (type === 'sound-test') return true;
  if (type === 'answer-show') return !!settings.events?.answerShow;
  if (type === 'answer-reveal' || type === 'host-reveal') return !!settings.events?.answerReveal;
  if (type === 'vote') return !!settings.events?.voteCast;
  if (type === 'score-award') return !!settings.events?.scoreAward;
  return false;
}

let audioContext: AudioContext | null = null;
export function getAudioContext(): AudioContext | null {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

export function playCustomAudio(src: string, volume = 55, loop = false): HTMLAudioElement | undefined {
  if (!src) return;
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = volumeToGain(volume, 55);
  audio.play().catch(() => {});
  return audio;
}

export function playUiSound(type: string, volume = 55): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const v = volumeToGain(volume, 55);
  const presets: Record<string, [number, number, number][]> = {
    'sound-test': [[520, 0, 0.09], [780, 0.09, 0.12]],
    'timer-tick': [[980, 0, 0.025]],
    'round-start': [[392, 0, 0.1], [523, 0.11, 0.12], [784, 0.23, 0.16]],
    submission: [[660, 0, 0.07]],
    'answers-prepared': [[330, 0, 0.06], [440, 0.07, 0.06]],
    'answer-show': [[520, 0, 0.055], [690, 0.06, 0.06]],
    'voting-start': [[440, 0, 0.08], [590, 0.09, 0.1]],
    vote: [[760, 0, 0.06]],
    'answer-reveal': [[300, 0, 0.08], [520, 0.09, 0.12]],
    'host-reveal': [[523, 0, 0.08], [659, 0.09, 0.08], [880, 0.18, 0.18]],
    'round-result': [[440, 0, 0.08], [660, 0.1, 0.08], [880, 0.2, 0.16]],
    'score-award': [[880, 0, 0.08], [1175, 0.09, 0.12]],
    'timer-restart': [[620, 0, 0.06]],
    'timer-stop': [[260, 0, 0.08]],
    'timer-reset': [[310, 0, 0.06], [310, 0.07, 0.06]],
    'submission-unlock': [[720, 0, 0.05], [480, 0.06, 0.08]],
    'test-fill': [[360, 0, 0.05], [460, 0.06, 0.05]],
  };
  const sequence = presets[type] || [[500, 0, 0.06]];
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
