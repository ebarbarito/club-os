-- Cta Cte: saldo a favor + cobro por lote (varias dispensas a la vez).
--
-- El historial de movimientos en si (dispensas + pagos) ya existia y ya
-- se preservaba -- void_dispensa nunca borro dispensa_payments, solo
-- ledger (caja). Lo que faltaba era: (a) verlo en la app (hoy la UI solo
-- mostraba comprobantes con deuda pendiente, ocultando todo lo ya
-- pagado) y (b) representar un pago que supera lo adeudado como saldo a
-- favor del socio, algo que dispensa_payments no puede expresar porque
-- siempre exige un dispensa_id.
create table member_credits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  amount numeric not null, -- signo: + genera credito, - lo consume
  description text not null,
  receipt_number integer,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index member_credits_member_idx on member_credits (tenant_id, member_id);

alter table member_credits enable row level security;
create policy member_credits_tenant on member_credits for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Cobro por lote: p_allocations = [{dispensa_id, amount}] (cuanto se
-- cobra de cada comprobante), p_payments = [{account_id, amount,
-- exchange_rate}] (con que se paga el total). Reparte las lineas de pago
-- entre los comprobantes en orden (waterfall) -- no hace falta que el
-- cajero indique con que medio se pago cada comprobante puntual, solo
-- cuanto se cobra de cada uno y con que se paga el total. Lo que sobra
-- (se pago mas de lo asignado a comprobantes) queda como saldo a favor.
create function pay_dispensa_batch(p_allocations jsonb, p_payments jsonb) returns void
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
        insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
          values (
            v_tenant, v_shift_id, 'ingreso', 'Cuenta corriente',
            'rec' || lpad(v_receipt::text, 2, '0') || ' Cobro Dispensa N°' || v_dispensa.number,
            v_take / v_pay_rate[i], v_pay_rate[i], v_take, v_pay_account[i], v_dispensa.id, v_receipt
          );
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
  -- real (ledger) y el saldo del socio (member_credits).
  for i in v_pay_idx..v_pay_count loop
    if v_pay_remaining[i] > 0.005 then
      insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, receipt_number)
        values (
          v_tenant, v_shift_id, 'ingreso', 'Cuenta corriente',
          'rec' || lpad(v_receipt::text, 2, '0') || ' Saldo a favor',
          v_pay_remaining[i] / v_pay_rate[i], v_pay_rate[i], v_pay_remaining[i], v_pay_account[i], v_receipt
        );
      insert into member_credits (tenant_id, member_id, amount, description, receipt_number, created_by)
        values (v_tenant, v_member_id, v_pay_remaining[i], 'Saldo a favor generado', v_receipt, auth.uid());
    end if;
  end loop;
end;
$$;
