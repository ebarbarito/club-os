-- "Asientos": registro de auditoría de modificaciones y eliminaciones,
-- solo visible para el perfil administrador (se gatea en la app, mismo
-- patrón que socios/salas/catálogo — no hay policies por rol en este
-- proyecto, todo tenant_id + gate en la página/Server Action).
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  user_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  change_type text not null check (change_type in ('edicion', 'eliminacion')),
  description text not null,
  reason text
);

create index audit_log_tenant_created_idx on audit_log (tenant_id, created_at desc);

alter table audit_log enable row level security;
create policy audit_log_tenant on audit_log for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Modificar una dispensa ya registrada: reemplaza ítems (revierte stock
-- viejo, aplica el nuevo), socio y nota, y reemplaza únicamente las líneas
-- de pago de la registración original (mismo receipt_number y mismo turno
-- de caja en el que quedaron asentadas — así el arqueo de ese turno queda
-- corregido). Los cobros de cta cte posteriores (pay_dispensa) no se
-- tocan: tienen su propio receipt_number y quedan intactos. Deja un
-- asiento en audit_log con el valor anterior y el posterior.
create function update_dispensa(
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

-- Anular una dispensa ya dejaba voided_at/voided_by/void_reason en la
-- propia fila; ahora además queda un asiento en el mismo registro que las
-- ediciones, para verlo todo junto en "Asientos".
create or replace function void_dispensa(p_dispensa_id uuid, p_reason text) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_dispensa dispensas;
  v_item record;
  v_member_name text;
  v_items_desc text;
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
