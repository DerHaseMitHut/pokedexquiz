import { DEFAULT_SOUND_SETTINGS } from '../config/constants';
import type { SoundSettings } from '../types/sound';
import type { CurrentState } from '../types/room';
import type { GameEvent } from '../types/events';
import type { EventType } from '../types/events';

export function soundSettings(settings: Partial<SoundSettings> = {}): SoundSettings {
  return {
    ...DEFAULT_SOUND_SETTINGS,
    ...settings,
    events: { ...DEFAULT_SOUND_SETTINGS.events, ...(settings.events || {}) },
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeVdoUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('vdo.ninja') && !u.searchParams.has('view') && u.searchParams.has('push')) {
      const push = u.searchParams.get('push')!;
      return `https://vdo.ninja/?view=${encodeURIComponent(push)}&cleanoutput&transparent&autoplay`;
    }
    return url;
  } catch {
    return url;
  }
}

export function getTimerRemaining(current: Partial<CurrentState>): number {
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

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function pushEvent(events: GameEvent[], type: EventType, payload: Record<string, unknown> = {}): GameEvent[] {
  return [...(events || []).slice(-20), { id: crypto.randomUUID(), type, payload, at: Date.now() }];
}
