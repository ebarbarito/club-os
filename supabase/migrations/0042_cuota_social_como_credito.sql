-- Rediseño Cuota Social (Modificaciones 15/9/26, acordado con el cliente):
-- una cuota social generada ya NO es un comprobante de dispensas ni genera
-- deuda en cuenta corriente. Vive como "cargo" propio (pendiente / parcial
-- / pagada) hasta que se cobra — por caja suelta, o consumida automática
-- (más vieja primero) como parte del pago de una dispensa nueva.
--
-- El crédito "cuota social" que ya existía en member_credits (generado por
-- el viejo flujo, plata real de socios) NO se toca ni se migra: sigue
-- siendo válido y se sigue pudiendo gastar — apply_cuota_social_credit
-- (0043) lo consume primero, y solo lo que falta lo saca de acá.
begin;

create table cuota_social_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id),
  periodo date not null,
  amount numeric not null check (amount > 0),
  paid_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (tenant_id, member_id, periodo)
);

create index cuota_social_charges_member_idx on cuota_social_charges (tenant_id, member_id);
create index cuota_social_charges_periodo_idx on cuota_social_charges (tenant_id, periodo);

alter table cuota_social_charges enable row level security;
create policy cuota_social_charges_tenant on cuota_social_charges for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Historial de qué pagó cada cargo: por caja suelta (dispensa_id null) o
-- consumido como parte de una dispensa — necesario para poder revertir
-- correctamente si esa dispensa se edita o se anula.
create table cuota_social_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  charge_id uuid not null references cuota_social_charges(id) on delete cascade,
  dispensa_id uuid references dispensas(id) on delete set null,
  amount numeric not null check (amount > 0),
  ledger_id uuid references ledger(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create index cuota_social_payments_charge_idx on cuota_social_payments (charge_id);
create index cuota_social_payments_dispensa_idx on cuota_social_payments (dispensa_id);

alter table cuota_social_payments enable row level security;
create policy cuota_social_payments_tenant on cuota_social_payments for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Generación mensual: uno por socio elegido, sin importar su status
-- (decisión del cliente: "en cualquier estado, validado o no"). No toca
-- dispensas/ledger/cta-cte — el cargo nace pendiente.
create function generar_cuotas_sociales(p_entries jsonb) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_periodo date := date_trunc('month', now())::date;
  v_entry jsonb;
begin
  for v_entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    insert into cuota_social_charges (tenant_id, member_id, periodo, amount)
      values (v_tenant, (v_entry->>'member_id')::uuid, v_periodo, (v_entry->>'amount')::numeric)
      on conflict (tenant_id, member_id, periodo) do nothing;
  end loop;
end;
$$;

-- Cobro "suelto" por Caja, sin pasar por una dispensa. Puede cubrir la
-- cuota a medias (queda "parcial"); si el pago excede lo pendiente, el
-- sobrante queda como saldo a favor general del socio.
create function cobrar_cuota_social_suelto(p_charge_id uuid, p_payments jsonb) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_charge cuota_social_charges;
  v_shift_id uuid;
  v_payment jsonb;
  v_rate numeric;
  v_pay_amount_local numeric;
  v_pendiente numeric;
  v_take numeric;
  v_leftover_total numeric := 0;
  v_ledger_id uuid;
begin
  select * into v_charge from cuota_social_charges where id = p_charge_id and tenant_id = v_tenant for update;
  if v_charge is null then
    raise exception 'Cuota social no encontrada';
  end if;

  v_pendiente := v_charge.amount - v_charge.paid_amount;
  if v_pendiente <= 0.005 then
    raise exception 'Esta cuota ya está paga';
  end if;

  select id into v_shift_id from caja_shifts where tenant_id = v_tenant and kind = 'diaria' and closed_at is null limit 1;

  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_rate := coalesce((v_payment->>'exchange_rate')::numeric, 1);
    v_pay_amount_local := (v_payment->>'amount')::numeric * v_rate;
    v_take := least(v_pay_amount_local, greatest(v_pendiente, 0));

    if v_take > 0.005 then
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id)
        values (
          v_tenant, v_shift_id, 'ingreso', 'Cuota social',
          'Cuota social ' || to_char(v_charge.periodo, 'TMMonth YYYY'),
          v_take / v_rate, v_rate, v_take, (v_payment->>'account_id')::uuid
        )
        returning id into v_ledger_id;

      update cuota_social_charges
        set paid_amount = paid_amount + v_take,
            paid_at = case when paid_amount + v_take >= amount - 0.005 then now() else paid_at end
        where id = v_charge.id;

      insert into cuota_social_payments (tenant_id, charge_id, dispensa_id, amount, ledger_id, created_by)
        values (v_tenant, v_charge.id, null, v_take, v_ledger_id, auth.uid());

      v_pendiente := v_pendiente - v_take;
    end if;

    if v_pay_amount_local - v_take > 0.005 then
      v_leftover_total := v_leftover_total + (v_pay_amount_local - v_take);
    end if;
  end loop;

  if v_leftover_total > 0.005 then
    insert into member_credits (tenant_id, member_id, kind, amount, description, created_by)
      values (v_tenant, v_charge.member_id, 'general', v_leftover_total, 'Saldo a favor generado', auth.uid());
  end if;
end;
$$;

commit;
