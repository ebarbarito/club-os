-- Bug real detrás de "movimientos que se agrupan solos": el numero de
-- recibo se calculaba con `select max(receipt_number)+1 from ledger`,
-- sin ningun bloqueo -- si dos operaciones (dos dispensas, dos
-- movimientos de caja) se registran al mismo tiempo, ambas pueden leer
-- el mismo max() antes de que la otra confirme, y terminar con el MISMO
-- receipt_number. Como Caja agrupa filas por receipt_number, esas dos
-- operaciones DISTINTAS terminaban mostradas como una sola. Se reemplaza
-- por un contador por tenant que se incrementa de forma atomica.
create table receipt_counters (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  next_value integer not null default 1
);

-- Semilla: cada tenant con actividad previa arranca despues del receipt
-- mas alto que ya tiene (los que no tengan fila acá arrancan en 1, la
-- primera llamada a next_receipt_number() los crea sola).
insert into receipt_counters (tenant_id, next_value)
select tenant_id, coalesce(max(receipt_number), 0) + 1 from ledger group by tenant_id
on conflict (tenant_id) do nothing;

alter table receipt_counters enable row level security;
create policy receipt_counters_tenant on receipt_counters for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create function next_receipt_number() returns integer
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_value integer;
begin
  insert into receipt_counters (tenant_id, next_value) values (v_tenant, 1)
  on conflict (tenant_id) do update set next_value = receipt_counters.next_value + 1
  returning next_value into v_value;
  return v_value;
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

create or replace function pay_dispensa(
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
    select next_receipt_number() into v_receipt;
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

  -- reemplazar solo las líneas de pago de la registración original
  delete from dispensa_payments where dispensa_id = p_dispensa_id and receipt_number is not distinct from v_receipt;
  delete from ledger where dispensa_id = p_dispensa_id and category = 'Dispensa' and receipt_number is not distinct from v_receipt;

  if v_shift_id is null then
    select id into v_shift_id from caja_shifts
      where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;
  end if;

  if jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 0 then
    if v_receipt is null then
      select next_receipt_number() into v_receipt;
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
          v_tenant, v_shift_id, 'ingreso', 'Dispensa',
          'rec' || lpad(v_receipt::text, 2, '0') || ' Dispensa N°' || v_old.number,
          (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
          (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1),
          (v_payment->>'account_id')::uuid, p_dispensa_id, v_receipt
        );
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

create or replace function transfer_general_to_diaria(p_cash_amount numeric, p_usd_amount numeric) returns void
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

  select next_receipt_number() into v_receipt;

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
