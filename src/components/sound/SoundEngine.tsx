import { useEffect, useRef } from 'react';
import { shouldPlayEventSound, playUiSound, volumePercent, volumeToGain } from '../../lib/audio';
import { soundSettings, getTimerRemaining } from '../../lib/utils';
import type { Room } from '../../types/room';

export function SoundEngine({ room }: { room: Room }) {
  const lastEventId = useRef<string | null>(room.current.events?.at(-1)?.id || null);
  const lastTickSecond = useRef<number | null>(null);
  const customTimerAudioRef = useRef<HTMLAudioElement | null>(null);
  const settings = soundSettings(room.settings);

  useEffect(() => {
    const latest = room.current.events?.at(-1);
    if (!latest || latest.id === lastEventId.current) return;
    lastEventId.current = latest.id;
    if (settings.sounds === false) return;
    if (shouldPlayEventSound(latest.type, settings)) {
      playUiSound(latest.type, settings.volume ?? 55);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      void audio.play().catch(() => {});
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
        playUiSound('timer-tick', Math.min(200, volumePercent(settings.timerVolume, 35) * (second <= 10 ? 0.75 : 0.32)));
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.current.timerRunning, room.current.timerStartedAt, room.current.timerRemaining, room.current.answers?.length, room.settings]);

  return null;
}
