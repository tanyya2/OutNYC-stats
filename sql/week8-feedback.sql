-- Week 8 (PM feedback). Run once in the Supabase SQL Editor (OutNYC project). Safe to re-run.

-- Stop right away if this is the wrong Supabase project (OutNYC's is stvkpfljyavatafrqcvv)
do $$
begin
  if to_regclass('public.plans') is null or to_regclass('public.prompt_chains') is null then
    raise exception 'This is not the OutNYC project (or week7-admin-tables.sql has not run). Switch projects and run it again.';
  end if;
end $$;

-- ─── Users: email for the admin ──────────────────────────────────────────────
-- Emails are only in Supabase's login table (auth.users), which the app can't read.
-- This returns them to superadmins only; anyone else gets no rows.
create or replace function public.admin_user_emails()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text from auth.users u where public.is_superadmin();
$$;
revoke execute on function public.admin_user_emails() from public, anon;
grant execute on function public.admin_user_emails() to authenticated;

-- ─── Prompt chains: the steps OutNYC follows today (web/app/explore/plan.ts) ──
insert into public.prompt_chains (name, description)
values ('OutNYC plan', 'The steps OutNYC follows today to turn a request into a plan.')
on conflict (name) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, name, kind, instructions)
select c.id, s.step_order, s.name, s.kind, s.instructions
from public.prompt_chains c
cross join (values
  (1, 'Search Google Places', 'google_places',
   'Get the 20 most popular places near the chosen spot for the picked categories. One extra search for each picked category that is missing.'),
  (2, 'Drop closed places', 'filter',
   'Leave out places Google says are closed right now (unless Open now is off). Every picked category needs at least one place left.'),
  (3, 'Build the prompt', 'prompt',
   'Write one prompt with the starting spot, budget, what for, picked categories and the numbered list of places.'),
  (4, 'Ask Gemini', 'llm_call',
   'Send the prompt to Gemini. If a model is out of free requests, try the next one in order.'),
  (5, 'Check the plan', 'check',
   'Check the plan follows the rules (number of stops, picked categories, no repeats). If not, ask Gemini once more.'),
  (6, 'Save the plan', 'save',
   'Save the plan with its place ids, the prompt and the model that wrote it.')
) as s (step_order, name, kind, instructions)
where c.name = 'OutNYC plan'
on conflict (chain_id, step_order) do nothing;

-- Only one chain, so it makes every plan
insert into public.prompt_chain_mix (chain_id, weight)
select id, 100 from public.prompt_chains where name = 'OutNYC plan'
on conflict (chain_id) do nothing;

notify pgrst, 'reload schema';
