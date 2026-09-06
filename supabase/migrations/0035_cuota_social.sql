-- Cuota social (Modificaciones 1/9/26 + correcciones posteriores):
-- - Servicio pactado (tipo + cantidad) y cuota social ($) por socio.
-- - Generación mensual MANUAL (sin cron por ahora): un botón que arma un
--   preview editable y, al confirmar, crea un comprobante por socio
--   tildado — igual que cualquier dispensa (aparece en "adeudado",
--   entra en el cobro por lote, etc), pero sin ítems.
-- - Ese comprobante arranca "pendiente": es una deuda común. Cuando
--   llega el comprobante de pago externo (transferencia/tarjeta/MP), un
--   admin lo "acredita" — ahí, y solo ahí, se convierte en crédito de
--   producto (no en efectivo/cuentas: no afecta caja ni stock).
-- - Ese crédito se aplica en una dispensa futura como una cuenta más
--   (payment_accounts "virtual"): reutiliza todo lo que ya existe
--   (Forma de pago, cobro por lote, cálculo de adeudado) en vez de un
--   circuito aparte. La única diferencia es que una línea de pago contra
--   la cuenta virtual no genera fila en `ledger` (no es plata real que
--   se mueva ahora) y en cambio descuenta de `member_credits`.

alter table members add column servicio_pactado_tipo text;
alter table members add column servicio_pactado_cantidad numeric;
alter table members add column cuota_social numeric;
alter table members add column factura_automatica boolean not null default false;

alter table dispensas add column es_cuota_social boolean not null default false;
alter table dispensas add column cuota_social_periodo date;
alter table dispensas add column acreditado_at timestamptz;
alter table dispensas add column acreditado_by uuid references profiles(id);

-- No se puede generar dos veces la cuota social del mismo socio en el
-- mismo período.
create unique index dispensas_cuota_social_periodo_uk on dispensas (tenant_id, member_id, cuota_social_periodo)
  where es_cuota_social;

alter table member_credits add column kind text not null default 'general' check (kind in ('general', 'cuota_social'));
alter table member_credits add column dispensa_id uuid references dispensas(id);

alter table payment_accounts add column is_virtual boolean not null default false;

-- Una cuenta virtual por tenant: no es plata real, representa el crédito
-- de cuota social ya acreditado. No entra en el arqueo de caja (nunca
-- recibe filas de ledger).
insert into payment_accounts (tenant_id, name, currency, is_cash, active, is_virtual)
select id, 'Crédito cuota social', 'ARS', false, true, true from tenants
where not exists (
  select 1 from payment_accounts pa where pa.tenant_id = tenants.id and pa.is_virtual
);

-- Acredita el pago externo de una cuota social: la deuda queda resuelta
-- (sin tocar caja/stock) y se acredita como credito de producto.
create function acreditar_cuota_social(p_dispensa_id uuid) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_dispensa dispensas;
begin
  select * into v_dispensa from dispensas where id = p_dispensa_id and tenant_id = v_tenant;
  if v_dispensa is null then
    raise exception 'Comprobante no encontrado';
  end if;
  if not v_dispensa.es_cuota_social then
    raise exception 'Este comprobante no es una cuota social';
  end if;
  if v_dispensa.acreditado_at is not null then
    raise exception 'Ya estaba acreditada';
  end if;

  update dispensas set acreditado_at = now(), acreditado_by = auth.uid()
    where id = p_dispensa_id and tenant_id = v_tenant;

  insert into member_credits (tenant_id, member_id, dispensa_id, kind, amount, description, created_by)
    values (
      v_tenant, v_dispensa.member_id, p_dispensa_id, 'cuota_social', v_dispensa.amount,
      'Cuota social ' || to_char(v_dispensa.cuota_social_periodo, 'TMMonth YYYY') || ' acreditada',
      auth.uid()
    );
end;
$$;

