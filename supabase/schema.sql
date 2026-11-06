-- Army Men: Ataque aéreo — esquema de Supabase
-- Pegar completo en el SQL Editor de Supabase (Dashboard → SQL Editor →
-- New query → Run). Es idempotente: se puede ejecutar más de una vez.
-- No contiene claves ni datos personales: solo estructura y políticas.

-- Perfiles: un nombre visible por cuenta. Se crea automáticamente al
-- registrarse (trigger handle_new_user) y también lo actualiza el juego.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Puntuaciones: una fila por misión completada. score es el total de
-- puntos de campaña al terminar esa misión; stars 1–3 y survivors son
-- los supervivientes entregados en C.
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission int not null check (mission between 1 and 3),
  score int not null check (score >= 0),
  stars int not null check (stars between 1 and 3),
  survivors int not null default 0 check (survivors >= 0),
  created_at timestamptz not null default now()
);

-- Registro remoto de errores: lo que el juego ya guarda en localStorage
-- (src/logger.js), enviado en lotes cuando hay sesión o de forma anónima
-- si la política lo permite. Sin datos personales: solo el mensaje, la
-- pila, la versión del juego y el contexto de la partida.
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  stack text,
  version text,
  mission int,
  phase text,
  seed bigint,
  fps_ms numeric,
  device text,
  created_at timestamptz not null default now()
);

create index if not exists scores_mission_score_idx
  on public.scores (mission, score desc);
create index if not exists scores_user_created_idx
  on public.scores (user_id, created_at desc);
create index if not exists error_logs_created_idx
  on public.error_logs (created_at desc);
create index if not exists error_logs_version_idx
  on public.error_logs (version, created_at desc);

-- Row Level Security: sin esto, la clave ANON no puede leer ni escribir
-- nada. Las políticas son el verdadero permiso; la clave solo identifica
-- el proyecto.
alter table public.profiles enable row level security;
alter table public.scores enable row level security;
alter table public.error_logs enable row level security;

-- Perfiles: cada uno lee y cambia solo el suyo.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Puntuaciones: cada usuario inserta solo las suyas; el ranking es de
-- lectura pública (las filas no contienen datos personales, solo puntos,
-- estrellas y el nombre visible del perfil). Si prefieres un ranking
-- solo para usuarios con sesión, cambia "to anon, authenticated" por
-- "to authenticated" en la política de lectura.
drop policy if exists "scores_insert_own" on public.scores;
create policy "scores_insert_own" on public.scores
  for insert with check (auth.uid() = user_id);
drop policy if exists "scores_select_ranking" on public.scores;
create policy "scores_select_ranking" on public.scores
  for select to anon, authenticated using (true);

-- Errores: cualquiera (con sesión o anónimo) puede enviarlos, siempre
-- que el user_id sea el propio o nulo; solo cada usuario lee los suyos.
drop policy if exists "error_logs_insert" on public.error_logs;
create policy "error_logs_insert" on public.error_logs
  for insert to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);
drop policy if exists "error_logs_select_own" on public.error_logs;
create policy "error_logs_select_own" on public.error_logs
  for select using (auth.uid() = user_id);

-- Perfil automático al registrarse: toma el nombre visible del registro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
