-- Caja pasa a tener dos turnos independientes: "diaria" (el uso de todos
-- los dias) y "general" (caja de respaldo, solo admin). Al cerrar un
-- turno diario se reabre solo con el efectivo contado como apertura, y
-- se vuelca un resumen por cuenta a la caja general abierta (si hay una).
--
-- De paso: ledger gana un dispensa_id real (antes se matcheaba la
-- dispensa por texto dentro de concept con LIKE, un hack fragil) y el
-- concepto de los pagos de dispensa pasa a mostrar "recNN" + n° de
-- dispensa en vez del uuid interno.

create type caja_kind as enum ('diaria', 'general');
alter table caja_shifts add column kind caja_kind not null default 'diaria';

alter table ledger add column dispensa_id uuid references dispensas(id);

-- En los depositos que genera el cierre de caja diaria hacia caja
-- general, deja trazado de que turno diario vienen (para poder abrir su
-- resumen con un click desde caja general).
alter table ledger add column source_shift_id uuid references caja_shifts(id);

update ledger set dispensa_id = substring(concept from 'Dispensa ([0-9a-f-]{36})')::uuid
  where category = 'Dispensa' and dispensa_id is null and concept ~ '[0-9a-f-]{36}';
update ledger set dispensa_id = substring(concept from 'Cobro dispensa ([0-9a-f-]{36})')::uuid
  where category = 'Cuenta corriente' and dispensa_id is null and concept ~ '[0-9a-f-]{36}';

-- register_dispensa: concepto legible (recNN Dispensa N°X) + dispensa_id
-- real en vez de matchear texto; el shift al que se imputa el ingreso es
-- siempre el de caja diaria (la de uso diario, no la general).
drop function register_dispensa(uuid, jsonb, numeric, jsonb);

create function register_dispensa(
  p_member_id uuid,
  p_items jsonb,
  p_suggested_amount numeric,
  p_payments jsonb
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
    where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local)
      values (
        v_tenant, v_dispensa.id, (v_payment->>'account_id')::uuid,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1)
      )
      returning receipt_number into v_receipt;

    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id)
      values (
        v_tenant, v_shift_id, 'ingreso', 'Dispensa',
        'rec' || lpad(v_receipt::text, 2, '0') || ' Dispensa N°' || v_dispensa.number,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'account_id')::uuid, v_dispensa.id
      );
  end loop;

  return v_dispensa;
end;
$$;

drop function pay_dispensa(uuid, jsonb);

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
  v_receipt integer;
begin
  select * into v_dispensa from dispensas where id = p_dispensa_id and tenant_id = v_tenant;
  if v_dispensa is null then
    raise exception 'Comprobante no encontrado';
  end if;
  if v_dispensa.voided_at is not null then
    raise exception 'Este comprobante fue anulado';
  end if;

  select id into v_shift_id from caja_shifts
    where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local)
      values (
        v_tenant, p_dispensa_id, (v_payment->>'account_id')::uuid,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1)
      )
      returning receipt_number into v_receipt;

    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id)
      values (
        v_tenant, v_shift_id, 'ingreso', 'Cuenta corriente',
        'rec' || lpad(v_receipt::text, 2, '0') || ' Cobro Dispensa N°' || v_dispensa.number,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'account_id')::uuid, p_dispensa_id
      );
  end loop;
end;
$$;

create or replace function void_dispensa(p_dispensa_id uuid, p_reason text) returns void
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

  delete from ledger where tenant_id = v_tenant and dispensa_id = p_dispensa_id;

  update dispensas set voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
    where id = p_dispensa_id and tenant_id = v_tenant;
end;
$$;

-- Cierre de caja diaria: registra el arqueo, reabre automaticamente el
-- turno siguiente con el efectivo contado como apertura (nadie vuelve a
-- tipearlo a mano) y, si hay una caja general abierta, deposita ahi un
-- resumen por cuenta de lo que se movio en el turno que se cierra.
create function close_caja_diaria(p_counted_cash numeric) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_shift caja_shifts;
  v_cash_account_id uuid;
  v_expected_cash numeric;
  v_general_shift_id uuid;
  v_concept text;
  v_acct record;
begin
  select * into v_shift from caja_shifts
    where tenant_id = v_tenant and kind = 'diaria' and closed_at is null
    limit 1;
  if v_shift is null then
    raise exception 'No hay un turno de caja diaria abierto';
  end if;

  select id into v_cash_account_id from payment_accounts
    where tenant_id = v_tenant and is_cash = true limit 1;

  select v_shift.opening_cash + coalesce(sum(case when l.type = 'ingreso' then l.amount_local else -l.amount_local end), 0)
    into v_expected_cash
    from ledger l
    where l.shift_id = v_shift.id and l.account_id = v_cash_account_id;

  update caja_shifts
    set closed_at = now(), counted_cash = p_counted_cash, difference = p_counted_cash - v_expected_cash
    where id = v_shift.id;

  insert into caja_shifts (tenant_id, kind, opened_by, opening_cash)
    values (v_tenant, 'diaria', auth.uid(), p_counted_cash);

  select id into v_general_shift_id from caja_shifts
    where tenant_id = v_tenant and kind = 'general' and closed_at is null
    limit 1;

  if v_general_shift_id is not null then
    v_concept := 'Caja ' || to_char(v_shift.opened_at, 'DD/MM/YY');

    if v_cash_account_id is not null then
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, source_shift_id)
        values (v_tenant, v_general_shift_id, 'ingreso', 'Cierre de caja', v_concept, p_counted_cash, 1, p_counted_cash, v_cash_account_id, v_shift.id);
    end if;

    -- Para cada cuenta no-efectivo se vuelca el neto del turno cerrado.
    -- Se preserva amount = cantidad en la moneda propia de la cuenta
    -- (relevante para dolares, donde "cantidad" != "valor en pesos") y
    -- se deriva una cotizacion efectiva para que amount_local siga dando
    -- el total correcto en pesos.
    for v_acct in
      select l.account_id,
        coalesce(sum(case when l.type = 'ingreso' then l.amount else -l.amount end), 0) as net_amount,
        coalesce(sum(case when l.type = 'ingreso' then l.amount_local else -l.amount_local end), 0) as net_local
      from ledger l
      where l.shift_id = v_shift.id and l.account_id is distinct from v_cash_account_id
      group by l.account_id
      having coalesce(sum(case when l.type = 'ingreso' then l.amount_local else -l.amount_local end), 0) <> 0
    loop
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, source_shift_id)
        values (
          v_tenant, v_general_shift_id, 'ingreso', 'Cierre de caja', v_concept,
          v_acct.net_amount,
          case when v_acct.net_amount = 0 then 1 else v_acct.net_local / v_acct.net_amount end,
          v_acct.net_local,
          v_acct.account_id, v_shift.id
        );
    end loop;
  end if;
end;
$$;
