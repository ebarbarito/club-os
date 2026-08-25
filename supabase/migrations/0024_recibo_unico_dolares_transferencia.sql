-- Modificaciones 25/08/2026.
--
-- Fase A: un recibo por OPERACION, no por linea de pago. Antes cada
-- cuenta de un pago dividido sacaba su propio numero (rec25, rec26 para
-- una misma dispensa pagada en 2 cuentas); ahora todas las lineas de una
-- misma operacion (dispensa, cobro de cta cte, movimiento de caja)
-- comparten un solo receipt_number, y ese numero vive en ledger (la unica
-- tabla por la que pasa CUALQUIER movimiento de plata, tenga o no
-- dispensa asociada).
alter table dispensa_payments drop constraint dispensa_payments_tenant_receipt_key;
drop trigger dispensa_payments_assign_receipt on dispensa_payments;
drop function assign_receipt_number();

alter table ledger add column receipt_number integer;

-- Backfill: cada pago existente ya tenia un receipt_number propio en
-- dispensa_payments — se preserva tal cual en su fila de ledger
-- correspondiente (matcheando por dispensa_id + account_id + amount_local,
-- la unica correlacion disponible ya que no habia otro vinculo directo).
update ledger l set receipt_number = dp.receipt_number
  from dispensa_payments dp
  where l.dispensa_id = dp.dispensa_id
    and l.account_id = dp.account_id
    and l.amount_local = dp.amount_local
    and l.receipt_number is null;

-- Fase B: caja diaria pasa a contar dolares al cerrar (ademas del
-- efectivo por denominacion) y separa "total contado" de "cuanto se deja
-- para la caja siguiente" — antes eran la misma cifra. caja_shifts gana
-- apertura en dolares (antes solo existia en pesos).
alter table caja_shifts add column opening_usd numeric not null default 0;
alter table caja_shifts add column counted_usd numeric;
alter table caja_shifts add column leave_cash numeric;
alter table caja_shifts add column leave_usd numeric;
alter table caja_shifts add column difference_usd numeric;

-- register_dispensa: un solo receipt_number por dispensa, compartido por
-- todas sus lineas de pago (antes: uno por linea).
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

  if jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 0 then
    select coalesce(max(receipt_number), 0) + 1 into v_receipt from ledger where tenant_id = v_tenant;
  end if;

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
      values (
        v_tenant, v_dispensa.id, (v_payment->>'account_id')::uuid,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
        v_receipt
      );

    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
      values (
        v_tenant, v_shift_id, 'ingreso', 'Dispensa',
        'rec' || lpad(v_receipt::text, 2, '0') || ' Dispensa N°' || v_dispensa.number,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'account_id')::uuid, v_dispensa.id, v_receipt
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

  if jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 0 then
    select coalesce(max(receipt_number), 0) + 1 into v_receipt from ledger where tenant_id = v_tenant;
  end if;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
      values (
        v_tenant, p_dispensa_id, (v_payment->>'account_id')::uuid,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
        v_receipt
      );

    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
      values (
        v_tenant, v_shift_id, 'ingreso', 'Cuenta corriente',
        'rec' || lpad(v_receipt::text, 2, '0') || ' Cobro Dispensa N°' || v_dispensa.number,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
        (v_payment->>'account_id')::uuid, p_dispensa_id, v_receipt
      );
  end loop;
end;
$$;

-- close_caja_diaria: ahora tambien cuenta dolares, y el monto que se
-- "deja para la siguiente" (pesos y dolares) puede ser menor al total
-- contado — la diferencia (lo que no se deja) es lo que se deposita en
-- caja general, no el total contado como antes.
drop function close_caja_diaria(numeric);

create function close_caja_diaria(p_counted_cash numeric, p_counted_usd numeric, p_leave_cash numeric, p_leave_usd numeric)
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_shift caja_shifts;
  v_cash_account_id uuid;
  v_usd_account_id uuid;
  v_expected_cash numeric;
  v_expected_usd numeric;
  v_general_shift_id uuid;
  v_concept text;
  v_acct record;
  v_deposit_cash numeric;
  v_deposit_usd numeric;
  v_usd_rate numeric;