-- Aplica una porcion de credito de cuota social a una dispensa: valida
-- disponibilidad y descuenta member_credits. No genera ledger (no es
-- plata real moviendose ahora -- eso ya paso cuando se acredito).
create function apply_cuota_social_credit(p_member_id uuid, p_dispensa_id uuid, p_amount numeric, p_dispensa_number integer) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_available numeric;
begin
  select coalesce(sum(amount), 0) into v_available from member_credits
    where tenant_id = v_tenant and member_id = p_member_id and kind = 'cuota_social';
  if p_amount > v_available + 0.01 then
    raise exception 'Crédito de cuota social insuficiente (disponible: %)', v_available;
  end if;
  insert into member_credits (tenant_id, member_id, dispensa_id, kind, amount, description)
    values (v_tenant, p_member_id, p_dispensa_id, 'cuota_social', -p_amount, 'Crédito cuota social aplicado a Dispensa N°' || p_dispensa_number);
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
  v_credit_account_id uuid;
  v_pay_amount_local numeric;
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
  select id into v_credit_account_id from payment_accounts where tenant_id = v_tenant and is_virtual limit 1;

  if jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 0 then
    select next_receipt_number() into v_receipt;
  end if;

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_pay_amount_local := (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1);
    insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
      values (
        v_tenant, v_dispensa.id, (v_payment->>'account_id')::uuid,
        (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
        v_pay_amount_local, v_receipt
      );

    if v_credit_account_id is not null and (v_payment->>'account_id')::uuid = v_credit_account_id then
      perform apply_cuota_social_credit(p_member_id, v_dispensa.id, v_pay_amount_local, v_dispensa.number);
    else
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
        values (
          v_tenant, v_shift_id, 'ingreso', 'Dispensa',
          'rec' || lpad(v_receipt::text, 2, '0') || ' Dispensa N°' || v_dispensa.number,
          (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
          v_pay_amount_local, (v_payment->>'account_id')::uuid, v_dispensa.id, v_receipt
        );
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
  v_credit_account_id uuid;
  v_pay_amount_local numeric;
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
  -- incluye devolver cualquier credito de cuota social que se habia
  -- consumido, para volver a aplicar solo lo que se pida ahora.
  delete from dispensa_payments where dispensa_id = p_dispensa_id and receipt_number is not distinct from v_receipt;
  delete from ledger where dispensa_id = p_dispensa_id and category = 'Dispensa' and receipt_number is not distinct from v_receipt;
  delete from member_credits where dispensa_id = p_dispensa_id and kind = 'cuota_social' and amount < 0;

  if v_shift_id is null then
    select id into v_shift_id from caja_shifts
      where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;
  end if;
  select id into v_credit_account_id from payment_accounts where tenant_id = v_tenant and is_virtual limit 1;

  if jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 0 then
    if v_receipt is null then
      select next_receipt_number() into v_receipt;
    end if;

    for v_payment in select * from jsonb_array_elements(p_payments) loop
      v_pay_amount_local := (v_payment->>'amount')::numeric * coalesce((v_payment->>'exchange_rate')::numeric, 1);
      insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
        values (
          v_tenant, p_dispensa_id, (v_payment->>'account_id')::uuid,
          (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
          v_pay_amount_local, v_receipt
        );
      if v_credit_account_id is not null and (v_payment->>'account_id')::uuid = v_credit_account_id then
        perform apply_cuota_social_credit(p_member_id, p_dispensa_id, v_pay_amount_local, v_old.number);
      else
        insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
          values (
            v_tenant, v_shift_id, 'ingreso', 'Dispensa',
            'rec' || lpad(v_receipt::text, 2, '0') || ' Dispensa N°' || v_old.number,
            (v_payment->>'amount')::numeric, coalesce((v_payment->>'exchange_rate')::numeric, 1),
            v_pay_amount_local, (v_payment->>'account_id')::uuid, p_dispensa_id, v_receipt
          );
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

create or replace function pay_dispensa_batch(p_allocations jsonb, p_payments jsonb) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_shift_id uuid;
  v_receipt integer;
  v_member_id uuid;
  v_pay_account uuid[];
  v_pay_remaining numeric[];
  v_pay_rate numeric[];
  v_pay_count integer;
  v_pay_idx integer := 1;
  v_alloc jsonb;
  v_alloc_amount numeric;
  v_dispensa dispensas;
  v_take numeric;
  v_total_alloc numeric := 0;
  v_total_paid numeric := 0;
  v_credit_account_id uuid;
  i integer;
begin
  if p_allocations is null or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Cargá al menos un cobro';
  end if;
  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'Cargá una forma de pago';
  end if;

  select array_agg((p->>'account_id')::uuid order by ord),
         array_agg((p->>'amount')::numeric * coalesce((p->>'exchange_rate')::numeric, 1) order by ord),
         array_agg(coalesce((p->>'exchange_rate')::numeric, 1) order by ord)
    into v_pay_account, v_pay_remaining, v_pay_rate
    from jsonb_array_elements(p_payments) with ordinality as t(p, ord);
  v_pay_count := coalesce(array_length(v_pay_account, 1), 0);

  select coalesce(sum(x), 0) into v_total_paid from unnest(v_pay_remaining) x;
  select coalesce(sum((a->>'amount')::numeric), 0) into v_total_alloc from jsonb_array_elements(p_allocations) a;

  if v_total_alloc <= 0 then
    raise exception 'Cargá al menos un cobro mayor a 0';
  end if;
  if v_total_paid + 0.01 < v_total_alloc then
    raise exception 'La forma de pago no cubre el total a cobrar';
  end if;

  select id into v_shift_id from caja_shifts where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;
  select id into v_credit_account_id from payment_accounts where tenant_id = v_tenant and is_virtual limit 1;
  select next_receipt_number() into v_receipt;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_alloc_amount := (v_alloc->>'amount')::numeric;
    if v_alloc_amount <= 0 then continue; end if;

    select * into v_dispensa from dispensas where id = (v_alloc->>'dispensa_id')::uuid and tenant_id = v_tenant;
    if v_dispensa is null then
      raise exception 'Comprobante no encontrado';
    end if;
    if v_dispensa.voided_at is not null then
      raise exception 'Comprobante anulado';
    end if;
    if v_member_id is null then
      v_member_id := v_dispensa.member_id;
    elsif v_member_id <> v_dispensa.member_id then
      raise exception 'Todos los comprobantes del cobro deben ser del mismo socio';
    end if;

    i := v_pay_idx;
    while v_alloc_amount > 0.005 and i <= v_pay_count loop
      v_take := least(v_alloc_amount, v_pay_remaining[i]);
      if v_take > 0.005 then
        insert into dispensa_payments (tenant_id, dispensa_id, account_id, amount, exchange_rate, amount_local, receipt_number)
          values (v_tenant, v_dispensa.id, v_pay_account[i], v_take / v_pay_rate[i], v_pay_rate[i], v_take, v_receipt);
        if v_credit_account_id is not null and v_pay_account[i] = v_credit_account_id then
          perform apply_cuota_social_credit(v_member_id, v_dispensa.id, v_take, v_dispensa.number);
        else
          insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
            values (
              v_tenant, v_shift_id, 'ingreso', 'Cuenta corriente',
              'rec' || lpad(v_receipt::text, 2, '0') || ' Cobro Dispensa N°' || v_dispensa.number,
              v_take / v_pay_rate[i], v_pay_rate[i], v_take, v_pay_account[i], v_dispensa.id, v_receipt
            );
        end if;
        v_pay_remaining[i] := v_pay_remaining[i] - v_take;
        v_alloc_amount := v_alloc_amount - v_take;
      end if;
      if v_pay_remaining[i] <= 0.005 then
        i := i + 1;
      end if;
    end loop;
    v_pay_idx := i;
  end loop;

  -- lo que sobra (se pago mas de lo asignado a comprobantes) queda a
  -- favor del socio: no tiene comprobante propio, pero impacta la caja
  -- real (ledger) y el saldo del socio (member_credits). El credito de
  -- cuota social nunca genera sobrante: si se cargo de mas, se pierde
  -- (no se fabrica plata real ni saldo general a partir de un credito).
  for i in v_pay_idx..v_pay_count loop
    if v_pay_remaining[i] > 0.005 and not (v_credit_account_id is not null and v_pay_account[i] = v_credit_account_id) then
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, receipt_number)
        values (
          v_tenant, v_shift_id, 'ingreso', 'Cuenta corriente',
          'rec' || lpad(v_receipt::text, 2, '0') || ' Saldo a favor',
          v_pay_remaining[i] / v_pay_rate[i], v_pay_rate[i], v_pay_remaining[i], v_pay_account[i], v_receipt
        );
      insert into member_credits (tenant_id, member_id, kind, amount, description, receipt_number, created_by)
        values (v_tenant, v_member_id, 'general', v_pay_remaining[i], 'Saldo a favor generado', v_receipt, auth.uid());
    end if;
  end loop;
end;
$$;
