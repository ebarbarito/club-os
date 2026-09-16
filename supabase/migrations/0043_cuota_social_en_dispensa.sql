-- Integra cuota social (0042) al flujo de dispensa: register_dispensa y
-- update_dispensa, cuando reciben una línea de pago con la cuenta virtual
-- "cuota_social", ahora consumen primero el crédito legacy en
-- member_credits (plata real ya cobrada antes) y, si no alcanza, cargos
-- pendientes de cuota_social_charges (más viejo primero) — generando ahí
-- sí un ingreso real en ledger, porque esa plata nunca se había cobrado.
-- void_dispensa y update_dispensa también aprenden a revertir esto.
begin;

create function apply_cuota_social_credit(
  p_member_id uuid,
  p_dispensa_id uuid,
  p_amount numeric,
  p_dispensa_number integer,
  p_shift_id uuid,
  p_account_id uuid,
  p_exchange_rate numeric
) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_legacy_available numeric;
  v_charges_available numeric;
  v_from_legacy numeric;
  v_from_charges numeric;
  v_charge record;
  v_remaining numeric;
  v_take numeric;
  v_ledger_id uuid;
begin
  select coalesce(sum(amount), 0) into v_legacy_available
    from member_credits where tenant_id = v_tenant and member_id = p_member_id and kind = 'cuota_social';
  select coalesce(sum(amount - paid_amount), 0) into v_charges_available
    from cuota_social_charges where tenant_id = v_tenant and member_id = p_member_id and paid_amount < amount;

  if p_amount > v_legacy_available + v_charges_available + 0.01 then
    raise exception 'Cuota social: crédito insuficiente (disponible: %)', v_legacy_available + v_charges_available;
  end if;

  v_from_legacy := least(p_amount, greatest(v_legacy_available, 0));
  v_from_charges := p_amount - v_from_legacy;

  if v_from_legacy > 0.005 then
    insert into member_credits (tenant_id, member_id, dispensa_id, kind, amount, description)
      values (v_tenant, p_member_id, p_dispensa_id, 'cuota_social', -v_from_legacy, 'Crédito cuota social aplicado a Dispensa N°' || p_dispensa_number);
  end if;

  v_remaining := v_from_charges;
  if v_remaining > 0.005 then
    for v_charge in
      select * from cuota_social_charges
        where tenant_id = v_tenant and member_id = p_member_id and paid_amount < amount
        order by periodo asc
        for update
    loop
      exit when v_remaining <= 0.005;
      v_take := least(v_remaining, v_charge.amount - v_charge.paid_amount);
      if v_take <= 0.005 then continue; end if;

      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id)
        values (
          v_tenant, p_shift_id, 'ingreso', 'Cuota social',
          'Cuota social ' || to_char(v_charge.periodo, 'TMMonth YYYY') || ' — Dispensa N°' || p_dispensa_number,
          v_take / p_exchange_rate, p_exchange_rate, v_take, p_account_id, p_dispensa_id
        )
        returning id into v_ledger_id;

      update cuota_social_charges
        set paid_amount = paid_amount + v_take,
            paid_at = case when paid_amount + v_take >= amount - 0.005 then now() else paid_at end
        where id = v_charge.id;

      insert into cuota_social_payments (tenant_id, charge_id, dispensa_id, amount, ledger_id, created_by)
        values (v_tenant, v_charge.id, p_dispensa_id, v_take, v_ledger_id, auth.uid());

      v_remaining := v_remaining - v_take;
    end loop;
  end if;
