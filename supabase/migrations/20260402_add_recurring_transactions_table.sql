alter table public.transactions
drop constraint if exists transactions_source_check;

alter table public.transactions
add constraint transactions_source_check
check (source in ('manual', 'iot', 'recurring'));

create table if not exists public.recurring_transactions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_count integer not null default 1 check (interval_count >= 1 and interval_count <= 365),
  start_date date not null,
  next_run_date date not null,
  is_active boolean not null default true,
  last_generated_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_transactions_user_next_run_idx
  on public.recurring_transactions (user_id, next_run_date);

alter table public.recurring_transactions enable row level security;

create or replace function public.set_recurring_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recurring_transactions_set_updated_at on public.recurring_transactions;
create trigger recurring_transactions_set_updated_at
before update on public.recurring_transactions
for each row
execute procedure public.set_recurring_transactions_updated_at();

drop policy if exists "Users can read own recurring transactions" on public.recurring_transactions;
create policy "Users can read own recurring transactions"
on public.recurring_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own recurring transactions" on public.recurring_transactions;
create policy "Users can insert own recurring transactions"
on public.recurring_transactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own recurring transactions" on public.recurring_transactions;
create policy "Users can update own recurring transactions"
on public.recurring_transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recurring transactions" on public.recurring_transactions;
create policy "Users can delete own recurring transactions"
on public.recurring_transactions
for delete
to authenticated
using (auth.uid() = user_id);
