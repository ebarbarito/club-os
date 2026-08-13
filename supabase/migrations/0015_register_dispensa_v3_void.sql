-- register_dispensa v3: multi-línea (genéticas y/o accesorios) + pago
-- dividido en varias cuentas configurables, cada una con su cotización.
-- El monto en pesos (amount_local = amount * exchange_rate) es lo que se
-- usa para todos los totales de Caja/Balance — `amount` queda como el
-- valor en la moneda propia de la cuenta, solo informativo.
drop function register_dispensa(uuid, uuid, numeric, numeric, jsonb);

create function register_dispensa(
  p_member_id uuid,
  p_items jsonb, -- [{"strain_id","description","quantity","unit_price","bonif1_pct","bonif2_pct"}]
  p_suggested_amount numeric,
  p_payments jsonb -- [{"account_id","amount","exchange_rate"}]
) returns dispensas
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_member_status member_status;
  v_dispensa dispensas;
  v_item jsonb;
  v_payment jsonb;
  v_qty numeric;
  v_price numeric;
  v_total numeric := 0;
  v_item_total numeric;
  v_stock_grams numeric;
  v_shift_id uuid;
begin
  select status into v_member_status from members
    where id = p_member_id and tenant_id = v_tenant;
  if v_member_status is null then
    raise exception 'Socio no encontrado';
  end if;
  if v_member_status <> 'valid' then
    raise exception 'El socio no está validado';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cargá al menos un artículo';
  end if;
  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'Cargá al menos un medio de pago';
  end if;

  -- Validar y descontar stock de cada línea antes de crear nada.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    select grams into v_stock_grams from stock
      where tenant_id = v_tenant and strain_id = (v_item->>'strain_id')::uuid
      for update of stock;
    if v_stock_grams is null then
      raise exception 'Sin stock cargado para uno de los artículos';
    end if;
    if v_stock_grams < v_qty then
      raise exception 'Stock insuficiente para uno de los artículos (disponible: %)', v_stock_grams;
    end if;
    update stock set grams = grams - v_qty, updated_at = now()
      where tenant_id = v_tenant and strain_id = (v_item->>'strain_id')::uuid;
  end loop;

  -- Total del encabezado = suma de las líneas (con bonificaciones).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;
    v_item_total := v_qty * v_price
      * (1 - coalesce((v_item->>'bonif1_pct')::numeric, 0) / 100)
      * (1 - coalesce((v_item->>'bonif2_pct')::numeric, 0) / 100);
    v_total := v_total + v_item_total;
  end loop;

  insert into dispensas (tenant_id, member_id, amount, suggested_amount, registered_by)
    values (v_tenant, p_member_id, v_total, p_suggested_amount, auth.uid())
    returning * into v_dispensa;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;
    v_item_total := v_qty * v_price
      * (1 - coalesce((v_item->>'bonif1_pct')::numeric, 0) / 100)
      * (1 - coalesce((v_item->>'bonif2_pct')::numeric, 0) / 100);
    insert into dispensa_items (tenant_id, dispensa_id, strain_id, description, quantity, unit_price, bonif1_pct, bonif2_pct, total)
      values (
        v_tenant, v_dispensa.id, (v_item->>'strain_id')::uuid, v_item->>'description', v_qty, v_price,
        coalesce((v_item->>'bonif1_pct')::numeric, 0), coalesce((v_item->>'bonif2_pct')::numeric, 0), v_item_total
      );
  end loop;

  select id into v_shift_id from caja_shifts
    where tenant_id = v_tenant and closed_at is null limit 1;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local)
      values (
        v_tenant, v_dispensa.id, (v_payment->>'account_id')::uuid,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1)
      );

    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id)
      values (
        v_tenant, v_shift_id, 'ingreso', 'Dispensa', 'Dispensa ' || v_dispensa.id,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'account_id')::uuid
      );
  end loop;

  return v_dispensa;
end;
$$;

-- Cobro contra un comprobante ya existente (Cuenta Corriente) — agrega
-- más líneas de pago a una dispensa que quedó con saldo pendiente.
create function pay_dispensa(
  p_dispensa_id uuid,
  p_payments jsonb
) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_shift_id uuid;
  v_payment jsonb;
  v_dispensa dispensas;
begin
  select * into v_dispensa from dispensas where id = p_dispensa_id and tenant_id = v_tenant;
  if v_dispensa is null then
    raise exception 'Comprobante no encontrado';
  end if;
  if v_dispensa.voided_at is not null then
    raise exception 'Este comprobante fue anulado';
  end if;

  select id into v_shift_id from caja_shifts
    where tenant_id = v_tenant and closed_at is null limit 1;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local)
      values (
        v_tenant, p_dispensa_id, (v_payment->>'account_id')::uuid,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1)
      );

    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id)
      values (
        v_tenant, v_shift_id, 'ingreso', 'Cuenta corriente', 'Cobro dispensa ' || p_dispensa_id,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'account_id')::uuid
      );
  end loop;
end;
$$;

-- Anular dispensa: revierte todo (stock vuelve, se borran los asientos de
-- caja que generó) y queda marcada con quién/cuándo la anuló. Los pagos
-- ya hechos (dispensa_payments) se mantienen como registro histórico de
-- lo que se había cobrado antes de anular.
create function void_dispensa(p_dispensa_id uuid, p_reason text) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_item record;
begin
  if not exists (select 1 from dispensas where id = p_dispensa_id and tenant_id = v_tenant and voided_at is null) then
    raise exception 'Comprobante no encontrado o ya estaba anulado';
  end if;

  for v_item in select strain_id, quantity from dispensa_items where dispensa_id = p_dispensa_id loop
    update stock set grams = grams + v_item.quantity, updated_at = now()
      where tenant_id = v_tenant and strain_id = v_item.strain_id;
  end loop;

  delete from ledger where tenant_id = v_tenant and concept like ('%' || p_dispensa_id || '%');

  update dispensas set voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
    where id = p_dispensa_id and tenant_id = v_tenant;
end;
$$;
