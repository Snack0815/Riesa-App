-- Riesa Fahrten: gemeinsame Datenbank für Personen, Autos und Fahrten.
-- In der Supabase SQL Editor (Dashboard -> SQL Editor -> New query) einmalig ausführen.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  accent_color text not null default '#4f8dfd',
  car_brand text not null default '',
  car_model text not null default '',
  car_year int,
  car_color text,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists trips_person_id_idx on public.trips(person_id);
create index if not exists trips_date_idx on public.trips(date);

-- ---------------------------------------------------------------------------
-- Row Level Security: nur eingeloggte Nutzer (unser gemeinsamer Account) dürfen
-- lesen und schreiben. Ohne gültige Session (anon) ist die Tabelle komplett
-- unsichtbar - das ist unser "privater Bereich".
-- ---------------------------------------------------------------------------

alter table public.people enable row level security;
alter table public.trips enable row level security;

drop policy if exists "people_select_authenticated" on public.people;
create policy "people_select_authenticated"
  on public.people for select
  to authenticated
  using (true);

drop policy if exists "people_insert_authenticated" on public.people;
create policy "people_insert_authenticated"
  on public.people for insert
  to authenticated
  with check (true);

drop policy if exists "people_update_authenticated" on public.people;
create policy "people_update_authenticated"
  on public.people for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "people_delete_authenticated" on public.people;
create policy "people_delete_authenticated"
  on public.people for delete
  to authenticated
  using (true);

drop policy if exists "trips_select_authenticated" on public.trips;
create policy "trips_select_authenticated"
  on public.trips for select
  to authenticated
  using (true);

drop policy if exists "trips_insert_authenticated" on public.trips;
create policy "trips_insert_authenticated"
  on public.trips for insert
  to authenticated
  with check (true);

drop policy if exists "trips_update_authenticated" on public.trips;
create policy "trips_update_authenticated"
  on public.trips for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "trips_delete_authenticated" on public.trips;
create policy "trips_delete_authenticated"
  on public.trips for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Realtime: Änderungen an beide Geräte live pushen (Postgres Changes).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.people;
alter publication supabase_realtime add table public.trips;
