-- Modificaciones 26/08.
--
-- Caja general pasa a cerrarse con el mismo formato que la diaria
-- (efectivo por denominacion + dolares total + "dejar para la
-- siguiente" separado de lo contado) — antes solo pedia un total de
-- efectivo. Y ambos RPC de cierre devuelven el id del turno recien
-- cerrado, para poder ofrecer imprimir el arqueo apenas se confirma.

drop function close_caja_diaria(numeric, numeric, numeric, numeric);

create function close_caja_diaria(p_counted_cash numeric, p_counted_usd numeric, p_leave_cash numeric, p_leave_usd numeric)
returns uuid
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

  return v_shift.id;
end;
$$;

-- close_caja_general: mismo formato que la diaria (dolares + dejar para
-- la siguiente), pero sin depositar en ningun lado — caja general es el
-- ultimo escalon.
drop function close_caja_general(numeric);

create function close_caja_general(p_counted_cash numeric, p_counted_usd numeric, p_leave_cash numeric, p_leave_usd numeric)
returns uuid
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_shift caja_shifts;
  v_cash_account_id uuid;
  v_usd_account_id uuid;
  v_expected_cash numeric;
  v_expected_usd numeric;
begin
  if p_leave_cash < 0 or p_leave_cash > coalesce(p_counted_cash, 0) then
    raise exception 'El efectivo para la caja siguiente no puede ser negativo ni mayor a lo contado';
  end if;
  if p_leave_usd < 0 or p_leave_usd > coalesce(p_counted_usd, 0) then
    raise exception 'Los dólares para la caja siguiente no pueden ser negativos ni mayores a lo contado';
  end if;

  select * into v_shift from caja_shifts
    where tenant_id = v_tenant and kind = 'general' and closed_at is null
    limit 1;
  if v_shift is null then
    raise exception 'No hay un turno de caja general abierto';
  end if;

  select id into v_cash_account_id from payment_accounts where tenant_id = v_tenant and is_cash = true limit 1;
  select id into v_usd_account_id from payment_accounts
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
    values (v_tenant, 'general', auth.uid(), p_leave_cash, p_leave_usd);

  return v_shift.id;
end;
$$;
