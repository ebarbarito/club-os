-- Numeracion secuencial de dispensas (nunca se reutiliza, ni si se anula
-- despues) y de recibos de pago (cada pago, sea al registrar la dispensa
-- o un cobro posterior de cuenta corriente, se numera "recNN" correlativo
-- por club). Ademas se agrega fecha a cada pago, que hasta ahora no existia.

alter table dispensas add column number integer;

create function assign_dispensa_number() returns trigger language plpgsql as $$
begin
  if new.number is null then
    select coalesce(max(number), 0) + 1 into new.number from dispensas where tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger dispensas_assign_number before insert on dispensas
  for each row execute function assign_dispensa_number();

with numbered as (
  select id, row_number() over (partition by tenant_id order by created_at) as rn
  from dispensas
)
update dispensas d set number = numbered.rn from numbered where d.id = numbered.id;

alter table dispensas alter column number set not null;
alter table dispensas add constraint dispensas_tenant_number_key unique (tenant_id, number);

alter table dispensa_payments add column created_at timestamptz not null default now();
alter table dispensa_payments add column receipt_number integer;

create function assign_receipt_number() returns trigger language plpgsql as $$
begin
  if new.receipt_number is null then
    select coalesce(max(receipt_number), 0) + 1 into new.receipt_number from dispensa_payments where tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger dispensa_payments_assign_receipt before insert on dispensa_payments
  for each row execute function assign_receipt_number();

-- Backfill ordenado por la fecha de la dispensa a la que pertenece cada
-- pago (no hay mejor referencia cronologica para los pagos ya existentes).
with numbered as (
  select dp.id, row_number() over (partition by dp.tenant_id order by d.created_at, dp.id) as rn
  from dispensa_payments dp
  join dispensas d on d.id = dp.dispensa_id
)
update dispensa_payments dp set receipt_number = numbered.rn from numbered where dp.id = numbered.id;

alter table dispensa_payments alter column receipt_number set not null;
alter table dispensa_payments add constraint dispensa_payments_tenant_receipt_key unique (tenant_id, receipt_number);

-- register_dispensa ya no exige forma de pago: si no se carga ninguna (o
-- suma $0), el importe entero de la dispensa queda en cuenta corriente.
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
    where tenant_id = v_tenant and closed_at is null limit 1;

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
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
