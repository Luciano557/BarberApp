create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index idx_push_tokens_org on push_tokens(organization_id);

alter table push_tokens enable row level security;

create policy "usuarios ven solo sus propios tokens"
  on push_tokens for select
  using (auth.uid() = user_id);

create policy "usuarios insertan solo su propio token"
  on push_tokens for insert
  with check (auth.uid() = user_id);

create policy "usuarios actualizan solo su propio token"
  on push_tokens for update
  using (auth.uid() = user_id);