begin
  if p_leave_cash < 0 or p_leave_cash > coalesce(p_counted_cash, 0) then
    raise exception 'El efectivo para la caja siguiente no puede ser negativo ni mayor a lo contado';
  end if;
  if p_leave_usd < 0 or p_leave_usd > coalesce(p_counted_usd, 0) then
    raise exception 'Los dólares para la caja siguiente no pueden ser negativos ni mayores a lo contado';
  end if;

  select * into v_shift from caja_shifts
    where tenant_id = v_tenant and kind = 'diaria' and closed_at is null
    limit 1;
  if v_shift is null then
    raise exception 'No hay un turno de caja diaria abierto';
  end if;

  select id into v_cash_account_id from payment_accounts where tenant_id = v_tenant and is_cash = true limit 1;
  select id, exchange_rate into v_usd_account_id, v_usd_rate from payment_accounts
    where tenant_id = v_tenant and is_cash = false and currency <> 'ARS' limit 1;

  select v_shift.opening_cash + coalesce(sum(case when l.type = 'ingreso' then l.amount_local else -l.amount_local end), 0)
    into v_expected_cash
    from ledger l where l.shift_id = v_shift.id and l.account_id = v_cash_account_id;

  select v_shift.opening_usd + coalesce(sum(case when l.type = 'ingreso' then l.amount else -l.amount end), 0)
    into v_expected_usd
    from ledger l where l.shift_id = v_shift.id and l.account_id = v_usd_account_id;

  update caja_shifts
    set closed_at = now(),
        counted_cash = p_counted_cash, counted_usd = p_counted_usd,
        leave_cash = p_leave_cash, leave_usd = p_leave_usd,
        difference = p_counted_cash - v_expected_cash,
        difference_usd = p_counted_usd - coalesce(v_expected_usd, 0)
    where id = v_shift.id;

  insert into caja_shifts (tenant_id, kind, opened_by, opening_cash, opening_usd)
    values (v_tenant, 'diaria', auth.uid(), p_leave_cash, p_leave_usd);

  select id into v_general_shift_id from caja_shifts
    where tenant_id = v_tenant and kind = 'general' and closed_at is null
    limit 1;

  if v_general_shift_id is not null then
    v_concept := 'Caja ' || to_char(v_shift.opened_at, 'DD/MM/YY');
    v_deposit_cash := coalesce(p_counted_cash, 0) - p_leave_cash;
    v_deposit_usd := coalesce(p_counted_usd, 0) - p_leave_usd;

    if v_cash_account_id is not null and v_deposit_cash > 0 then
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, source_shift_id)
        values (v_tenant, v_general_shift_id, 'ingreso', 'Cierre de caja', v_concept, v_deposit_cash, 1, v_deposit_cash, v_cash_account_id, v_shift.id);
    end if;
    if v_usd_account_id is not null and v_deposit_usd > 0 then
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, source_shift_id)
        values (v_tenant, v_general_shift_id, 'ingreso', 'Cierre de caja', v_concept, v_deposit_usd, coalesce(v_usd_rate, 1), v_deposit_usd * coalesce(v_usd_rate, 1), v_usd_account_id, v_shift.id);
    end if;

    -- El resto de las cuentas (no efectivo, no dolares) se vuelca por el
    -- neto de actividad del turno, igual que antes.
    for v_acct in
      select l.account_id,
        coalesce(sum(case when l.type = 'ingreso' then l.amount else -l.amount end), 0) as net_amount,
        coalesce(sum(case when l.type = 'ingreso' then l.amount_local else -l.amount_local end), 0) as net_local
      from ledger l
      where l.shift_id = v_shift.id
        and l.account_id is distinct from v_cash_account_id
        and l.account_id is distinct from v_usd_account_id
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

