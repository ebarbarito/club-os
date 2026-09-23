-- Actualizar registrar_pago_proveedor para soportar tipo en items
-- El campo "tipo" en cada item puede ser 'factura' o 'nota_credito'
-- Factura: saldo = saldo - monto (reducimos deuda)
-- NC: saldo = saldo + monto (consumimos crédito, lo acercamos a 0)
create or replace function registrar_pago_proveedor(
  p_tenant_id uuid,
  p_proveedor_id uuid,
  p_fecha date,
  p_total numeric,
  p_notas text,
  p_impacta_caja boolean,
  p_created_by uuid,
  p_items jsonb  -- [{comprobante_id, monto, tipo}]  tipo: 'factura' | 'nota_credito'
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_pago_id uuid;
  v_item jsonb;
  v_tipo text;
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

    v_tipo := coalesce(v_item->>'tipo', 'factura');

    if v_tipo = 'nota_credito' then
      -- NC: saldo negativo se acerca a 0 al consumir el crédito
      update proveedor_comprobantes
      set saldo = saldo + (v_item->>'monto')::numeric
      where id = (v_item->>'comprobante_id')::uuid
        and tenant_id = p_tenant_id;
    else
      -- Factura: reducimos la deuda
      update proveedor_comprobantes
      set saldo = saldo - (v_item->>'monto')::numeric
      where id = (v_item->>'comprobante_id')::uuid
        and tenant_id = p_tenant_id;
    end if;
  end loop;

  return v_pago_id;
end;
$$;

-- Actualizar eliminar_pago_proveedor para restaurar saldos según tipo
-- Al restaurar: invertimos la operación original
-- Factura: saldo = saldo + monto (restaura la deuda)
-- NC: saldo = saldo - monto (restaura el crédito)
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
    select pc.comprobante_id, pc.monto, c.tipo
    from proveedor_pago_comprobantes pc
    join proveedor_comprobantes c on c.id = pc.comprobante_id
    where pc.pago_id = p_pago_id and pc.tenant_id = p_tenant_id
  loop
    if v_item.tipo = 'nota_credito' then
      -- Restaurar el crédito de la NC
      update proveedor_comprobantes
      set saldo = saldo - v_item.monto
      where id = v_item.comprobante_id and tenant_id = p_tenant_id;
    else
      -- Restaurar la deuda de la factura
      update proveedor_comprobantes
      set saldo = saldo + v_item.monto
      where id = v_item.comprobante_id and tenant_id = p_tenant_id;
    end if;
  end loop;

  delete from proveedor_pagos
  where id = p_pago_id and tenant_id = p_tenant_id;
end;
$$;
