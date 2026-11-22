create table public.offload_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  enc_key text not null,
  hint text not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);
create table public.offload_access_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  providers text[] not null default '{}',
  docs text not null default '',
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create table public.offload_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_key_id uuid references public.offload_access_keys(id) on delete set null,
  provider text not null,
  model text not null,
  in_chars int not null default 0,
  out_chars int not null default 0,
  created_at timestamptz not null default now()
);
create index offload_access_keys_user_idx on public.offload_access_keys(user_id);
create index offload_usage_user_idx on public.offload_usage(user_id, created_at desc);
create index offload_usage_key_idx on public.offload_usage(access_key_id);
alter table public.offload_provider_keys enable row level security;
alter table public.offload_access_keys enable row level security;
alter table public.offload_usage enable row level security;
create policy "own access keys" on public.offload_access_keys for select to authenticated using ((select auth.uid()) = user_id);
create policy "own usage" on public.offload_usage for select to authenticated using ((select auth.uid()) = user_id);
create policy "own provider keys" on public.offload_provider_keys for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.offload_provider_keys from anon, authenticated;
grant select (id, user_id, provider, hint, created_at) on public.offload_provider_keys to authenticated;
revoke all on public.offload_access_keys from anon, authenticated;
grant select (id, user_id, name, prefix, providers, docs, revoked, created_at, last_used_at) on public.offload_access_keys to authenticated;
revoke all on public.offload_usage from anon;
revoke insert, update, delete on public.offload_usage from authenticated;