-- Envio manual de caja general a caja diaria: un solo click genera un
-- egreso en general y un ingreso en diaria (misma plata, dos turnos).
-- No es ingreso/egreso real (categoria excluida del Balance).
create function transfer_general_to_diaria(p_cash_amount numeric, p_usd_amount numeric) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_general_shift_id uuid;
  v_diaria_shift_id uuid;
  v_cash_account_id uuid;
  v_usd_account_id uuid;
  v_usd_rate numeric;
  v_receipt integer;
  v_general_cash numeric;
  v_general_usd numeric;
begin
  if coalesce(p_cash_amount, 0) <= 0 and coalesce(p_usd_amount, 0) <= 0 then
    raise exception 'Cargá un monto en pesos o en dólares';
  end if;

  select id into v_general_shift_id from caja_shifts
    where tenant_id = v_tenant and kind = 'general' and closed_at is null limit 1;
  if v_general_shift_id is null then
    raise exception 'No hay un turno de caja general abierto';
  end if;
  select id into v_diaria_shift_id from caja_shifts
    where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;
  if v_diaria_shift_id is null then
    raise exception 'No hay un turno de caja diaria abierto';
  end if;

  select id into v_cash_account_id from payment_accounts where tenant_id = v_tenant and is_cash = true limit 1;
  select id, exchange_rate into v_usd_account_id, v_usd_rate from payment_accounts
    where tenant_id = v_tenant and is_cash = false and currency <> 'ARS' limit 1;

  if coalesce(p_cash_amount, 0) > 0 then
    if v_cash_account_id is null then
      raise exception 'No hay cuenta de efectivo configurada';
    end if;
    select cs.opening_cash + coalesce(sum(case when l.type = 'ingreso' then l.amount_local else -l.amount_local end), 0)
      into v_general_cash
      from caja_shifts cs left join ledger l on l.shift_id = cs.id and l.account_id = v_cash_account_id
      where cs.id = v_general_shift_id group by cs.opening_cash;
    if p_cash_amount > coalesce(v_general_cash, 0) + 0.01 then
      raise exception 'La caja general no tiene suficiente efectivo (disponible: %)', coalesce(v_general_cash, 0);
    end if;
  end if;

  if coalesce(p_usd_amount, 0) > 0 then
    if v_usd_account_id is null then
      raise exception 'No hay cuenta de dólares configurada';
    end if;
    select cs.opening_usd + coalesce(sum(case when l.type = 'ingreso' then l.amount else -l.amount end), 0)
      into v_general_usd
      from caja_shifts cs left join ledger l on l.shift_id = cs.id and l.account_id = v_usd_account_id
      where cs.id = v_general_shift_id group by cs.opening_usd;
    if p_usd_amount > coalesce(v_general_usd, 0) + 0.01 then
      raise exception 'La caja general no tiene suficientes dólares (disponible: %)', coalesce(v_general_usd, 0);
    end if;
  end if;

  select coalesce(max(receipt_number), 0) + 1 into v_receipt from ledger where tenant_id = v_tenant;

  if coalesce(p_cash_amount, 0) > 0 then
    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, receipt_number)
      values (v_tenant, v_general_shift_id, 'egreso', 'Envío a caja diaria', 'Envío a caja diaria', p_cash_amount, 1, p_cash_amount, v_cash_account_id, v_receipt);
    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, receipt_number)
      values (v_tenant, v_diaria_shift_id, 'ingreso', 'Envío a caja diaria', 'Envío a caja diaria', p_cash_amount, 1, p_cash_amount, v_cash_account_id, v_receipt);
  end if;

  if coalesce(p_usd_amount, 0) > 0 then
    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, receipt_number)
      values (v_tenant, v_general_shift_id, 'egreso', 'Envío a caja diaria', 'Envío a caja diaria', p_usd_amount, coalesce(v_usd_rate, 1), p_usd_amount * coalesce(v_usd_rate, 1), v_usd_account_id, v_receipt);
    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, receipt_number)
      values (v_tenant, v_diaria_shift_id, 'ingreso', 'Envío a caja diaria', 'Envío a caja diaria', p_usd_amount, coalesce(v_usd_rate, 1), p_usd_amount * coalesce(v_usd_rate, 1), v_usd_account_id, v_receipt);
  end if;
end;
$$;
