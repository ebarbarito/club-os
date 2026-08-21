-- El documento pide que la apertura de caja general "sea el importe que
-- surja del ultimo arqueo de esta caja" — igual que la diaria, tiene que
-- reabrirse sola con lo contado, sin que el admin lo vuelva a tipear.
create function close_caja_general(p_counted_cash numeric) returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_shift caja_shifts;
  v_cash_account_id uuid;
  v_expected_cash numeric;
begin
  select * into v_shift from caja_shifts
    where tenant_id = v_tenant and kind = 'general' and closed_at is null
    limit 1;
  if v_shift is null then
    raise exception 'No hay un turno de caja general abierto';
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
    values (v_tenant, 'general', auth.uid(), p_counted_cash);
end;
$$;
