import { useEffect, useRef, useState } from 'react';
import type { Room, ScoreEffect } from '../types/room';

export function useScoreEffects(room: Room): Record<string, ScoreEffect> {
  const [effects, setEffects] = useState<Record<string, ScoreEffect>>({});
  const lastScoreEventId = useRef<string | null>(null);
  useEffect(() => {
    const latestScore = [...(room.current.events || [])].reverse().find((e) => e.type === 'score-award');
    if (!latestScore || latestScore.id === lastScoreEventId.current) return;
    lastScoreEventId.current = latestScore.id;
    const awards = (latestScore.payload?.awards || {}) as Record<string, number>;
    if (!Object.keys(awards).length) return;
    const next: Record<string, ScoreEffect> = {};
    for (const [playerId, amount] of Object.entries(awards)) {
      next[playerId] = { amount: Number(amount || 0), eventId: latestScore.id };
    }
    setEffects(next);
    const timer = setTimeout(
      () =>
        setEffects((current) => {
          const stillCurrent = Object.values(current).some((e) => e.eventId === latestScore.id);
          return stillCurrent ? {} : current;
        }),
      1800
    );
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.current.events]);
  return effects;
}
