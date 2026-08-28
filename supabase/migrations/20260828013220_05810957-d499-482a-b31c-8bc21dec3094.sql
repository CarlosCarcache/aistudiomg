create table public.gallery_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.gallery_shares to authenticated;
grant all on public.gallery_shares to service_role;

alter table public.gallery_shares enable row level security;

create policy "shares select own or admin" on public.gallery_shares
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "shares insert own" on public.gallery_shares
  for insert to authenticated with check (auth.uid() = user_id);
create policy "shares update own or admin" on public.gallery_shares
  for update to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "shares delete own or admin" on public.gallery_shares
  for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create trigger trg_gallery_shares_touch before update on public.gallery_shares
  for each row execute function public.touch_updated_at();

create or replace function public.get_shared_gallery(_token text)
returns setof public.gallery_images
language sql
stable
security definer
set search_path = public
as $$
  select gi.*
  from public.gallery_images gi
  join public.gallery_shares gs
    on gs.client_id = gi.client_id and gs.user_id = gi.user_id
  where gs.token = _token
  order by gi.created_at desc
$$;

revoke execute on function public.get_shared_gallery(text) from public;
grant execute on function public.get_shared_gallery(text) to anon, authenticated;

create policy "gallery objects read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'gallery');
create policy "gallery objects insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gallery objects update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gallery objects delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);