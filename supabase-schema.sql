-- ============================================
-- Supabase Schema for AI Fiesta Annotation Platform
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Projects ───────────────────────────────
create table projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  label_config jsonb not null default '{"type": "bbox", "labels": []}',
  created_by uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

-- ─── Tasks ──────────────────────────────────
create table tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  data jsonb not null default '{}',
  is_labeled boolean default false not null,
  created_at timestamptz default now() not null
);

-- ─── Annotations ────────────────────────────
create table annotations (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references tasks(id) on delete cascade not null,
  result jsonb not null default '[]',
  created_by uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ─── Indexes ────────────────────────────────
create index idx_tasks_project_id on tasks(project_id);
create index idx_tasks_is_labeled on tasks(is_labeled);
create index idx_annotations_task_id on annotations(task_id);
create index idx_annotations_created_by on annotations(created_by);
create index idx_projects_created_by on projects(created_by);

-- ─── Row Level Security ─────────────────────

-- Projects: users can only see/modify their own projects
alter table projects enable row level security;

create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = created_by);

create policy "Users can create projects"
  on projects for insert
  with check (auth.uid() = created_by);

create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = created_by);

create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = created_by);

-- Tasks: users can access tasks in their projects
alter table tasks enable row level security;

create policy "Users can view tasks in own projects"
  on tasks for select
  using (
    project_id in (
      select id from projects where created_by = auth.uid()
    )
  );

create policy "Users can create tasks in own projects"
  on tasks for insert
  with check (
    project_id in (
      select id from projects where created_by = auth.uid()
    )
  );

create policy "Users can update tasks in own projects"
  on tasks for update
  using (
    project_id in (
      select id from projects where created_by = auth.uid()
    )
  );

create policy "Users can delete tasks in own projects"
  on tasks for delete
  using (
    project_id in (
      select id from projects where created_by = auth.uid()
    )
  );

-- Annotations: users can manage annotations on their project tasks
alter table annotations enable row level security;

create policy "Users can view annotations on own project tasks"
  on annotations for select
  using (
    task_id in (
      select t.id from tasks t
      join projects p on t.project_id = p.id
      where p.created_by = auth.uid()
    )
  );

create policy "Users can create annotations"
  on annotations for insert
  with check (
    task_id in (
      select t.id from tasks t
      join projects p on t.project_id = p.id
      where p.created_by = auth.uid()
    )
  );

create policy "Users can update own annotations"
  on annotations for update
  using (created_by = auth.uid());

create policy "Users can delete annotations on own project tasks"
  on annotations for delete
  using (
    task_id in (
      select t.id from tasks t
      join projects p on t.project_id = p.id
      where p.created_by = auth.uid()
    )
  );

-- ─── Storage Bucket ─────────────────────────
-- Create a public bucket for task images
insert into storage.buckets (id, name, public)
values ('task-images', 'task-images', true)
on conflict (id) do nothing;

-- Storage policy: authenticated users can upload
create policy "Authenticated users can upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'task-images');

-- Storage policy: anyone can view (public bucket)
create policy "Public read access for task images"
  on storage.objects for select
  to public
  using (bucket_id = 'task-images');

-- Storage policy: users can delete their uploads
create policy "Users can delete own uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'task-images');

-- ─── Updated_at trigger ─────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger annotations_updated_at
  before update on annotations
  for each row
  execute function update_updated_at();
