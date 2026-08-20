create type public.order_status as enum ('nuevo','en_proceso','terminado');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
create policy "clients select own or admin" on public.clients for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "clients insert own" on public.clients for insert to authenticated with check (auth.uid() = user_id);
create policy "clients update own or admin" on public.clients for update to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "clients delete own or admin" on public.clients for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  role_title text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.employees to authenticated;
grant all on public.employees to service_role;
alter table public.employees enable row level security;
create policy "employees select own or admin" on public.employees for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "employees insert own" on public.employees for insert to authenticated with check (auth.uid() = user_id);
create policy "employees update own or admin" on public.employees for update to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "employees delete own or admin" on public.employees for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'Nuevo pedido',
  description text,
  status public.order_status not null default 'nuevo',
  price numeric(12,2),
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders select own or admin" on public.orders for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "orders insert own" on public.orders for insert to authenticated with check (auth.uid() = user_id);
create policy "orders update own or admin" on public.orders for update to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "orders delete own or admin" on public.orders for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create index idx_orders_status on public.orders(status);
create index idx_orders_user on public.orders(user_id);
create index idx_clients_user on public.clients(user_id);
create index idx_employees_user on public.employees(user_id);

create trigger trg_clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger trg_employees_touch before update on public.employees for each row execute function public.touch_updated_at();
create trigger trg_orders_touch before update on public.orders for each row execute function public.touch_updated_at();