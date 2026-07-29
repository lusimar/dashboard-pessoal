-- ============================================================
-- Control Desk / Management OS — SCHEMA CANÔNICO (estado final)
-- ============================================================
-- USE ESTE ARQUIVO COMO:
--   • Documentação do modelo final
--   • Instalação em um projeto Supabase NOVO (vazio)
--
-- NÃO execute este arquivo "do zero" em um banco que JÁ TEM DADOS
-- se ele tentar recriar tabelas/policies conflitantes.
-- Para banco EXISTENTE, use: supabase/15_safe_sync_canonical.sql
-- ============================================================

-- Helper: cria as 4 policies padrão (select/insert/update/delete) por user_id
create or replace function public.apply_owner_rls(p_table text, p_user_col text default 'user_id')
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_select', p_table);
  execute format(
    'create policy %I on public.%I for select using (auth.uid() = %I)',
    p_table || '_select', p_table, p_user_col
  );

  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format(
    'create policy %I on public.%I for insert with check (auth.uid() = %I)',
    p_table || '_insert', p_table, p_user_col
  );

  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format(
    'create policy %I on public.%I for update using (auth.uid() = %I) with check (auth.uid() = %I)',
    p_table || '_update', p_table, p_user_col, p_user_col
  );

  execute format('drop policy if exists %I on public.%I', p_table || '_delete', p_table);
  execute format(
    'create policy %I on public.%I for delete using (auth.uid() = %I)',
    p_table || '_delete', p_table, p_user_col
  );
end;
$$;

