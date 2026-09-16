-- Modificaciones 15/9/26: permitir dispensar a un socio que no está
-- "valid" (pendiente, borrador, rechazado) — el aviso ahora lo maneja la
-- UI (RegisterDispensaForm) mostrando un warning antes de confirmar; el
-- RPC ya no lo bloquea, solo sigue exigiendo que el socio exista.
create or replace function register_dispensa(
  p_member_id uuid,
  p_items jsonb,
  p_suggested_amount numeric,
  p_payments jsonb,
  p_note text default null
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
  v_receipt integer;
  v_virtual_kind text;
  v_pay_amount_local numeric;
  v_alloc_remaining numeric;
  v_take numeric;
  v_leftover numeric;
begin
  select status into v_member_status from members
    where id = p_member_id and tenant_id = v_tenant;
  if v_member_status is null then
    raise exception 'Socio no encontrado';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cargá al menos un artículo';
  end if;

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

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;
    v_item_total := v_qty * v_price
      * (1 - coalesce((v_item->>'bonif1_pct')::numeric, 0) / 100)
      * (1 - coalesce((v_item->>'bonif2_pct')::numeric, 0) / 100);
    v_total := v_total + v_item_total;
  end loop;

  insert into dispensas (tenant_id, member_id, amount, suggested_amount, registered_by, note)
    values (v_tenant, p_member_id, v_total, p_suggested_amount, auth.uid(), p_note)
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
    where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;

  if jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 0 then
    select next_receipt_number() into v_receipt;
  end if;

  v_alloc_remaining := v_total;
  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_pay_amount_local := (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1);
    v_take := least(v_pay_amount_local, greatest(v_alloc_remaining, 0));
    v_leftover := v_pay_amount_local - v_take;
    v_alloc_remaining := v_alloc_remaining - v_take;

    select virtual_kind into v_virtual_kind from payment_accounts
      where id = (v_payment->>'account_id')::uuid and tenant_id = v_tenant and is_virtual;

    if v_virtual_kind is not null then
      if v_take > 0.005 then
        insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
          values (v_tenant, v_dispensa.id, (v_payment->>'account_id')::uuid, v_take, 1, v_take, v_receipt);
        perform apply_member_credit(p_member_id, v_dispensa.id, v_take, v_dispensa.number, v_virtual_kind);
      end if;
    else
      insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
        values (
          v_tenant, v_dispensa.id, (v_payment->>'account_id')::uuid,
          (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
          v_pay_amount_local, v_receipt
        );
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
        values (
          v_tenant, v_shift_id, 'ingreso', 'Dispensa',
          'rec' || lpad(v_receipt::text, 2, '0') || ' Dispensa N°' || v_dispensa.number,
          (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
          v_pay_amount_local, (v_payment->>'account_id')::uuid, v_dispensa.id, v_receipt
        );
      if v_leftover > 0.005 then
        insert into member_credits (tenant_id, member_id, dispensa_id, kind, amount, description, receipt_number, created_by)
          values (v_tenant, p_member_id, v_dispensa.id, 'general', v_leftover, 'Saldo a favor generado', v_receipt, auth.uid());
      end if;
    end if;
  end loop;

  return v_dispensa;
end;
$$;
