-- Roles enum
create type public.app_role as enum ('admin', 'editor', 'viewer');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles (separate table for security)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role security definer function (avoids RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Sin título',
  description text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;

-- Chats
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null default 'Nuevo chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chats enable row level security;

-- Chat messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;

-- Profiles policies
create policy "profiles select own or admin" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "profiles update own" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- user_roles policies
create policy "user_roles select own or admin" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "user_roles admin manage" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Projects policies
create policy "projects select own or admin" on public.projects
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "projects insert own" on public.projects
  for insert to authenticated with check (auth.uid() = user_id);
create policy "projects update own" on public.projects
  for update to authenticated using (auth.uid() = user_id);
create policy "projects delete own or admin" on public.projects
  for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Chats policies
create policy "chats select own or admin" on public.chats
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "chats insert own" on public.chats
  for insert to authenticated with check (auth.uid() = user_id);
create policy "chats update own" on public.chats
  for update to authenticated using (auth.uid() = user_id);
create policy "chats delete own" on public.chats
  for delete to authenticated using (auth.uid() = user_id);

-- chat_messages policies (via parent chat ownership)
create policy "messages select via chat" on public.chat_messages
  for select to authenticated
  using (exists (select 1 from public.chats c where c.id = chat_id and (c.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "messages insert via chat" on public.chat_messages
  for insert to authenticated
  with check (exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid()));
create policy "messages delete via chat" on public.chat_messages
  for delete to authenticated
  using (exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid()));

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trg_projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger trg_chats_touch before update on public.chats
  for each row execute function public.touch_updated_at();

-- Auto-create profile and assign viewer role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role) values (new.id, 'viewer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();