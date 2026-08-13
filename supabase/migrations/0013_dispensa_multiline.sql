-- Dispensa pasa de "1 socio + 1 artículo" a encabezado + líneas (como
-- orders/order_items) — una dispensa puede tener varios artículos
-- (genéticas y/o accesorios) en la misma operación.
create table dispensa_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dispensa_id uuid not null references dispensas(id) on delete cascade,
  strain_id uuid not null references strains(id),
  description text not null,
  quantity numeric not null,
  unit_price numeric not null,
  bonif1_pct numeric not null default 0,
  bonif2_pct numeric not null default 0,
  total numeric not null
);

alter table dispensa_items enable row level security;
create policy dispensa_items_tenant on dispensa_items for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Migrar las dispensas existentes (1 línea c/u) a la nueva tabla.
insert into dispensa_items (tenant_id, dispensa_id, strain_id, description, quantity, unit_price, total)
  select d.tenant_id, d.id, d.strain_id, s.name, d.grams,
    case when d.grams > 0 then d.amount / d.grams else 0 end, d.amount
  from dispensas d join strains s on s.id = d.strain_id;

alter table dispensas drop column strain_id;
alter table dispensas drop column grams;

-- Anular con auditoría — no se borra la fila, queda marcada.
alter table dispensas add column voided_at timestamptz;
alter table dispensas add column voided_by uuid references profiles(id);
alter table dispensas add column void_reason text;
