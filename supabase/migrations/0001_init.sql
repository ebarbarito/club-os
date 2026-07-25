-- Club OS — schema inicial multi-tenant
-- Un Postgres compartido, aislamiento por tenant_id + RLS.
-- Cada tabla de negocio lleva tenant_id y una policy que la limita
-- al tenant del usuario autenticado (via profiles.tenant_id).

create extension if not exists "pgcrypto";

-- ============================================================
-- TENANTS
-- ============================================================
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- subdominio: {slug}.tuclub.app
  name text not null,
  logo_url text,
  theme jsonb not null default '{
    "primary": "#1c5c41",
    "accent": "#c9a14a",
    "dark": "#0a261b",
    "bg": "#f6f3ea"
  }'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROFILES — 1 fila por usuario de Supabase Auth, ligado a un tenant + rol
-- ============================================================
create type user_role as enum ('admin', 'dispensador', 'cultivo');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  role user_role not null,
  created_at timestamptz not null default now()
);

create index profiles_tenant_idx on profiles(tenant_id);

-- Helper: tenant del usuario autenticado actual
create function current_tenant_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select tenant_id from profiles where id = auth.uid()
$$;

-- ============================================================
-- STRAINS (genéticas) — catálogo por tenant
-- ============================================================
create type strain_type as enum ('Indica', 'Sativa', 'Híbrida', 'Alto CBD');

create table strains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  type strain_type not null,
  thc numeric,
  cbd numeric,
  price_per_gram numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

-- ============================================================
-- MEMBERS (socios)
-- ============================================================
create type member_status as enum ('draft', 'pending', 'valid', 'rejected');
create type member_modalidad as enum ('propio', 'solidario', 'ong');
create type reprocann_status as enum ('vigente', 'tramite', 'no');

create table members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  dni text not null,
  birth date,
  phone text,
  email text,
  zona text,
  reprocann reprocann_status not null default 'no',
  repr_num text,
  repr_exp date,
  doctor text,
  matricula text,
  modalidad member_modalidad,
  patologia text,
  status member_status not null default 'draft',
  alta_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, dni)
);

create index members_tenant_idx on members(tenant_id);
create index members_status_idx on members(tenant_id, status);

-- Documentación adjunta al alta (archivos en Supabase Storage)
create table member_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  storage_path text not null,
  label text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORDERS (pedidos / reservas)
-- ============================================================
create type order_delivery as enum ('pickup', 'shipping');
create type order_status as enum ('reservado', 'preparacion', 'listo', 'enviando', 'entregado', 'cancelado');

create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id),
  delivery order_delivery not null,
  status order_status not null default 'reservado',
  pickup_day date,
  pickup_time text,
  address text,
  zona text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  strain_id uuid not null references strains(id),
  grams numeric not null
);

-- ============================================================
-- DISPENSAS (entregas facturadas)
-- ============================================================
create type payment_method as enum ('efectivo', 'transferencia');

create table dispensas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id),
  strain_id uuid not null references strains(id),
  grams numeric not null,
  amount numeric not null,
  method payment_method not null,
  registered_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- STOCK (inventario por genética)
-- ============================================================
create table stock (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  strain_id uuid not null references strains(id),
  grams numeric not null default 0,
  min_grams numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (tenant_id, strain_id)
);

-- ============================================================
-- SALAS & CULTIVO
-- Nota: lecturas de sensores en vivo viven en InfluxDB (tag club_id + sala_id),
-- no en Postgres. Esta tabla es config/estado, no series temporales.
-- ============================================================
create type sala_etapa as enum ('vegetativo', 'floracion', 'secado');

create table salas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  strain_id uuid references strains(id),
  etapa sala_etapa not null default 'vegetativo',
  etapa_dias int not null default 0,
  capacity int not null default 0,
  plants int not null default 0,
  cosecha_estimada date,
  responsable text,
  temp_min numeric, temp_max numeric,
  hum_min numeric, hum_max numeric,
  -- id de sensor físico asociado (tag `sensor` en InfluxDB)
  sensor_id text,
  created_at timestamptz not null default now()
);

create index salas_tenant_idx on salas(tenant_id);

-- Cierres de ciclo de cultivo (rendimiento cosechado -> suma a stock)
create table ciclos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sala_id uuid not null references salas(id),
  closed_at timestamptz not null default now(),
  closed_by uuid references profiles(id)
);

create table ciclo_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  ciclo_id uuid not null references ciclos(id) on delete cascade,
  strain_id uuid not null references strains(id),
  grams numeric not null
);

-- ============================================================
-- LEDGER (movimientos financieros) + CAJA (turnos)
-- ============================================================
create type ledger_type as enum ('ingreso', 'egreso');

create table caja_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  opened_by uuid references profiles(id),
  opening_cash numeric not null default 0,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  counted_cash numeric,
  difference numeric
);

create index caja_shifts_open_idx on caja_shifts(tenant_id) where closed_at is null;

create table ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  shift_id uuid references caja_shifts(id),
  type ledger_type not null,
  category text not null,
  concept text not null,
  amount numeric not null,
  method payment_method not null,
  created_at timestamptz not null default now()
);

create index ledger_tenant_month_idx on ledger(tenant_id, created_at);

-- ============================================================
-- RLS — todas las tablas de negocio se filtran por current_tenant_id()
-- ============================================================
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table strains enable row level security;
alter table members enable row level security;
alter table member_documents enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table dispensas enable row level security;
alter table stock enable row level security;
alter table salas enable row level security;
alter table ciclos enable row level security;
alter table ciclo_items enable row level security;
alter table caja_shifts enable row level security;
alter table ledger enable row level security;

-- profiles: cada usuario ve solo su propia fila (para resolver su tenant)
create policy profiles_self on profiles
  for select using (id = auth.uid());

-- tenants: lectura pública (slug/name/logo/theme son datos de branding que
-- el sitio público de cada club debe poder mostrar sin estar logueado).
-- No hay policy de insert/update/delete: el alta de tenants es manual, vía
-- script con service_role (bypassea RLS) — ver scripts/create-tenant.ts.
create policy tenants_public_read on tenants
  for select using (true);

-- patrón repetido para el resto: select/insert/update/delete limitados al tenant actual
create policy strains_tenant on strains for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy members_tenant on members for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy member_documents_tenant on member_documents for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy orders_tenant on orders for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy order_items_tenant on order_items for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy dispensas_tenant on dispensas for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy stock_tenant on stock for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy salas_tenant on salas for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy ciclos_tenant on ciclos for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy ciclo_items_tenant on ciclo_items for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy caja_shifts_tenant on caja_shifts for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy ledger_tenant on ledger for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Nota: RLS acá solo garantiza aislamiento de tenant (multi-tenant), no
-- permisos por rol (admin/dispensador/cultivo) — eso se controla en la app
-- (middleware + chequeo de profiles.role). Las policies "for all" arriba son
-- permissive: agregar una policy extra más restrictiva para un solo rol NO
-- lo bloquea (Postgres hace OR entre policies permissive del mismo comando).
-- Si más adelante se quiere reforzar el rol a nivel de fila, usar policies
-- `as restrictive` explícitas, no policies permissive adicionales.
