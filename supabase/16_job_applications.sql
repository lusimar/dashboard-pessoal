-- ============================================================
-- Job Applications / Recruitment Pipeline
-- Rode no SQL Editor do Supabase (banco existente com dados).
-- Idempotente: seguro reexecutar.
-- ============================================================

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

-- Colunas extras caso a tabela já exista sem algum campo
alter table public.job_applications add column if not exists role text;
alter table public.job_applications add column if not exists salary text;
alter table public.job_applications add column if not exists benefits text;
alter table public.job_applications add column if not exists location text;
alter table public.job_applications add column if not exists contact_name text;
alter table public.job_applications add column if not exists contact_info text;
alter table public.job_applications add column if not exists notes text default '';
alter table public.job_applications add column if not exists applied_at date;
alter table public.job_applications add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

select public.apply_owner_rls('job_applications');
select public.apply_owner_rls('job_checklists');

create index if not exists idx_job_applications_user on public.job_applications (user_id);
create index if not exists idx_job_applications_status on public.job_applications (status);
create index if not exists idx_job_checklists_user on public.job_checklists (user_id);
create index if not exists idx_job_checklists_application on public.job_checklists (job_application_id);
