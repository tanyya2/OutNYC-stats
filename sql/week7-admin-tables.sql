-- Week 7: tables behind the new admin pages.
-- Run once in the Supabase SQL Editor (OutNYC project). Safe to re-run: it skips what exists.
-- Admins (public.is_superadmin()) can do everything; OutNYC (signed-in users) can read
-- the AI settings it needs and log its own generation requests and LLM responses.

-- Stop right away if this is the wrong Supabase project (OutNYC's is stvkpfljyavatafrqcvv)
do $$
begin
  if to_regclass('public.plans') is null or to_regclass('public.votes') is null then
    raise exception 'This is not the OutNYC project: it has no plans/votes tables. Switch projects in Supabase and run it again.';
  end if;
end $$;

-- ─── AI providers and models ────────────────────────────────────────────────
create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null unique,
  api_base_url text
);

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  provider_id bigint not null references public.llm_providers (id) on delete restrict,
  -- The id the provider's API expects, e.g. gemini-2.5-flash
  name text not null unique,
  label text,
  -- Order OutNYC tries the models in when one is out of free requests
  sort_order int not null default 0,
  thinking_off boolean not null default true,
  is_active boolean not null default true
);

-- ─── Prompt chains: the steps one plan goes through ──────────────────────────
create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null unique,
  description text
);

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  step_order int not null,
  name text not null,
  -- google_places, filter, prompt, llm_call, check or save
  kind text not null,
  instructions text,
  unique (chain_id, step_order)
);

-- How often each chain is picked for a new plan (weights, any scale)
create table if not exists public.prompt_chain_mix (
  id bigint generated always as identity primary key,
  chain_id bigint not null unique references public.prompt_chains (id) on delete cascade,
  weight int not null default 0 check (weight >= 0),
  updated_at timestamptz not null default now()
);

-- ─── Prompt content: NYC terms and example plans ─────────────────────────────
create table if not exists public.terms (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  term text not null unique,
  definition text not null,
  example text
);

create table if not exists public.generation_examples (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  title text not null,
  -- What the user asked for, e.g. "West Village, date night, $$"
  request text not null,
  -- The plan we'd want Gemini to write for it
  example_plan text not null,
  is_active boolean not null default true
);

-- ─── Observability: every "make a plan" request and every Gemini reply ───────
create table if not exists public.generation_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  chain_id bigint references public.prompt_chains (id) on delete set null,
  neighborhood text,
  inputs jsonb,
  -- success or failed
  status text not null,
  error text,
  plan_id bigint references public.plans (id) on delete set null,
  duration_ms int
);

create table if not exists public.llm_responses (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  request_id bigint references public.generation_requests (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  model text not null,
  ok boolean not null,
  http_status int,
  response_text text,
  duration_ms int
);

-- ─── Who may sign up ─────────────────────────────────────────────────────────
-- Both lists empty = anyone can sign up (how OutNYC works today).
create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  domain text not null unique
);

create table if not exists public.whitelist_email_addresses (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null unique,
  note text
);

-- OutNYC asks this at sign-in, without being able to read the lists themselves.
create or replace function public.email_can_sign_up(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (not exists (select 1 from allowed_signup_domains) and not exists (select 1 from whitelist_email_addresses))
    or exists (select 1 from whitelist_email_addresses where lower(email) = lower(check_email))
    or exists (select 1 from allowed_signup_domains where lower(domain) = lower(split_part(check_email, '@', 2)));
$$;
grant execute on function public.email_can_sign_up(text) to authenticated;

-- ─── Access rules ────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  -- Every new table: admins can do everything
  foreach t in array array[
    'llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_steps', 'prompt_chain_mix',
    'terms', 'generation_examples', 'generation_requests', 'llm_responses',
    'allowed_signup_domains', 'whitelist_email_addresses'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Admins manage %s" on public.%I', t, t);
    execute format(
      'create policy "Admins manage %s" on public.%I for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin())',
      t, t
    );
  end loop;

  -- AI settings OutNYC reads when it makes a plan
  foreach t in array array[
    'llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_steps', 'prompt_chain_mix',
    'terms', 'generation_examples'
  ] loop
    execute format('drop policy if exists "Signed-in users read %s" on public.%I', t, t);
    execute format('create policy "Signed-in users read %s" on public.%I for select to authenticated using (true)', t, t);
  end loop;

  -- OutNYC logs its own requests and replies (only admins read them back)
  foreach t in array array['generation_requests', 'llm_responses'] loop
    execute format('drop policy if exists "Users log their own %s" on public.%I', t, t);
    execute format(
      'create policy "Users log their own %s" on public.%I for insert to authenticated with check (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

-- OutNYC updates its request row (success/failed) after the reply comes back
drop policy if exists "Users finish their own generation_requests" on public.generation_requests;
create policy "Users finish their own generation_requests" on public.generation_requests
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Profile photos are private to each user: no admin access to the avatars bucket or to
-- editing profiles. (An earlier version added that; these lines remove it if it's there.)
drop policy if exists "Admins manage avatars" on storage.objects;
drop policy if exists "Admins update profiles" on public.profiles;

-- ─── Starting data: the models OutNYC uses today (from its code) ───────────────────────────────────
insert into public.llm_providers (name, api_base_url)
values ('Google Gemini', 'https://generativelanguage.googleapis.com/v1beta/models')
on conflict (name) do nothing;

insert into public.llm_models (provider_id, name, label, sort_order, thinking_off)
select p.id, m.name, m.label, m.sort_order, m.thinking_off
from public.llm_providers p
cross join (values
  ('gemini-2.5-flash', 'Gemini 2.5 Flash', 1, true),
  ('gemini-3-flash-preview', 'Gemini 3 Flash (preview)', 2, true),
  ('gemini-flash-latest', 'Gemini Flash (latest)', 3, true),
  ('gemini-flash-lite-latest', 'Gemini Flash Lite (latest)', 4, false)
) as m (name, label, sort_order, thinking_off)
where p.name = 'Google Gemini'
on conflict (name) do nothing;

-- Not used by OutNYC yet; added so it can be switched to later
insert into public.llm_providers (name, api_base_url)
values ('OpenAI (ChatGPT)', 'https://api.openai.com/v1')
on conflict (name) do nothing;

notify pgrst, 'reload schema';
