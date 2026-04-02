-- Creates a public profile table and keeps it in sync with auth.users metadata.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  age integer check (age between 1 and 120),
  phone text,
  sex text check (sex in ('male', 'female', 'other', 'prefer_not_to_say')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute procedure public.set_profiles_updated_at();

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_age integer;
begin
  incoming_age := case
    when coalesce(new.raw_user_meta_data ->> 'age', '') ~ '^\d+$'
      then (new.raw_user_meta_data ->> 'age')::integer
    else null
  end;

  insert into public.profiles (
    id,
    full_name,
    age,
    phone,
    sex
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    incoming_age,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'sex', '')
  )
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    age = excluded.age,
    phone = excluded.phone,
    sex = excluded.sex,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.sync_profile_from_auth();

-- Backfill profile rows for users that were created before this migration.
insert into public.profiles (id, full_name, age, phone, sex)
select
  u.id,
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  case
    when coalesce(u.raw_user_meta_data ->> 'age', '') ~ '^\d+$'
      then (u.raw_user_meta_data ->> 'age')::integer
    else null
  end,
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  nullif(u.raw_user_meta_data ->> 'sex', '')
from auth.users u
on conflict (id) do nothing;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
