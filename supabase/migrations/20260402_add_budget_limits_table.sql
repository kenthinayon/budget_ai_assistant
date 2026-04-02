create table if not exists public.budget_limits (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

create index if not exists budget_limits_user_idx
  on public.budget_limits (user_id);

alter table public.budget_limits enable row level security;

create or replace function public.set_budget_limits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists budget_limits_set_updated_at on public.budget_limits;
create trigger budget_limits_set_updated_at
before update on public.budget_limits
for each row
execute procedure public.set_budget_limits_updated_at();

drop policy if exists "Users can read own budget limits" on public.budget_limits;
create policy "Users can read own budget limits"
on public.budget_limits
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own budget limits" on public.budget_limits;
create policy "Users can insert own budget limits"
on public.budget_limits
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own budget limits" on public.budget_limits;
create policy "Users can update own budget limits"
on public.budget_limits
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own budget limits" on public.budget_limits;
create policy "Users can delete own budget limits"
on public.budget_limits
for delete
to authenticated
using (auth.uid() = user_id);
