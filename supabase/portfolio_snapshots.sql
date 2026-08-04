create table if not exists public.portfolio_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  holdings jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  schema_version integer not null default 1,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_snapshots enable row level security;

revoke all on table public.portfolio_snapshots from anon;
grant usage on schema public to authenticated;
grant select, insert, update on table public.portfolio_snapshots to authenticated;

drop policy if exists "Users can view their own portfolio" on public.portfolio_snapshots;
create policy "Users can view their own portfolio"
on public.portfolio_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own portfolio" on public.portfolio_snapshots;
create policy "Users can create their own portfolio"
on public.portfolio_snapshots
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own portfolio" on public.portfolio_snapshots;
create policy "Users can update their own portfolio"
on public.portfolio_snapshots
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

comment on table public.portfolio_snapshots is
  'Atomic, versioned Min Sparing portfolio snapshots. Delete access is intentionally not granted.';

