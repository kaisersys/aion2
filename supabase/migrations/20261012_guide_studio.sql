-- Atreia Street / Supabase — run in the Supabase SQL Editor.
-- This migration grants no publishing rights until an owner is explicitly added
-- to public.admin_users via the trusted Supabase SQL Editor.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

-- Anyone can check their own membership, but client users cannot grant it.
drop policy if exists "Admins can see own membership" on public.admin_users;
create policy "Admins can see own membership"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 180),
  category text not null check (char_length(category) between 1 and 80),
  summary text not null default '' check (char_length(summary) <= 600),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guides_published_index
  on public.guides (status, published_at desc);
create index if not exists guides_category_index
  on public.guides (category, status);
alter table public.guides enable row level security;

-- Explicit PostgREST grants; RLS policies still gate every row.
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
revoke all on public.guides from anon, authenticated;
grant select on public.guides to anon, authenticated;
grant insert, update, delete on public.guides to authenticated;

drop policy if exists "Published guides visible to all" on public.guides;
create policy "Published guides visible to all"
  on public.guides for select to anon, authenticated
  using (status = 'published' or public.is_admin());

drop policy if exists "Admins create guides" on public.guides;
create policy "Admins create guides"
  on public.guides for insert to authenticated
  with check (public.is_admin() and author_id = (select auth.uid()));

drop policy if exists "Admins update guides" on public.guides;
create policy "Admins update guides"
  on public.guides for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins delete guides" on public.guides;
create policy "Admins delete guides"
  on public.guides for delete to authenticated
  using (public.is_admin());

create or replace function public.touch_guide_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and
    (old.status is distinct from 'published' or new.published_at is null) then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists guide_updated_timestamp on public.guides;
create trigger guide_updated_timestamp
  before update on public.guides
  for each row execute function public.touch_guide_updated_at();

-- Public image URLs are safe to expose. Upload/update/delete require admin status.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guide-images', 'guide-images', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view guide images" on storage.objects;
create policy "Public can view guide images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'guide-images');

drop policy if exists "Admins upload guide images" on storage.objects;
create policy "Admins upload guide images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'guide-images' and public.is_admin());

drop policy if exists "Admins update guide images" on storage.objects;
create policy "Admins update guide images"
  on storage.objects for update to authenticated
  using (bucket_id = 'guide-images' and public.is_admin())
  with check (bucket_id = 'guide-images' and public.is_admin());

drop policy if exists "Admins remove guide images" on storage.objects;
create policy "Admins remove guide images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'guide-images' and public.is_admin());

-- FINAL OWNER SETUP (only in trusted SQL Editor, AFTER inviting your login
-- email in Authentication -> Users; replace the placeholder with your email):
--
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'YOUR_EMAIL_HERE@example.com'
-- on conflict (user_id) do nothing;
--
-- Never expose the service_role key in Vite, GitHub Actions, or the browser.
