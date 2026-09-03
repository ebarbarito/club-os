-- Empleados (Modificaciones 1/9/26): alta de empleados con remuneración
-- pactada, y un concepto de "sueldo <nombre>" por cada uno disponible en
-- Caja, con tope mensual = remuneración - adelantos ya tomados este mes.
create table employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  last_name text not null,
  dni text not null,
  salary numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table employees enable row level security;
create policy employees_tenant on employees for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Vínculo a los movimientos de "sueldo" — más confiable que matchear por
-- texto del concepto (que puede repetirse o cambiar si se edita el
-- nombre del empleado).
alter table ledger add column employee_id uuid references employees(id);
