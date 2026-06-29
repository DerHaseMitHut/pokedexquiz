import { io, type Socket } from 'socket.io-client';
import { supabase } from '../config/supabase';
import { soundSettings } from './utils';
import type { Room, Player, RoundDef, CurrentState, GamePhase } from '../types/room';
import type { Answer, AnswerAuthorType } from '../types/answers';
import type { GameEvent, EventType } from '../types/events';

export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (!supabase && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:3001' : '');

let socket: Socket | null = null;
export function getSocket(): Socket | null {
  if (!API_BASE) return null;
  if (!socket) socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  return socket;
}

// ---------------------------------------------------------------------------
// assembleRoom — maps normalized DB rows into the flat Room shape the app uses
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assembleRoom(roomRow: any, playerRows: any[], roundRows: any[], submissionRows: any[], answerRows: any[], voteRows: any[], eventRows: any[]): Room {
  // Build UUID ↔ clientId maps based on slot ('p1' – 'p4')
  const uuidToClientId = new Map<string, string>(
    playerRows.map((p) => [p.id as string, (p.client_id as string) || `p${p.slot}`])
  );

  const players: Player[] = playerRows.map((p) => ({
    id: (p.client_id as string) || `p${p.slot}`,
    slot: (p.slot as 1 | 2 | 3 | 4),
    name: (p.name as string) || '',
    connected: (p.connected as boolean) || false,
    points: (p.points as number) || 0,
    vdoUrl: (p.vdo_url as string) || '',
    icon: (p.icon_url as string) || '',
    color: (p.color as string) || '#888',
  }));

  const rounds: RoundDef[] = roundRows.map((r) => ({
    id: r.id as string,
    title: (r.title as string) || '',
    image: (r.image_url as string) || '',
    hostText: (r.host_text as string) || '',
    note: (r.note as string) || '',
  }));

  // submissions: { clientId → text }
  const submissions: Record<string, string> = {};
  const editing: Record<string, boolean> = {};
  for (const sub of submissionRows) {
    const clientId = uuidToClientId.get(sub.player_id as string);
    if (clientId) {
      submissions[clientId] = (sub.text as string) || '';
      if (sub.editing) editing[clientId] = true;
    }
  }

  // answers, revealed, awarded
  const answers: Answer[] = answerRows.map((a) => ({
    id: a.id as string,
    letter: a.letter as string,
    authorType: a.author_type as AnswerAuthorType,
    authorId: a.author_type === 'player' ? (uuidToClientId.get(a.author_player_id as string) || '') : 'host',
    text: (a.text as string) || '',
  }));

  const revealed: Record<string, boolean> = {};
  const awarded: Record<string, boolean> = {};
  for (const a of answerRows) {
    if (a.revealed) revealed[a.id as string] = true;
    if (a.awarded) awarded[`answer-${a.id}`] = true;
  }

  // votes: { voterClientId → answerId }
  const votes: Record<string, string> = {};
  for (const v of voteRows) {
    const voterClientId = uuidToClientId.get(v.voter_id as string);
    if (voterClientId) votes[voterClientId] = v.answer_id as string;
  }

  // events (DB returns newest-first, app expects oldest-first)
  const events: GameEvent[] = eventRows
    .map((e) => ({
      id: e.id as string,
      type: e.type as EventType,
      payload: (e.payload as Record<string, unknown>) || {},
      at: new Date(e.created_at as string).getTime(),
    }))
    .reverse();

  // Reconstruct current round image/title/hostText from the active round row
  const activeRoundRow = roomRow.active_round_id
    ? roundRows.find((r) => r.id === roomRow.active_round_id) || null
    : null;

  const current: CurrentState = {
    image: (activeRoundRow?.image_url as string) || '',
    title: (activeRoundRow?.title as string) || '',
    hostText: (activeRoundRow?.host_text as string) || '',
    submissions,
    drafts: {},
    answers,
    votes,
    revealed,
    voteOrder: Array.isArray(roomRow.vote_order) ? (roomRow.vote_order as string[]) : [],
    activeVoterId: (roomRow.active_voter_id as string | null) || null,
    awarded,
    visibleAnswerCount: (roomRow.visible_answer_count as number) || 0,
    editing,
    timerDuration: (roomRow.timer_duration as number) || 90,
    timerStartedAt: roomRow.timer_started_at ? new Date(roomRow.timer_started_at as string).getTime() : null,
    timerRunning: (roomRow.timer_running as boolean) || false,
    timerRemaining: typeof roomRow.timer_remaining === 'number' ? (roomRow.timer_remaining as number) : undefined,
    events,
  };

  return {
    code: roomRow.code as string,
    createdAt: new Date(roomRow.created_at as string).getTime(),
    phase: roomRow.phase as GamePhase,
    activeRoundId: (roomRow.active_round_id as string | null) || null,
    host: {
      name: (roomRow.host_name as string) || 'Host',
      points: (roomRow.host_points as number) || 0,
      vdoUrl: (roomRow.host_vdo_url as string) || '',
      icon: (roomRow.host_icon_url as string) || '',
      color: (roomRow.host_color as string) || '#f8fafc',
    },
    players,
    rounds,
    current,
    settings: soundSettings(roomRow.settings || {}),
  };
}

// ---------------------------------------------------------------------------
// selectRoomFull — reads all normalized tables and returns a Room
// ---------------------------------------------------------------------------

export async function selectRoomFull(code: string): Promise<Room | null> {
  if (!supabase || !code) return null;
  try {
    const { data: roomRow, error } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle();
    if (error || !roomRow) return null;

    const roomId = roomRow.id as string;

    const [playerRes, roundRes] = await Promise.all([
      supabase.from('players').select('*').eq('room_id', roomId).order('slot'),
      supabase.from('rounds').select('*').eq('room_id', roomId).order('sort_order'),
    ]);

    const playerRows = playerRes.data || [];
    const roundRows = roundRes.data || [];

    let submissionRows: unknown[] = [];
    let answerRows: unknown[] = [];
    let voteRows: unknown[] = [];

    if (roomRow.active_round_id) {
      const [subRes, ansRes, voteRes] = await Promise.all([
        supabase.from('submissions').select('*').eq('round_id', roomRow.active_round_id),
        supabase.from('answers').select('*').eq('round_id', roomRow.active_round_id).order('letter'),
        supabase.from('votes').select('*').eq('round_id', roomRow.active_round_id),
      ]);
      submissionRows = subRes.data || [];
      answerRows = ansRes.data || [];
      voteRows = voteRes.data || [];
    }

    const { data: eventRows } = await supabase
      .from('game_events')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(20);

    return assembleRoom(roomRow, playerRows, roundRows, submissionRows, answerRows, voteRows, eventRows || []);
  } catch (err) {
    console.warn('selectRoomFull failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// saveRoomToSupabase — writes the full Room state to normalized tables (debounced)
// ---------------------------------------------------------------------------

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingRoom: Room | null = null;

async function _flushSave(): Promise<void> {
  const room = _pendingRoom;
  _pendingRoom = null;
  if (!room || !supabase) return;
  try {
    // 1. Upsert rooms row → get DB id
    const { data: roomRow, error: roomErr } = await supabase
      .from('rooms')
      .upsert(
        {
          code: room.code,
          phase: room.phase,
          active_round_id: room.activeRoundId,
          host_name: room.host.name,
          host_vdo_url: room.host.vdoUrl,
          host_icon_url: room.host.icon,
          host_color: room.host.color,
          host_points: room.host.points,
          settings: room.settings,
          visible_answer_count: room.current.visibleAnswerCount,
          vote_order: room.current.voteOrder,
          active_voter_id: room.current.activeVoterId,
          timer_running: room.current.timerRunning,
          timer_started_at: room.current.timerStartedAt ? new Date(room.current.timerStartedAt).toISOString() : null,
          timer_duration: room.current.timerDuration,
          timer_remaining: room.current.timerRemaining ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'code' }
      )
      .select('id')
      .single();

    if (roomErr || !roomRow) {
      console.warn('Supabase rooms upsert failed:', roomErr?.message);
      return;
    }
    const roomId = roomRow.id as string;

    // 2. Upsert players + rounds in parallel → need player UUIDs for step 3
    const [playerRes] = await Promise.all([
      supabase
        .from('players')
        .upsert(
          room.players.map((p) => ({
            room_id: roomId,
            slot: p.slot,
            client_id: p.id,
            name: p.name,
            points: p.points,
            vdo_url: p.vdoUrl,
            icon_url: p.icon,
            color: p.color,
            connected: p.connected,
          })),
          { onConflict: 'room_id,slot' }
        )
        .select('id, client_id'),
      room.rounds.length > 0
        ? supabase.from('rounds').upsert(
            room.rounds.map((r, idx) => ({
              id: r.id,
              room_id: roomId,
              title: r.title,
              image_url: r.image,
              host_text: r.hostText,
              note: r.note,
              sort_order: idx,
            })),
            { onConflict: 'id' }
          )
        : Promise.resolve(),
    ]);

    // Build client_id → UUID map
    const clientIdToUUID = new Map<string, string>(
      (playerRes.data || []).map((p) => [p.client_id as string, p.id as string])
    );

    if (!room.activeRoundId) return;

    // 3. Upsert submissions, answers, votes in parallel (only for active round)
    const submissionEntries = Object.entries(room.current.submissions).filter(([, text]) => text?.trim());
    const hasAnswers = room.current.answers.length > 0;
    const voteEntries = Object.entries(room.current.votes);

    await Promise.all([
      submissionEntries.length > 0
        ? supabase.from('submissions').upsert(
            submissionEntries
              .map(([clientId, text]) => ({
                room_id: roomId,
                round_id: room.activeRoundId,
                player_id: clientIdToUUID.get(clientId),
                text,
                editing: room.current.editing?.[clientId] ?? false,
              }))
              .filter((s) => s.player_id),
            { onConflict: 'round_id,player_id' }
          )
        : Promise.resolve(),

      hasAnswers
        ? supabase.from('answers').upsert(
            room.current.answers.map((a) => ({
              id: a.id,
              room_id: roomId,
              round_id: room.activeRoundId,
              letter: a.letter,
              author_type: a.authorType,
              author_player_id: a.authorType === 'player' ? (clientIdToUUID.get(a.authorId) ?? null) : null,
              text: a.text,
              revealed: room.current.revealed[a.id] ?? false,
              awarded: room.current.awarded[`answer-${a.id}`] ?? false,
            })),
            { onConflict: 'id' }
          )
        : Promise.resolve(),

      voteEntries.length > 0
        ? supabase.from('votes').upsert(
            voteEntries
              .map(([voterClientId, answerId]) => ({
                room_id: roomId,
                round_id: room.activeRoundId,
                voter_id: clientIdToUUID.get(voterClientId),
                answer_id: answerId,
              }))
              .filter((v) => v.voter_id),
            { onConflict: 'round_id,voter_id' }
          )
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.warn('saveRoomToSupabase failed:', err);
  }
}

function saveRoomToSupabase(room: Room): void {
  _pendingRoom = room;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushSave, 250);
}

// ---------------------------------------------------------------------------
// Public API: fetchRoomRemote + saveRoomRemote (called from roomStorage/useRoom)
// ---------------------------------------------------------------------------

export async function fetchRoomRemote(code: string): Promise<Room | null> {
  if (!code) return null;
  if (supabase) {
    // Try normalized tables first
    const room = await selectRoomFull(code);
    if (room) return room;

    // Fallback to legacy quiz_rooms blob (for rooms not yet migrated)
    try {
      const { data } = await supabase.from('quiz_rooms').select('state').eq('code', code).maybeSingle();
      return (data?.state as Room) || null;
    } catch {
      return null;
    }
  }
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/rooms/${code}`);
    if (!res.ok) return null;
    return (await res.json()) as Room;
  } catch {
    return null;
  }
}

export async function saveRoomRemote(room: Room): Promise<void> {
  if (!room?.code) return;
  if (supabase) {
    saveRoomToSupabase(room);
    return;
  }
  if (!API_BASE) return;
  try {
    await fetch(`${API_BASE}/api/rooms/${room.code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    });
  } catch {}
}
