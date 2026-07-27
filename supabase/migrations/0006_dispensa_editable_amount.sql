-- El monto de la dispensa pasa a ser editable por quien la registra
-- (ej. ajuste/descuento puntual) en vez de calcularse siempre como
-- grams * price_per_gram del catálogo. El precio de catálogo se sigue
-- usando como "sugerido" en la UI, pero el monto real cobrado lo decide
-- el dispensador al momento de cargarla.
drop function register_dispensa(uuid, uuid, numeric, payment_method);

create function register_dispensa(
  p_member_id uuid,
  p_strain_id uuid,
  p_grams numeric,
  p_method payment_method,
  p_amount numeric
) returns dispensas
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_stock_grams numeric;
  v_member_status member_status;
  v_shift_id uuid;
  v_dispensa dispensas;
begin
  select status into v_member_status from members
    where id = p_member_id and tenant_id = v_tenant;
  if v_member_status is null then
    raise exception 'Socio no encontrado';
  end if;
  if v_member_status <> 'valid' then
    raise exception 'El socio no está validado';
  end if;

  if p_amount is null or p_amount <= 0 then
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

  insert into dispensas (tenant_id, member_id, strain_id, grams, amount, method, registered_by)
    values (v_tenant, p_member_id, p_strain_id, p_grams, p_amount, p_method, auth.uid())
    returning * into v_dispensa;

  insert into ledger (tenant_id, shift_id, type, category, concept, amount, method)
    values (
      v_tenant, v_shift_id, 'ingreso', 'Dispensa',
      'Dispensa ' || v_dispensa.id, v_dispensa.amount, p_method
    );

  return v_dispensa;
end;
$$;