end;
$$;

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
  v_main_account_id uuid;
  v_main_rate numeric := 1;
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

  -- cuenta "real" de referencia para el ingreso de cuota social cuando se
  -- consume como parte de esta dispensa (la plata es la misma que la del
  -- pago real de la dispensa) — la primera cuenta no virtual del pago, o
  -- la cuenta de efectivo del tenant si todo el pago fue con cuentas
  -- virtuales.
  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    select virtual_kind into v_virtual_kind from payment_accounts
      where id = (v_payment->>'account_id')::uuid and tenant_id = v_tenant and is_virtual;
    if v_virtual_kind is null then
      v_main_account_id := (v_payment->>'account_id')::uuid;
      v_main_rate := coalesce((v_payment->>'exchange_rate')::numeric, 1);
      exit;
    end if;
  end loop;
  if v_main_account_id is null then
    select id into v_main_account_id from payment_accounts where tenant_id = v_tenant and is_cash limit 1;
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
        if v_virtual_kind = 'cuota_social' then
          perform apply_cuota_social_credit(p_member_id, v_dispensa.id, v_take, v_dispensa.number, v_shift_id, v_main_account_id, v_main_rate);
        else
          perform apply_member_credit(p_member_id, v_dispensa.id, v_take, v_dispensa.number, v_virtual_kind);
        end if;
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

create or replace function update_dispensa(
  p_dispensa_id uuid,
  p_member_id uuid,
  p_items jsonb,
  p_note text,
  p_payments jsonb
) returns dispensas
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_old dispensas;
  v_new dispensas;
  v_old_item record;
  v_item jsonb;
  v_payment jsonb;
  v_qty numeric;
  v_price numeric;
  v_total numeric := 0;
  v_item_total numeric;
  v_stock_grams numeric;
  v_shift_id uuid;
  v_receipt integer;
  v_old_member_name text;
  v_new_member_name text;
  v_old_items_desc text;
  v_new_items_desc text;
  v_old_payments_desc text;
  v_new_payments_desc text;
  v_desc text;
  v_virtual_kind text;
  v_pay_amount_local numeric;
  v_alloc_remaining numeric;
  v_take numeric;
  v_leftover numeric;
  v_main_account_id uuid;
  v_main_rate numeric := 1;
  v_cs_payment record;
