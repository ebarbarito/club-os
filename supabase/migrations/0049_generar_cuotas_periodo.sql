-- Actualiza generar_cuotas_sociales para:
-- 1. Aceptar un período explícito (p_periodo date, opcional — default: mes actual).
-- 2. Devolver la cantidad de cargos efectivamente creados (integer).
-- La firma anterior era generar_cuotas_sociales(p_entries jsonb) sin retorno,
-- por lo que reemplazamos con create or replace añadiendo el parámetro opcional
-- y el tipo de retorno.

create or replace function generar_cuotas_sociales(
  p_entries jsonb,
  p_periodo date default null
) returns integer
language plpgsql as $$
declare
  v_tenant  uuid := current_tenant_id();
  v_periodo date := date_trunc('month', coalesce(p_periodo, now()::date))::date;
  v_entry   jsonb;
  v_count   integer := 0;
begin
  for v_entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    insert into cuota_social_charges (tenant_id, member_id, periodo, amount)
      values (v_tenant, (v_entry->>'member_id')::uuid, v_periodo, (v_entry->>'amount')::numeric)
      on conflict (tenant_id, member_id, periodo) do nothing;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
