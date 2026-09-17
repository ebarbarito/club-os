-- Plan de cuentas: tabla de conceptos configurables por tenant.
-- Reemplaza el array hardcodeado en el formulario de caja.
-- Cada concepto indica si puede usarse como ingreso, egreso o ambos.
begin;

create table ledger_concepts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  allows_ingreso boolean not null default true,
  allows_egreso boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index ledger_concepts_tenant_idx on ledger_concepts (tenant_id, active, sort_order);

alter table ledger_concepts enable row level security;
create policy ledger_concepts_tenant on ledger_concepts for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Seed: conceptos por defecto para cada tenant existente.
-- Sueldo = solo egreso (se gestiona desde la solapa Empleados).
insert into ledger_concepts (tenant_id, name, allows_ingreso, allows_egreso, sort_order)
select t.id, c.name, c.allows_ingreso, c.allows_egreso, c.sort_order
from tenants t
cross join (
  values
    ('Alquiler',    false, true,  1),
    ('Almacén',     true,  true,  2),
    ('Eventos',     true,  true,  3),
    ('Ferretería',  false, true,  4),
    ('Insumos',     false, true,  5),
    ('Membresía',   true,  false, 6),
    ('Operativo',   false, true,  7),
    ('Servicios',   false, true,  8),
    ('Sueldo',      false, true,  9),
    ('Otro',        true,  true,  10)
) as c(name, allows_ingreso, allows_egreso, sort_order)
on conflict (tenant_id, name) do nothing;

commit;
