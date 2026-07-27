-- register_dispensa: ahora recibe el monto sugerido (referencia) aparte
-- del cobro real, y el cobro puede venir dividido en varios métodos de
-- pago (split). Un ledger por línea de pago, no uno solo por dispensa —
-- así la caja distingue cuánto entró en efectivo vs. transferencia.
drop function register_dispensa(uuid, uuid, numeric, payment_method, numeric);

create function register_dispensa(
  p_member_id uuid,
  p_strain_id uuid,
  p_grams numeric,
  p_suggested_amount numeric,
  p_payments jsonb -- [{"method": "efectivo", "amount": 40000}, ...]
) returns dispensas
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_stock_grams numeric;
  v_member_status member_status;
  v_shift_id uuid;
  v_dispensa dispensas;
  v_payment jsonb;
  v_total numeric := 0;
begin
  select status into v_member_status from members
    where id = p_member_id and tenant_id = v_tenant;
  if v_member_status is null then
    raise exception 'Socio no encontrado';
  end if;
  if v_member_status <> 'valid' then
    raise exception 'El socio no está validado';
  end if;

  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'Cargá al menos un medio de pago';
  end if;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    v_total := v_total + (v_payment->>'amount')::numeric;
  end loop;
  if v_total <= 0 then
    raise exception 'El monto a cobrar tiene que ser mayor a 0';
  end if;

  select grams into v_stock_grams
    from stock
    where stock.tenant_id = v_tenant and stock.strain_id = p_strain_id
    for update of stock;
  if v_stock_grams is null then
    raise exception 'Sin stock cargado para esta genética';
  end if;
  if v_stock_grams < p_grams then
    raise exception 'Stock insuficiente (disponible: % g)', v_stock_grams;
  end if;

  update stock set grams = grams - p_grams, updated_at = now()
    where tenant_id = v_tenant and strain_id = p_strain_id;

  select id into v_shift_id from caja_shifts
    where tenant_id = v_tenant and closed_at is null
    limit 1;

  insert into dispensas (tenant_id, member_id, strain_id, grams, amount, suggested_amount, registered_by)
    values (v_tenant, p_member_id, p_strain_id, p_grams, v_total, p_suggested_amount, auth.uid())
    returning * into v_dispensa;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    insert into dispensa_payments (tenant_id, dispensa_id, method, amount)
      values (v_tenant, v_dispensa.id, (v_payment->>'method')::payment_method, (v_payment->>'amount')::numeric);

    insert into ledger (tenant_id, shift_id, type, category, concept, amount, method)
      values (
        v_tenant, v_shift_id, 'ingreso', 'Dispensa',
        'Dispensa ' || v_dispensa.id, (v_payment->>'amount')::numeric, (v_payment->>'method')::payment_method
      );
  end loop;

  return v_dispensa;
end;
$$;