-- ------------------------------------------------------------
-- 1. Profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone,
  full_name text
);

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select using (auth.uid() = id);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete on public.profiles for delete using (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. Companies
-- ------------------------------------------------------------
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  contract_link text,
  contract_duration integer,
  agreed_value numeric(10, 2),
  start_date date,
  end_date date,
  payment_day integer check (payment_day is null or payment_day between 1 and 31),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 3. Invoices / Documents
-- ------------------------------------------------------------
create table if not exists public.invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  document_link text not null,
  due_date date,
  payment_date date,
  type text check (type in ('DAS', 'Invoice', 'Receipt', 'Contract', 'Other')) default 'Invoice',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 4. Finances
-- ------------------------------------------------------------
create table if not exists public.finances (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade,
  description text not null,
  amount numeric(10, 2) not null,
  due_date date not null,
  payment_date date,
  category text check (category in ('Fixed Expense', 'Subscription', 'Freelance Income', 'Personal Income', 'Other')) not null,
  url text,
  payment_method text,
  status text check (status in ('Active', 'Cancelled')) default 'Active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 5. College subjects
-- ------------------------------------------------------------
create table if not exists public.college_subjects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  semester text default '',
  start_date date,
  end_date date,
  professor text,
  notes_link text,
  notes_content text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 6. Tasks (+ Lembrete)
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade,
  subject_id uuid references public.college_subjects(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamp with time zone,
  status text check (status in ('Pending', 'In Progress', 'Completed')) default 'Pending' not null,
  category text check (category in ('Personal', 'College', 'Job', 'Freelance', 'Lembrete')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 7. Live projects
-- ------------------------------------------------------------
create table if not exists public.live_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  project_url text,
  technology text,
  database_tech text,
  hosting_provider text,
  domain_provider text,
  contract_term text,
  recurring_revenue numeric(10, 2) default 0.00,
  expiration_date date,
  integrations text,
  account_email text,
  account_password text,
  contact_name text,
  contact_email text,
  contact_phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 8. Project credentials
-- ------------------------------------------------------------
create table if not exists public.project_credentials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references public.live_projects(id) on delete cascade not null,
  access_type text not null,
  email text not null,
  encrypted_password text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 9. Contract addendums
-- ------------------------------------------------------------
create table if not exists public.contract_addendums (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  added_value numeric(10, 2) not null default 0.00,
  period integer,
  start_date date,
  end_date date,
  payment_day integer check (payment_day is null or payment_day between 1 and 31),
  description text,
  document_link text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 10. Bank cards
-- ------------------------------------------------------------
create table if not exists public.bank_cards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  bank text,
  type text check (type in ('Credit', 'Debit')) not null default 'Credit',
  due_day integer check (due_day between 1 and 31) not null,
  closing_day integer check (closing_day is null or closing_day between 1 and 31),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 11. Card statements
-- ------------------------------------------------------------
create table if not exists public.card_statements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references public.bank_cards(id) on delete cascade not null,
  month integer not null check (month between 1 and 12),
  year integer not null,
  amount numeric(10, 2) not null default 0.00,
  status text check (status in ('Pending', 'Paid')) not null default 'Pending',
  due_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (card_id, month, year)
);

-- ------------------------------------------------------------
-- 12. Note categories
-- ------------------------------------------------------------
create table if not exists public.note_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text default 'folder',
  color text default '#28afb0',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 13. Notes
-- ------------------------------------------------------------
create table if not exists public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text default '',
  type text check (type in ('Draft', 'Credentials', 'LinkedIn', 'General', 'Document')) not null default 'General',
  status text check (status in ('Active', 'Archived', 'In Progress', 'Published')) not null default 'Active',
  category_id uuid references public.note_categories(id) on delete set null,
  company_id uuid references public.companies(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 14. Job applications (recruitment pipeline)
-- ------------------------------------------------------------
create table if not exists public.job_applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  company_name text not null,
  role text,
  salary text,
  benefits text,
  location text,
  contact_name text,
  contact_info text,
  notes text default '',
  status text check (status in (
    'Wishlist', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Hired'
  )) not null default 'Wishlist',
  applied_at date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.job_checklists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  job_application_id uuid references public.job_applications(id) on delete cascade not null,
  task text not null,
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------------------
-- 15. Push notifications
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, endpoint)
);

create table if not exists public.notification_dispatches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  kind text check (kind in ('day_before', 'hour_before')) not null,
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (task_id, kind)
);

-- ------------------------------------------------------------
-- RLS (owner-based) — sem repetir 4 policies por tabela
-- ------------------------------------------------------------
select public.apply_owner_rls('companies');
select public.apply_owner_rls('invoices');
select public.apply_owner_rls('finances');
select public.apply_owner_rls('college_subjects');
select public.apply_owner_rls('tasks');
select public.apply_owner_rls('live_projects');
select public.apply_owner_rls('project_credentials');
select public.apply_owner_rls('contract_addendums');
select public.apply_owner_rls('bank_cards');
select public.apply_owner_rls('card_statements');
select public.apply_owner_rls('note_categories');
select public.apply_owner_rls('notes');
select public.apply_owner_rls('job_applications');
select public.apply_owner_rls('job_checklists');
select public.apply_owner_rls('push_subscriptions');

alter table public.notification_dispatches enable row level security;
drop policy if exists notification_dispatches_select on public.notification_dispatches;
create policy notification_dispatches_select on public.notification_dispatches
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_companies_user on public.companies (user_id);
create index if not exists idx_invoices_user on public.invoices (user_id);
create index if not exists idx_invoices_company on public.invoices (company_id);
create index if not exists idx_finances_user on public.finances (user_id);
create index if not exists idx_finances_company on public.finances (company_id);
create index if not exists idx_college_subjects_user on public.college_subjects (user_id);
create index if not exists idx_tasks_user on public.tasks (user_id);
create index if not exists idx_tasks_company on public.tasks (company_id);
create index if not exists idx_tasks_subject on public.tasks (subject_id);
create index if not exists idx_tasks_due_date on public.tasks (due_date);
create index if not exists idx_live_projects_user on public.live_projects (user_id);
create index if not exists idx_live_projects_company on public.live_projects (company_id);
create index if not exists idx_project_credentials_user on public.project_credentials (user_id);
create index if not exists idx_project_credentials_project on public.project_credentials (project_id);
create index if not exists idx_contract_addendums_user on public.contract_addendums (user_id);
create index if not exists idx_contract_addendums_company on public.contract_addendums (company_id);
create index if not exists idx_bank_cards_user on public.bank_cards (user_id);
create index if not exists idx_card_statements_user on public.card_statements (user_id);
create index if not exists idx_card_statements_card on public.card_statements (card_id);
create index if not exists idx_card_statements_period on public.card_statements (year, month);
create index if not exists idx_note_categories_user on public.note_categories (user_id);
create index if not exists idx_notes_user on public.notes (user_id);
create index if not exists idx_notes_category on public.notes (category_id);
create index if not exists idx_notes_company on public.notes (company_id);
create index if not exists idx_job_applications_user on public.job_applications (user_id);
create index if not exists idx_job_applications_status on public.job_applications (status);
create index if not exists idx_job_checklists_user on public.job_checklists (user_id);
create index if not exists idx_job_checklists_application on public.job_checklists (job_application_id);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);
create index if not exists idx_notification_dispatches_task on public.notification_dispatches (task_id);
