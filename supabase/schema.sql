-- Portify portfolios schema.
-- Safe to run on a new project or over the earlier owner_id/project_name schema.

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default '',
  bio text not null default '',
  email text not null default '',
  skills text[] not null default '{}',
  projects jsonb not null default '[]'::jsonb,
  template text not null default 'aurora'
    check (template in ('aurora', 'folio', 'mono')),
  slug text not null unique,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add the current columns when upgrading a table created by the previous app.
alter table public.portfolios
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists projects jsonb not null default '[]'::jsonb,
  add column if not exists slug text,
  add column if not exists is_published boolean not null default false;

-- Preserve old account IDs and featured-project data during an upgrade.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'portfolios'
      and column_name = 'owner_id'
  ) then
    execute
      'update public.portfolios set user_id = owner_id where user_id is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'portfolios'
      and column_name = 'project_name'
  ) then
    execute $migration$
      update public.portfolios
      set projects = jsonb_build_array(
        jsonb_build_object(
          'name', project_name,
          'description', 'A project that demonstrates my creativity and skills.'
        )
      )
      where project_name <> ''
        and projects = '[]'::jsonb
    $migration$;
  end if;
end;
$$;

update public.portfolios
set id = gen_random_uuid()
where id is null;

update public.portfolios
set slug =
  coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(full_name), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'portfolio'
  ) || '-' || left(id::text, 8)
where slug is null or btrim(slug) = '';

alter table public.portfolios
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column projects set default '[]'::jsonb,
  alter column projects set not null,
  alter column slug set not null;

-- Replace the former one-portfolio-per-user primary key with row IDs.
do $$
declare
  primary_key record;
begin
  for primary_key in
    select
      constraint_row.conname,
      array_agg(attribute_row.attname order by key_column.ordinality) as columns
    from pg_constraint as constraint_row
    cross join lateral unnest(constraint_row.conkey)
      with ordinality as key_column(attribute_number, ordinality)
    join pg_attribute as attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
      and attribute_row.attnum = key_column.attribute_number
    where constraint_row.conrelid = 'public.portfolios'::regclass
      and constraint_row.contype = 'p'
    group by constraint_row.conname
  loop
    if primary_key.columns is distinct from array['id']::name[] then
      execute format(
        'alter table public.portfolios drop constraint %I',
        primary_key.conname
      );
    end if;
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.portfolios'::regclass
      and contype = 'p'
  ) then
    alter table public.portfolios
      add constraint portfolios_pkey primary key (id);
  end if;
end;
$$;

-- Remove old policies before dropping columns referenced by their expressions.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'portfolios'
  loop
    execute format(
      'drop policy %I on public.portfolios',
      policy_row.policyname
    );
  end loop;
end;
$$;

-- Remove legacy account/project columns after their data has been migrated.
alter table public.portfolios
  drop column if exists owner_id,
  drop column if exists project_name;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.portfolios'::regclass
      and conname = 'portfolios_user_id_fkey'
  ) then
    alter table public.portfolios
      add constraint portfolios_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.portfolios'::regclass
      and conname = 'portfolios_template_check'
  ) then
    alter table public.portfolios
      add constraint portfolios_template_check
      check (template in ('aurora', 'folio', 'mono));
  end if;
end;
$$;

create unique index if not exists portfolios_slug_key
  on public.portfolios (slug);
create index if not exists portfolios_user_id_idx
  on public.portfolios (user_id);
create index if not exists portfolios_published_idx
  on public.portfolios (is_published)
  where is_published = true;

alter table public.portfolios enable row level security;

revoke all on table public.portfolios from anon, public;
grant select on table public.portfolios to anon, authenticated;
grant insert, update, delete on table public.portfolios to authenticated;

create policy "Read published portfolios or own portfolios"
  on public.portfolios
  for select
  to anon, authenticated
  using (
    is_published = true
    or (select auth.uid()) = user_id
  );

create policy "Users create their own portfolios"
  on public.portfolios
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own portfolios"
  on public.portfolios
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own portfolios"
  on public.portfolios
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.update_portfolio_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_portfolio_updated_at
  on public.portfolios;
create trigger set_portfolio_updated_at
  before update on public.portfolios
  for each row
  execute function public.update_portfolio_updated_at();