begin
  select * into v_old from dispensas where id = p_dispensa_id and tenant_id = v_tenant;
  if v_old is null then
    raise exception 'Comprobante no encontrado';
  end if;
  if v_old.voided_at is not null then
    raise exception 'No se puede modificar un comprobante anulado';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cargá al menos un artículo';
  end if;

  select name into v_old_member_name from members where id = v_old.member_id;
  select string_agg(description || ' x' || quantity || ' ($' || total || ')', ', ') into v_old_items_desc
    from dispensa_items where dispensa_id = p_dispensa_id;
  select receipt_number, shift_id into v_receipt, v_shift_id
    from ledger where dispensa_id = p_dispensa_id and category = 'Dispensa' limit 1;
  select string_agg(coalesce(a.name, '—') || ' $' || dp.amount_local, ', ') into v_old_payments_desc
    from dispensa_payments dp left join payment_accounts a on a.id = dp.account_id
    where dp.dispensa_id = p_dispensa_id and dp.receipt_number is not distinct from v_receipt;

  -- revertir stock de los ítems viejos
  for v_old_item in select strain_id, quantity from dispensa_items where dispensa_id = p_dispensa_id loop
    update stock set grams = grams + v_old_item.quantity, updated_at = now()
      where tenant_id = v_tenant and strain_id = v_old_item.strain_id;
  end loop;
  delete from dispensa_items where dispensa_id = p_dispensa_id;

  -- aplicar stock de los ítems nuevos
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
    insert into dispensa_items (tenant_id, dispensa_id, strain_id, description, quantity, unit_price, bonif1_pct, bonif2_pct, total)
      values (
        v_tenant, p_dispensa_id, (v_item->>'strain_id')::uuid, v_item->>'description', v_qty, v_price,
        coalesce((v_item->>'bonif1_pct')::numeric, 0), coalesce((v_item->>'bonif2_pct')::numeric, 0), v_item_total
      );
  end loop;

  update dispensas set member_id = p_member_id, amount = v_total, note = p_note
    where id = p_dispensa_id and tenant_id = v_tenant
    returning * into v_new;

  -- reemplazar solo las líneas de pago de la registración original --
  -- incluye devolver cualquier crédito consumido (legacy y cargos de
  -- cuota social) y borrar cualquier saldo a favor generado por sobrepago
  -- en una edición anterior, para volver a calcular todo desde cero con
  -- lo que se pide ahora.
  for v_cs_payment in select * from cuota_social_payments where dispensa_id = p_dispensa_id loop
    update cuota_social_charges
      set paid_amount = greatest(0, paid_amount - v_cs_payment.amount),
          paid_at = case when paid_amount - v_cs_payment.amount < amount - 0.005 then null else paid_at end
      where id = v_cs_payment.charge_id;
  end loop;
  delete from cuota_social_payments where dispensa_id = p_dispensa_id;

  delete from dispensa_payments where dispensa_id = p_dispensa_id and receipt_number is not distinct from v_receipt;
  delete from ledger where dispensa_id = p_dispensa_id and category in ('Dispensa', 'Cuota social') and receipt_number is not distinct from v_receipt;
  delete from member_credits where dispensa_id = p_dispensa_id;

  if v_shift_id is null then
    select id into v_shift_id from caja_shifts
      where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;
  end if;

  if jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 0 then
    if v_receipt is null then
      select next_receipt_number() into v_receipt;
    end if;

    for v_payment in select * from jsonb_array_elements(p_payments) loop
      select virtual_kind into v_virtual_kind from payment_accounts
        where id = (v_payment->>'account_id')::uuid and tenant_id = v_tenant and is_virtual;
      if v_virtual_kind is null then
        v_main_account_id := (v_payment->>'account_id')::uuid;
        v_main_rate := coalesce((v_payment->>'exchange_rate')::numeric, 1);
        exit;
      end if;
    end loop;
    if v_main_account_id is null then
      select id into v_main_account_id from payment_accounts where tenant_id = v_tenant and is_cash limit 1;
    end if;

    v_alloc_remaining := v_total;
    for v_payment in select * from jsonb_array_elements(p_payments) loop
      v_pay_amount_local := (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1);
      v_take := least(v_pay_amount_local, greatest(v_alloc_remaining, 0));
      v_leftover := v_pay_amount_local - v_take;
      v_alloc_remaining := v_alloc_remaining - v_take;

      select virtual_kind into v_virtual_kind from payment_accounts
        where id = (v_payment->>'account_id')::uuid and tenant_id = v_tenant and is_virtual;

      if v_virtual_kind is not null then
        if v_take > 0.005 then
          insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
            values (v_tenant, p_dispensa_id, (v_payment->>'account_id')::uuid, v_take, 1, v_take, v_receipt);
          if v_virtual_kind = 'cuota_social' then
            perform apply_cuota_social_credit(p_member_id, p_dispensa_id, v_take, v_old.number, v_shift_id, v_main_account_id, v_main_rate);
          else
            perform apply_member_credit(p_member_id, p_dispensa_id, v_take, v_old.number, v_virtual_kind);
          end if;
        end if;
      else
        insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
          values (
            v_tenant, p_dispensa_id, (v_payment->>'account_id')::uuid,
            (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
            v_pay_amount_local, v_receipt
          );
        insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
          values (
            v_tenant, v_shift_id, 'ingreso', 'Dispensa',
            'rec' || lpad(v_receipt::text, 2, '0') || ' Dispensa N°' || v_old.number,
            (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
            v_pay_amount_local, (v_payment->>'account_id')::uuid, p_dispensa_id, v_receipt
          );
        if v_leftover > 0.005 then
          insert into member_credits (tenant_id, member_id, dispensa_id, kind, amount, description, receipt_number, created_by)
            values (v_tenant, p_member_id, p_dispensa_id, 'general', v_leftover, 'Saldo a favor generado', v_receipt, auth.uid());
        end if;
      end if;
    end loop;
  end if;

  select name into v_new_member_name from members where id = p_member_id;
  select string_agg(description || ' x' || quantity || ' ($' || total || ')', ', ') into v_new_items_desc
    from dispensa_items where dispensa_id = p_dispensa_id;
  select string_agg(coalesce(a.name, '—') || ' $' || dp.amount_local, ', ') into v_new_payments_desc
    from dispensa_payments dp left join payment_accounts a on a.id = dp.account_id
    where dp.dispensa_id = p_dispensa_id and dp.receipt_number is not distinct from v_receipt;

  v_desc :=
    'Dispensa N°' || v_old.number || E'\n' ||
    'Socio: ' || coalesce(v_old_member_name, '—') || ' → ' || coalesce(v_new_member_name, '—') || E'\n' ||
    'Total: $' || v_old.amount || ' → $' || v_total || E'\n' ||
    'Ítems: ' || coalesce(v_old_items_desc, '—') || ' → ' || coalesce(v_new_items_desc, '—') || E'\n' ||
    'Pagos: ' || coalesce(v_old_payments_desc, '—') || ' → ' || coalesce(v_new_payments_desc, '—') || E'\n' ||
    'Nota: ' || coalesce(v_old.note, '—') || ' → ' || coalesce(p_note, '—');

  insert into audit_log (tenant_id, user_id, entity_type, entity_id, change_type, description)
    values (v_tenant, auth.uid(), 'dispensa', p_dispensa_id, 'edicion', v_desc);

  return v_new;
end;
$$;

-- void_dispensa: además de revertir stock/ledger, ahora también restaura
-- cualquier crédito consumido/generado (member_credits — esto ya faltaba
-- antes de este cambio, se corrige de paso) y cualquier cargo de cuota
-- social que esta dispensa haya saldado.
create or replace function void_dispensa(p_dispensa_id uuid, p_reason text) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_dispensa dispensas;
  v_item record;
  v_member_name text;
  v_items_desc text;
  v_cs_payment record;
begin
  select * into v_dispensa from dispensas
    where id = p_dispensa_id and tenant_id = v_tenant and voided_at is null;
  if v_dispensa is null then
    raise exception 'Comprobante no encontrado o ya estaba anulado';
  end if;

  select name into v_member_name from members where id = v_dispensa.member_id;
  select string_agg(description || ' x' || quantity || ' ($' || total || ')', ', ') into v_items_desc
    from dispensa_items where dispensa_id = p_dispensa_id;

  for v_item in select strain_id, quantity from dispensa_items where dispensa_id = p_dispensa_id loop
    update stock set grams = grams + v_item.quantity, updated_at = now()
      where tenant_id = v_tenant and strain_id = v_item.strain_id;
  end loop;

  delete from ledger where tenant_id = v_tenant and dispensa_id = p_dispensa_id;
  delete from member_credits where tenant_id = v_tenant and dispensa_id = p_dispensa_id;

  for v_cs_payment in select * from cuota_social_payments where dispensa_id = p_dispensa_id loop
    update cuota_social_charges
      set paid_amount = greatest(0, paid_amount - v_cs_payment.amount),
          paid_at = case when paid_amount - v_cs_payment.amount < amount - 0.005 then null else paid_at end
      where id = v_cs_payment.charge_id;
  end loop;
  delete from cuota_social_payments where dispensa_id = p_dispensa_id;

  update dispensas set voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
    where id = p_dispensa_id and tenant_id = v_tenant;

  insert into audit_log (tenant_id, user_id, entity_type, entity_id, change_type, description, reason)
    values (
      v_tenant, auth.uid(), 'dispensa', p_dispensa_id, 'eliminacion',
      'Dispensa N°' || v_dispensa.number || ' · ' || coalesce(v_member_name, '—') || ' · $' || v_dispensa.amount || E'\n' ||
      'Ítems: ' || coalesce(v_items_desc, '—'),
      p_reason
    );
end;
$$;

commit;
