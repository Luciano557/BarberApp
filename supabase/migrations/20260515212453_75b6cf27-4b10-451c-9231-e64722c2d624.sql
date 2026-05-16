create table public.user_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  event_type text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_type)
);

create index idx_unp_org_user on public.user_notification_preferences(organization_id, user_id);
create index idx_unp_user_event on public.user_notification_preferences(user_id, event_type);

alter table public.user_notification_preferences enable row level security;

create policy "Users select own notification preferences"
  on public.user_notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own notification preferences"
  on public.user_notification_preferences
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and organization_id = (select organization_id from public.profiles where id = auth.uid())
  );

create policy "Users update own notification preferences"
  on public.user_notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger trg_unp_updated_at
  before update on public.user_notification_preferences
  for each row execute function public.update_updated_at_column();