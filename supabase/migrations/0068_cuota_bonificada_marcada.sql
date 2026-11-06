-- Cuota social bonificada al 100%: se genera igual (queda registrada con su
-- importe) pero marcada como bonificada, para distinguirla de una cuota
-- cobrada. No genera deuda ni movimiento de caja; el importe se acredita
-- para retirar producto.

alter table cuota_social_charges add column if not exists bonificada boolean not null default false;

create or replace function generar_cuotas_sociales(
  p_entries jsonb,
  p_periodo date default null
) returns integer
language plpgsql as $$
declare
  v_tenant  uuid := current_tenant_id();
  v_periodo date := date_trunc('month', coalesce(p_periodo, hoy_ar()))::date;
  v_entry   jsonb;
  v_amount  numeric;
  v_bonif   boolean;
  v_member  uuid;
  v_id      uuid;
  v_count   integer := 0;
begin
  for v_entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    v_member := (v_entry->>'member_id')::uuid;
    v_amount := (v_entry->>'amount')::numeric;
    v_bonif := coalesce((v_entry->>'bonificada')::boolean, false);
    if v_amount is null or v_amount <= 0 then continue; end if;

    v_id := null;
    insert into cuota_social_charges (tenant_id, member_id, periodo, amount, paid_amount, paid_at, bonificada)
      values (
        v_tenant, v_member, v_periodo, v_amount,
        case when v_bonif then v_amount else 0 end,
        case when v_bonif then now() end,
        v_bonif
      )
      on conflict (tenant_id, member_id, periodo) do nothing
      returning id into v_id;

    if v_id is not null then
      v_count := v_count + 1;
      if v_bonif then
        insert into member_credits (tenant_id, member_id, kind, amount, description, created_by)
          values (
            v_tenant, v_member, 'cuota_social', v_amount,
            'Cuota social ' || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
              'septiembre','octubre','noviembre','diciembre'])[extract(month from v_periodo)::int]
              || ' ' || extract(year from v_periodo)::int || ' — bonificada',
            auth.uid()
          );
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;
