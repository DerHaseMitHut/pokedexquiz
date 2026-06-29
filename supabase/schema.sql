-- Normalized schema for Quizshow Tool
-- Run the CREATE TABLE blocks first (initial setup), then the ALTER TABLE blocks (migration).
-- The ALTER TABLE blocks are idempotent — safe to re-run.

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  phase text not null default 'lobby',
  active_round_id uuid,
  host_name text default 'Host',
  host_vdo_url text,
  host_icon_url text,
  settings jsonb default '{"sounds": true, "volume": 0.55}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  slot int not null check (slot between 1 and 4),
  name text,
  points int not null default 0,
  reconnect_token text,
  vdo_url text,
  icon_url text,
  color text,
  connected boolean not null default false,
  unique(room_id, slot)
);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  title text,
  image_url text,
  host_text text not null,
  note text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  round_id uuid references rounds(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  text text not null,
  created_at timestamptz default now(),
  unique(round_id, player_id)
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  round_id uuid references rounds(id) on delete cascade,
  letter text not null check (letter in ('A','B','C','D','E')),
  author_type text not null check (author_type in ('host','player')),
  author_player_id uuid references players(id) on delete set null,
  text text not null,
  revealed boolean not null default false,
  unique(round_id, letter)
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  round_id uuid references rounds(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  answer_id uuid references answers(id) on delete cascade,
  created_at timestamptz default now(),
  unique(round_id, voter_id)
);

create table if not exists game_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Migration: columns added in Phase 4
-- ---------------------------------------------------------------------------

-- Rooms: live game state that doesn't belong to a single normalized child table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_color   text        NOT NULL DEFAULT '#f8fafc';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_points  int         NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS visible_answer_count int NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS vote_order   jsonb       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS active_voter_id text;          -- client ID e.g. 'p1'
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS timer_running    boolean NOT NULL DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS timer_started_at timestamptz;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS timer_duration   int     NOT NULL DEFAULT 90;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS timer_remaining  int;

-- Players: client-side stable ID ('p1'–'p4') so we can reconstruct the Room shape
ALTER TABLE players ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_room_client_unique;
ALTER TABLE players ADD CONSTRAINT players_room_client_unique UNIQUE (room_id, client_id);

-- Answers: track whether points for this answer have already been awarded
ALTER TABLE answers ADD COLUMN IF NOT EXISTS awarded boolean NOT NULL DEFAULT false;

-- Submissions: track whether host has unlocked the submission for correction
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS editing boolean NOT NULL DEFAULT false;
