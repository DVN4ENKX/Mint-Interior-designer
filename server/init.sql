create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  pass_hash text not null,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  title text not null default 'Мой проект',
  data jsonb not null default '{}',
  is_public boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);