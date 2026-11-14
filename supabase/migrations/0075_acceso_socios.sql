-- Acceso de socios al sitio público: usuario = DNI, contraseña propia.
--
-- La primera vez (o si se olvida la contraseña) el socio pide una clave
-- provisoria, que llega al mail registrado en su ficha y vence en 30
-- minutos. Con esa clave entra una sola vez y el sistema lo obliga a crear
-- su contraseña definitiva.
--
-- Contraseñas, claves provisorias y tokens de sesión se guardan solo como
-- hash. Las tablas no tienen políticas: las lee y escribe únicamente el
-- servidor (service_role); el panel muestra el estado del acceso a través
-- de sus propias acciones.

create table member_accesos (
  member_id uuid primary key references members(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  password_hash text,
  password_at timestamptz,
  clave_temp_hash text,
  clave_temp_expira timestamptz,
  clave_temp_enviada_at timestamptz,
  envios_fecha date,
  envios_dia int not null default 0,
  intentos_fallidos int not null default 0,
  bloqueado_hasta timestamptz,
  ultimo_ingreso_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_accesos_tenant_idx on member_accesos(tenant_id);
alter table member_accesos enable row level security;

create table member_sesiones (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  member_id uuid not null references members(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  debe_cambiar_clave boolean not null default false,
  expira_at timestamptz not null,
  created_at timestamptz not null default now(),
  ultimo_uso_at timestamptz not null default now()
);

create index member_sesiones_member_idx on member_sesiones(member_id);
alter table member_sesiones enable row level security;

-- Busca un socio por DNI dentro del club, ignorando puntos, espacios y
-- guiones ("30.123.456" = "30123456").
create or replace function socio_por_dni(p_tenant uuid, p_dni text)
returns table (id uuid, name text, email text, status text)
language sql stable as $$
  select m.id, m.name, m.email, m.status::text
  from members m
  where m.tenant_id = p_tenant
    and m.deleted_at is null
    and regexp_replace(coalesce(m.dni, ''), '\D', '', 'g') = regexp_replace(coalesce(p_dni, ''), '\D', '', 'g')
    and length(regexp_replace(coalesce(p_dni, ''), '\D', '', 'g')) >= 6
  order by (m.status = 'valid') desc, m.created_at desc
  limit 1;
$$;

revoke all on function socio_por_dni(uuid, text) from public, anon, authenticated;
