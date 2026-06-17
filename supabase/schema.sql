-- Entwurf fuer den naechsten Schritt: Supabase-Datenmodell
-- Noch nicht im Frontend verdrahtet.

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
