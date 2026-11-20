-- Vuelto en la dispensa: como la forma de pago, pero al revés. Si el socio
-- paga de más (ej. paga $10.000 en efectivo una dispensa de $8.000), el
-- vuelto sale de la cuenta que se elija (efectivo, banco...) como egreso de
-- caja con el mismo recibo, y ya no queda como saldo a favor del socio.
--
-- El vuelto se guarda en ledger como egreso de categoría 'Dispensa' ligado
-- a la dispensa (así neta contra el ingreso en Balance). Anular la dispensa
-- lo borra junto con el resto; al editarla se vuelve a aplicar.

create or replace function aplicar_vuelto(p_dispensa_id uuid, p_vueltos jsonb)
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_disp dispensas;
  v_receipt integer;
  v_shift uuid;
  v_total numeric := 0;
  v_credito numeric;
  v_v jsonb;
  v_rate numeric;
  v_rest numeric;
  v_c record;
begin
  select * into v_disp from dispensas where id = p_dispensa_id and tenant_id = v_tenant;
  if v_disp.id is null then
    raise exception 'Dispensa no encontrada';
  end if;

  -- Vuelto anterior (al editar) fuera: se aplica de nuevo el actual.
  delete from ledger
   where tenant_id = v_tenant and dispensa_id = p_dispensa_id and category = 'Dispensa' and type = 'egreso';

  for v_v in select * from jsonb_array_elements(coalesce(p_vueltos, '[]'::jsonb)) loop
    if coalesce((v_v->>'amount')::numeric, 0) <= 0 then
      continue;
    end if;
    if exists (
      select 1 from payment_accounts
       where id = (v_v->>'account_id')::uuid and tenant_id = v_tenant and is_virtual
    ) then
      raise exception 'El vuelto tiene que salir de una cuenta real (efectivo, banco, etc.)';
    end if;
    v_total := v_total + (v_v->>'amount')::numeric * coalesce((v_v->>'exchange_rate')::numeric, 1);
  end loop;
  if v_total <= 0.005 then
    return;
  end if;

  -- Solo se puede dar vuelto de lo que se pagó de más (el saldo a favor que
  -- generó esta dispensa), y ese saldo a favor se descuenta.
  select coalesce(sum(amount), 0) into v_credito
    from member_credits
   where tenant_id = v_tenant and dispensa_id = p_dispensa_id and kind = 'general' and amount > 0;
  if v_total > v_credito + 0.005 then
    raise exception 'El vuelto (%) supera lo que se pagó de más (%)', round(v_total, 2), round(v_credito, 2);
  end if;

  v_rest := v_total;
  for v_c in
    select id, amount from member_credits
     where tenant_id = v_tenant and dispensa_id = p_dispensa_id and kind = 'general' and amount > 0
     order by created_at desc
  loop
    exit when v_rest <= 0.005;
    if v_c.amount <= v_rest + 0.005 then
      delete from member_credits where id = v_c.id;
      v_rest := v_rest - v_c.amount;
    else
      update member_credits set amount = amount - v_rest where id = v_c.id;
      v_rest := 0;
    end if;
  end loop;

  select receipt_number into v_receipt
    from ledger
   where tenant_id = v_tenant and dispensa_id = p_dispensa_id and category = 'Dispensa' and receipt_number is not null
   limit 1;
  -- Mismo turno de caja que el cobro de la dispensa (si no hay, el abierto).
  select shift_id into v_shift
    from ledger
   where tenant_id = v_tenant and dispensa_id = p_dispensa_id and category = 'Dispensa' and type = 'ingreso'
   limit 1;
  if v_shift is null then
    select id into v_shift from caja_shifts
     where tenant_id = v_tenant and kind = 'diaria' and closed_at is null
     limit 1;
  end if;

  for v_v in select * from jsonb_array_elements(p_vueltos) loop
    if coalesce((v_v->>'amount')::numeric, 0) <= 0 then
      continue;
    end if;
    v_rate := coalesce((v_v->>'exchange_rate')::numeric, 1);
    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id, receipt_number)
      values (
        v_tenant, v_shift, 'egreso', 'Dispensa',
        coalesce('rec' || lpad(v_receipt::text, 2, '0') || ' ', '') || 'Vuelto Dispensa N°' || v_disp.number,
        (v_v->>'amount')::numeric, v_rate, (v_v->>'amount')::numeric * v_rate,
        (v_v->>'account_id')::uuid, p_dispensa_id, v_receipt
      );
  end loop;
end;
$$;

-- Registrar / editar dispensa con vuelto, todo en una sola operación.
create or replace function register_dispensa_vuelto(
  p_member_id uuid,
  p_items jsonb,
  p_suggested_amount numeric,
  p_payments jsonb,
  p_note text default null,
  p_vueltos jsonb default '[]'::jsonb
) returns dispensas
language plpgsql as $$
declare
  v_disp dispensas;
begin
  v_disp := register_dispensa(p_member_id, p_items, p_suggested_amount, p_payments, p_note);
  perform aplicar_vuelto(v_disp.id, p_vueltos);
  return v_disp;
end;
$$;

create or replace function update_dispensa_vuelto(
  p_dispensa_id uuid,
  p_member_id uuid,
  p_items jsonb,
  p_note text,
  p_payments jsonb,
  p_vueltos jsonb default '[]'::jsonb
) returns dispensas
language plpgsql as $$
declare
  v_disp dispensas;
begin
  v_disp := update_dispensa(p_dispensa_id, p_member_id, p_items, p_note, p_payments);
  perform aplicar_vuelto(p_dispensa_id, p_vueltos);
  return v_disp;
end;
$$;
