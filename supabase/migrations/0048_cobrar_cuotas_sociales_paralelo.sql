-- Cobro de cuotas sociales en paralelo al registrar una dispensa.
--
-- Permite que el operador cobre varias cuotas (de distintos períodos) con
-- una sola forma de pago, dentro del mismo flujo de Registrar Dispensa.
-- A diferencia de cobrar_cuota_social_suelto (que solo actualiza el cargo
-- y no genera crédito), esta función también genera un member_credit de
-- kind='cuota_social' — que el socio puede aplicar inmediatamente en la
-- dispensa que está por registrar usando la cuenta virtual de cuota social.
--
-- p_cobros : [{ charge_id: uuid, amount: numeric }]  — cuánto cobrar por cada cargo
-- p_payments: [{ account_id: uuid, amount: numeric, exchange_rate?: numeric }]

create function cobrar_cuotas_sociales_paralelo(
  p_member_id  uuid,
  p_cobros     jsonb,
  p_payments   jsonb
) returns void
language plpgsql as $$
declare
  v_tenant        uuid := current_tenant_id();
  v_shift_id      uuid;
  -- pool de pagos (arrays paralelos)
  v_pay_accounts  uuid[];
  v_pay_remaining numeric[];
  v_pay_rates     numeric[];
  v_pay_count     integer;
  v_pay_idx       integer := 1;
  -- cobro actual
  v_cobro         jsonb;
  v_cobro_amount  numeric;
  v_charge        cuota_social_charges;
  v_pendiente     numeric;
  v_take          numeric;
  v_ledger_id     uuid;
  v_credit_total  numeric;
  -- totales
  v_total_cobros  numeric := 0;
  v_total_pago    numeric := 0;
  i               integer;
begin
  if p_cobros is null or jsonb_array_length(p_cobros) = 0 then
    raise exception 'No se especificaron cobros';
  end if;
  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'Cargá una forma de pago';
  end if;

  -- validar totales
  select coalesce(sum((c->>'amount')::numeric), 0) into v_total_cobros
    from jsonb_array_elements(p_cobros) c;
  if v_total_cobros <= 0 then
    raise exception 'El total a cobrar debe ser mayor a 0';
  end if;

  -- construir pool de pagos
  select
    array_agg((p->>'account_id')::uuid      order by ord),
    array_agg(
      (p->>'amount')::numeric * coalesce((p->>'exchange_rate')::numeric, 1)
      order by ord
    ),
    array_agg(coalesce((p->>'exchange_rate')::numeric, 1) order by ord)
    into v_pay_accounts, v_pay_remaining, v_pay_rates
  from jsonb_array_elements(p_payments) with ordinality as t(p, ord);

  v_pay_count := coalesce(array_length(v_pay_accounts, 1), 0);
  select coalesce(sum(x), 0) into v_total_pago from unnest(v_pay_remaining) x;

  if v_total_pago + 0.01 < v_total_cobros then
    raise exception 'La forma de pago no cubre el total a cobrar (pago: %, cobros: %)',
      v_total_pago, v_total_cobros;
  end if;

  select id into v_shift_id
    from caja_shifts
   where tenant_id = v_tenant and kind = 'diaria' and closed_at is null
   limit 1;

  -- procesar cada cobro
  for v_cobro in select * from jsonb_array_elements(p_cobros) loop
    v_cobro_amount := (v_cobro->>'amount')::numeric;
    if v_cobro_amount <= 0 then continue; end if;

    -- trabar el cargo y validar
    select * into v_charge
      from cuota_social_charges
     where id = (v_cobro->>'charge_id')::uuid
       and tenant_id = v_tenant
       and member_id = p_member_id
       for update;

    if v_charge is null then
      raise exception 'Cargo de cuota social no encontrado o no pertenece al socio';
    end if;

    v_pendiente := v_charge.amount - v_charge.paid_amount;
    if v_pendiente <= 0.005 then
      raise exception 'La cuota % ya está paga', to_char(v_charge.periodo, 'TMMonth YYYY');
    end if;
    if v_cobro_amount > v_pendiente + 0.01 then
      raise exception 'El cobro (%) supera el pendiente (%) para cuota %',
        v_cobro_amount, v_pendiente, to_char(v_charge.periodo, 'TMMonth YYYY');
    end if;

    v_credit_total := 0;
    i := v_pay_idx;
    declare v_remaining_cobro numeric := least(v_cobro_amount, v_pendiente);
    begin
      while v_remaining_cobro > 0.005 and i <= v_pay_count loop
        v_take := least(v_remaining_cobro, v_pay_remaining[i]);
        if v_take > 0.005 then
          insert into ledger (
            tenant_id, shift_id, type, category, concept,
            amount, exchange_rate, amount_local, account_id
          ) values (
            v_tenant, v_shift_id, 'ingreso', 'Cuota social',
            'Cuota social ' || to_char(v_charge.periodo, 'TMMonth YYYY'),
            v_take / v_pay_rates[i], v_pay_rates[i], v_take, v_pay_accounts[i]
          ) returning id into v_ledger_id;

          insert into cuota_social_payments (
            tenant_id, charge_id, dispensa_id, amount, ledger_id, created_by
          ) values (
            v_tenant, v_charge.id, null, v_take, v_ledger_id, auth.uid()
          );

          v_pay_remaining[i] := v_pay_remaining[i] - v_take;
          v_remaining_cobro   := v_remaining_cobro  - v_take;
          v_credit_total      := v_credit_total      + v_take;
        end if;
        if v_pay_remaining[i] <= 0.005 then i := i + 1; end if;
      end loop;
      v_pay_idx := i;
    end;

    -- actualizar cargo
    update cuota_social_charges
       set paid_amount = paid_amount + v_credit_total,
           paid_at = case
             when paid_amount + v_credit_total >= amount - 0.005 then now()
             else paid_at
           end
     where id = v_charge.id;

    -- generar crédito de cuota social aplicable en la dispensa
    if v_credit_total > 0.005 then
      insert into member_credits (
        tenant_id, member_id, kind, amount, description, created_by
      ) values (
        v_tenant, p_member_id, 'cuota_social', v_credit_total,
        'Cuota social ' || to_char(v_charge.periodo, 'TMMonth YYYY') || ' — cobro paralelo',
        auth.uid()
      );
    end if;
  end loop;

  -- sobrante del pool de pagos → saldo a favor general
  for i in v_pay_idx..v_pay_count loop
    if v_pay_remaining[i] > 0.005 then
      insert into ledger (
        tenant_id, shift_id, type, category, concept,
        amount, exchange_rate, amount_local, account_id
      ) values (
        v_tenant, v_shift_id, 'ingreso', 'Cuenta corriente', 'Saldo a favor generado',
        v_pay_remaining[i] / v_pay_rates[i], v_pay_rates[i],
        v_pay_remaining[i], v_pay_accounts[i]
      );
      insert into member_credits (
        tenant_id, member_id, kind, amount, description, created_by
      ) values (
        v_tenant, p_member_id, 'general', v_pay_remaining[i],
        'Saldo a favor generado', auth.uid()
      );
    end if;
  end loop;
end;
$$;
