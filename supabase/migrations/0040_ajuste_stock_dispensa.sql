-- Ajuste manual de stock dispensa (Modificaciones 15/9/26): hasta ahora
-- la sala dispensa solo se movía por register_dispensa/void_dispensa o por
-- "Enviar" desde stock general — no había forma de corregir un conteo
-- físico ahí directamente. Análogo a adjust_stock_general, pero sobre
-- `stock` en vez de `stock_general`, y además deja constancia en
-- audit_log (Asientos) — a diferencia del ajuste de stock general, este sí
-- lo pidió el usuario visible ahí, no solo en el modal "Movimientos".
create function adjust_stock_dispensa(p_strain_id uuid, p_mode text, p_value numeric, p_note text default null)
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_current numeric;
  v_new numeric;
  v_strain_name text;
begin
  select name into v_strain_name from strains where id = p_strain_id and tenant_id = v_tenant;
  if v_strain_name is null then
    raise exception 'Artículo no encontrado';
  end if;

  select grams into v_current from stock
    where tenant_id = v_tenant and strain_id = p_strain_id
    for update;
  if v_current is null then
    insert into stock (tenant_id, strain_id, grams) values (v_tenant, p_strain_id, 0);
    v_current := 0;
  end if;

  if p_mode = 'set' then
    v_new := p_value;
  elsif p_mode = 'add' then
    v_new := v_current + p_value;
  elsif p_mode = 'remove' then
    v_new := greatest(0, v_current - p_value);
  else
    raise exception 'Modo inválido: %', p_mode;
  end if;

  update stock set grams = v_new, updated_at = now()
    where tenant_id = v_tenant and strain_id = p_strain_id;

  insert into stock_movements (tenant_id, strain_id, type, quantity, note, created_by)
    values (v_tenant, p_strain_id, 'ajuste', v_new - v_current, p_note, auth.uid());

  insert into audit_log (tenant_id, user_id, entity_type, entity_id, change_type, description, reason)
    values (
      v_tenant, auth.uid(), 'stock_dispensa', p_strain_id, 'edicion',
      'Ajuste de stock dispensa — ' || v_strain_name || ': ' || v_current || ' → ' || v_new,
      p_note
    );
end;
$$;
