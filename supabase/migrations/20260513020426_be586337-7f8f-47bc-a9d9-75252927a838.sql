create table public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_step text,
  completed_steps text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','in_progress','completed','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

create policy "users read own onboarding"
on public.user_onboarding for select
to authenticated
using (auth.uid() = user_id);

create policy "users insert own onboarding"
on public.user_onboarding for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users update own onboarding"
on public.user_onboarding for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_user_onboarding()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_onboarding_touch
before update on public.user_onboarding
for each row execute function public.touch_user_onboarding();