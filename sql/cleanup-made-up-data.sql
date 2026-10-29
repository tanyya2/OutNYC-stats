-- One-time cleanup (OutNYC project): removes the sample rows that were made up in the
-- first version of week7-admin-tables.sql, and adds the OpenAI provider.

-- Both prompt chains (their steps and mix rows go with them)
delete from public.prompt_chains where name in ('Walking plan', 'Hidden gems');

-- The 3 sample terms
delete from public.terms where term in ('Bodega', 'LES', 'Uptown / Downtown');

-- The sample generation example
delete from public.generation_examples where title = 'Cozy West Village date';

-- OpenAI, for later (not used by OutNYC yet)
insert into public.llm_providers (name, api_base_url)
values ('OpenAI (ChatGPT)', 'https://api.openai.com/v1')
on conflict (name) do nothing;
