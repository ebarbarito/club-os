-- Dispensa: guardar el monto sugerido (grams * price_per_gram del
-- catálogo al momento de dispensar) separado del monto real cobrado,
-- para poder ver la diferencia después. Y permitir que el cobro se
-- divida en varios medios de pago (split) en vez de uno solo.
alter table dispensas add column suggested_amount numeric;

create table dispensa_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dispensa_id uuid not null references dispensas(id) on delete cascade,
  method payment_method not null,
  amount numeric not null
);

alter table dispensa_payments enable row level security;
create policy dispensa_payments_tenant on dispensa_payments for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- El método pasa a vivir solo en dispensa_payments (puede haber más de
-- uno por dispensa); antes de dropear la columna, migramos lo existente.
insert into dispensa_payments (tenant_id, dispensa_id, method, amount)
  select tenant_id, id, method, amount from dispensas where method is not null;

alter table dispensas drop column method;
