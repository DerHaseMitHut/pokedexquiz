import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { loadRoom, saveRoom, storageKey } from '../lib/roomStorage';
import { fetchRoomRemote, selectRoomFull, getSocket } from '../lib/roomSync';
import type { Room, Patch, PatchFn } from '../types/room';

export function useRoom(code: string): [Room | null, Patch] {
  const [room, setRoom] = useState<Room | null>(() => (code ? loadRoom(code) : null));
  const roomRef = useRef<Room | null>(room);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (!code) return;
    let mounted = true;
    let channel: RealtimeChannel | undefined;

    // Re-fetch full normalized room and update state + cache
    const refetch = async () => {
      if (!mounted) return;
      const remote = await selectRoomFull(code);
      if (remote && mounted) {
        localStorage.setItem(storageKey(code), JSON.stringify(remote));
        setRoom(remote);
      }
    };

    // Initial load: localStorage cache first for instant render, then canonical remote
    fetchRoomRemote(code).then((remote) => {
      if (remote && mounted) {
        localStorage.setItem(storageKey(code), JSON.stringify(remote));
        setRoom(remote);
      } else if (!remote && mounted) {
        // Room not in Supabase yet — push local state up so Realtime works
        const local = loadRoom(code);
        if (local) saveRoom(local);
      }
    });

    // Local sync (tab-to-tab via BroadcastChannel, same-tab via storage/custom events)
    const update = () => {
      const local = loadRoom(code);
      if (local) setRoom(local);
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<Room>).detail;
      if (detail?.code === code) setRoom(detail);
    };
    window.addEventListener('storage', update);
    window.addEventListener('room-updated', onCustom);

    let bc: BroadcastChannel | undefined;
    try {
      bc = new BroadcastChannel(`quizshow-${code}`);
      bc.onmessage = (e: MessageEvent<Room>) => setRoom(e.data);
    } catch {}

    // Supabase Realtime — subscribe to all normalized tables for this room
    if (supabase) {
      supabase
        .from('rooms')
        .select('id')
        .eq('code', code)
        .maybeSingle()
        .then(({ data }) => {
          if (!data || !supabase) return;
          const roomId = data.id as string;

          channel = supabase
            .channel(`room-${code}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` }, refetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, refetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${roomId}` }, refetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `room_id=eq.${roomId}` }, refetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `room_id=eq.${roomId}` }, refetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${roomId}` }, refetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_events', filter: `room_id=eq.${roomId}` }, refetch)
            .subscribe();

          if (!mounted) {
            supabase.removeChannel(channel!);
            channel = undefined;
          }
        });
    }

    // Socket.IO fallback (when Supabase unavailable)
    const s = getSocket();
    const onSocketUpdate = (next: Room) => {
      if (next?.code === code) {
        localStorage.setItem(storageKey(code), JSON.stringify(next));
        setRoom(next);
      }
    };
    if (s) {
      s.emit('room:join', code);
      s.on('room:update', onSocketUpdate);
    }

    // Polling fallback (no Supabase, no Socket.IO)
    const t = !supabase
      ? setInterval(async () => {
          const remote = await fetchRoomRemote(code);
          if (remote && mounted) {
            localStorage.setItem(storageKey(code), JSON.stringify(remote));
            setRoom(remote);
          } else update();
        }, 2000)
      : null;

    return () => {
      mounted = false;
      window.removeEventListener('storage', update);
      window.removeEventListener('room-updated', onCustom);
      if (t) clearInterval(t);
      if (bc) bc.close();
      if (s) s.off('room:update', onSocketUpdate);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [code]);

  const patch: Patch = (fn: PatchFn) => {
    const fresh = loadRoom(code) || roomRef.current || room;
    if (!fresh) return;
    const next = fn(structuredClone(fresh));
    saveRoom(next);
    setRoom(next);
  };

  return [room, patch];
}
