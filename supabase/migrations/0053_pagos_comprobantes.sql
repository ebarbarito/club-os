-- Cabecera de pago a proveedor (puede cubrir varios comprobantes)
create table proveedor_pagos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  fecha date not null,
  total numeric not null,
  notas text,
  impacta_caja boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index proveedor_pagos_proveedor_idx on proveedor_pagos(proveedor_id);
create index proveedor_pagos_tenant_idx on proveedor_pagos(tenant_id, fecha);

alter table proveedor_pagos enable row level security;
create policy proveedor_pagos_tenant on proveedor_pagos for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Detalle: qué comprobantes cubre el pago y cuánto se imputa a cada uno
create table proveedor_pago_comprobantes (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references proveedor_pagos(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  comprobante_id uuid not null references proveedor_comprobantes(id),
  monto numeric not null
);

create index proveedor_pago_comp_pago_idx on proveedor_pago_comprobantes(pago_id);

alter table proveedor_pago_comprobantes enable row level security;
create policy proveedor_pago_comp_tenant on proveedor_pago_comprobantes for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Función atómica: registrar pago y reducir saldos en un solo bloque
create or replace function registrar_pago_proveedor(
  p_tenant_id uuid,
  p_proveedor_id uuid,
  p_fecha date,
  p_total numeric,
  p_notas text,
  p_impacta_caja boolean,
  p_created_by uuid,
  p_items jsonb  -- [{comprobante_id, monto}]
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_pago_id uuid;
  v_item jsonb;
begin
  insert into proveedor_pagos (tenant_id, proveedor_id, fecha, total, notas, impacta_caja, created_by)
  values (p_tenant_id, p_proveedor_id, p_fecha, p_total, p_notas, p_impacta_caja, p_created_by)
  returning id into v_pago_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into proveedor_pago_comprobantes (pago_id, tenant_id, comprobante_id, monto)
    values (
      v_pago_id,
      p_tenant_id,
      (v_item->>'comprobante_id')::uuid,
      (v_item->>'monto')::numeric
    );

    update proveedor_comprobantes
    set saldo = saldo - (v_item->>'monto')::numeric
    where id = (v_item->>'comprobante_id')::uuid
      and tenant_id = p_tenant_id;
  end loop;

  return v_pago_id;
end;
$$;

-- Función atómica: eliminar pago y restaurar saldos
create or replace function eliminar_pago_proveedor(
  p_pago_id uuid,
  p_tenant_id uuid
) returns void
language plpgsql
security invoker
as $$
declare
  v_item record;
begin
  for v_item in
    select comprobante_id, monto
    from proveedor_pago_comprobantes
    where pago_id = p_pago_id and tenant_id = p_tenant_id
  loop
    update proveedor_comprobantes
    set saldo = saldo + v_item.monto
    where id = v_item.comprobante_id and tenant_id = p_tenant_id;
  end loop;

  delete from proveedor_pagos
  where id = p_pago_id and tenant_id = p_tenant_id;
end;
$$;
