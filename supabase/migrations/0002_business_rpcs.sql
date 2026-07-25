-- Operaciones que combinan varias tablas y deben ser atómicas.
-- SECURITY INVOKER (default): corren con los privilegios/RLS del usuario
-- autenticado que llama, no bypasean tenant isolation.

create function register_dispensa(
  p_member_id uuid,
  p_strain_id uuid,
  p_grams numeric,
  p_method payment_method
) returns dispensas
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_stock_grams numeric;
  v_price numeric;
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

  select grams, price_per_gram into v_stock_grams, v_price
    from stock join strains on strains.id = stock.strain_id
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
    values (v_tenant, p_member_id, p_strain_id, p_grams, p_grams * v_price, p_method, auth.uid())
    returning * into v_dispensa;

  insert into ledger (tenant_id, shift_id, type, category, concept, amount, method)
    values (
      v_tenant, v_shift_id, 'ingreso', 'Dispensa',
      'Dispensa ' || v_dispensa.id, v_dispensa.amount, p_method
    );

  return v_dispensa;
end;
$$;

create function close_ciclo(
  p_sala_id uuid,
  p_items jsonb -- [{"strain_id": "...", "grams": 123}, ...]
) returns ciclos
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_ciclo ciclos;
  v_item jsonb;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Cargá al menos una genética cosechada';
  end if;

  insert into ciclos (tenant_id, sala_id, closed_by)
    values (v_tenant, p_sala_id, auth.uid())
    returning * into v_ciclo;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into ciclo_items (tenant_id, ciclo_id, strain_id, grams)
      values (v_tenant, v_ciclo.id, (v_item->>'strain_id')::uuid, (v_item->>'grams')::numeric);

    insert into stock (tenant_id, strain_id, grams, min_grams)
      values (v_tenant, (v_item->>'strain_id')::uuid, (v_item->>'grams')::numeric, 0)
    on conflict (tenant_id, strain_id)
      do update set grams = stock.grams + excluded.grams, updated_at = now();
  end loop;

  return v_ciclo;
end;
$$;
