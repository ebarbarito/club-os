-- Lotes (tandas) desde el corte de esquejes, con el código de la planilla
-- de trazabilidad.
--
-- * El lote nace al cortar esquejes de las madres (así se sabe de qué madre
--   viene), con una sala de flora de destino. Recorre: esquejes → vege →
--   flora → secado → cerrado. El número no cambia nunca.
-- * Código: prefijo del club + número correlativo, como en la planilla
--   (GL-CUL-013). Al entrar a flora se muestra con la sala
--   ("GL-CUL-013 · 420"); eso es solo la forma de mostrarlo.
-- * Fecha de corte en el lote; inicio de flora recién al entrar a flora.

alter table tenants add column if not exists lote_prefijo text;
update tenants set lote_prefijo = 'GL-CUL' where slug in ('greenlevel', 'test') and lote_prefijo is null;

alter table lotes drop constraint if exists lotes_estado_check;
alter table lotes add constraint lotes_estado_check
  check (estado in ('esquejes', 'vege', 'flora', 'secado', 'cerrado'));
alter table lotes alter column flora_inicio drop not null;
alter table lotes add column if not exists sala_destino_id uuid references salas(id) on delete set null;
alter table lotes add column if not exists corte_fecha date;
alter table lotes add column if not exists codigo text;

-- Código armado con el prefijo del club (lo mantiene un trigger, también al
-- cambiar el número desde "Editar lote").
create or replace function lote_set_codigo() returns trigger
language plpgsql as $$
begin
  new.codigo := coalesce((select lote_prefijo from tenants where id = new.tenant_id), 'CUL')
    || '-' || lpad(new.numero::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists lotes_codigo on lotes;
create trigger lotes_codigo before insert or update of numero, tenant_id on lotes
  for each row execute function lote_set_codigo();

update lotes set numero = numero;

-- Próximo número de lote del club (con bloqueo para que dos cortes al mismo
-- tiempo no tomen el mismo).
create or replace function _proximo_numero_lote(p_tenant uuid) returns int
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('lotes:' || p_tenant::text));
  return coalesce((select max(numero) from lotes where tenant_id = p_tenant), 0) + 1;
end;
$$;

create or replace function _lote_de_sala_flora(p_sala uuid) returns uuid
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_lote uuid;
begin
  select id into v_lote from lotes
    where sala_id = p_sala and estado = 'flora'
    order by created_at desc limit 1;
  if v_lote is not null then
    return v_lote;
  end if;
  insert into lotes (tenant_id, numero, sala_id, sala_flora_id, sala_destino_id, estado, flora_inicio)
    values (v_tenant, _proximo_numero_lote(v_tenant), p_sala, p_sala, p_sala, 'flora', hoy_ar())
    returning id into v_lote;
  return v_lote;
end;
$$;

-- Corte de esquejes: nace el lote (o se suma a uno que todavía está en
-- esquejes / vege). Cada genética tiene que tener su madre en la sala.
-- p_items: [{"strain_id": "...", "plants": 12}]
create or replace function cultivo_cortar_esquejes(
  p_sala_id uuid,
  p_items jsonb,
  p_lote uuid default null,
  p_destino uuid default null,
  p_fecha date default null,
  p_nota text default null
) returns uuid
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_sala salas;
  v_lote lotes;
  v_dest salas;
  v_item jsonb;
  v_plants int;
  v_strain uuid;
  v_madre text;
  v_total int := 0;
begin
  select * into v_sala from salas where id = p_sala_id;
  if v_sala.id is null or v_sala.tipo <> 'madres' then
    raise exception 'Los esquejes se cortan en la sala de madres';
  end if;

  if p_lote is not null then
    select * into v_lote from lotes where id = p_lote for update;
    if v_lote.id is null then raise exception 'Lote inexistente'; end if;
    if v_lote.estado not in ('esquejes', 'vege') then
      raise exception 'El lote % ya pasó a flora: los esquejes nuevos van en un lote nuevo', v_lote.codigo;
    end if;
  else
    if p_destino is not null then
      select * into v_dest from salas where id = p_destino;
      if v_dest.id is null or v_dest.tipo <> 'flora' then raise exception 'El destino tiene que ser una sala de flora'; end if;
    end if;
    insert into lotes (tenant_id, numero, sala_id, sala_destino_id, estado, flora_inicio, corte_fecha)
      values (v_tenant, _proximo_numero_lote(v_tenant), p_sala_id, p_destino, 'esquejes', null, coalesce(p_fecha, hoy_ar()))
      returning * into v_lote;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_plants := (v_item->>'plants')::int;
    v_strain := (v_item->>'strain_id')::uuid;
    if v_plants is null or v_plants <= 0 then continue; end if;
    select st.name into v_madre from sala_strains ss join strains st on st.id = ss.strain_id
      where ss.sala_id = p_sala_id and ss.strain_id = v_strain and ss.es_madre and ss.plants > 0 limit 1;
    if v_madre is null then
      raise exception 'No hay una madre de esa genética cargada en %: cargala primero con "+ Madres"', v_sala.name;
    end if;
    perform _cultivo_sumar(p_sala_id, v_strain, v_lote.id, false, v_plants);
    insert into cultivo_movimientos (tenant_id, tipo, sala_destino_id, lote_id, strain_id, plantas, nota)
      values (v_tenant, 'alta', p_sala_id, v_lote.id, v_strain, v_plants,
              'Corte de esquejes de madre ' || v_madre || coalesce(' · ' || nullif(p_nota, ''), ''));
    v_total := v_total + v_plants;
  end loop;

  if v_total = 0 then raise exception 'Cargá al menos una genética con esquejes'; end if;
  return v_lote.id;
end;
$$;

-- Pasar plantas de sala. Las filas llevan su lote: el lote avanza con
-- ellas (esquejes → vege → flora). Al entrar a flora queda la sala de flora
-- en el lote y arranca el día 0. Plantas sin lote (cargadas antes) toman el
-- lote de la sala de flora, como hasta ahora.
-- p_items: [{"id": "<sala_strains.id>", "plants": 10}]
create or replace function cultivo_mover(p_origen uuid, p_destino uuid, p_items jsonb)
returns int
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_ori salas;
  v_des salas;
  v_item jsonb;
  v_row sala_strains;
  v_plants int;
  v_lote uuid;
  v_lote_rec lotes;
  v_otro text;
  v_movidas int := 0;
  v_ultimo int;
begin
  select * into v_ori from salas where id = p_origen;
  select * into v_des from salas where id = p_destino;
  if v_ori.id is null or v_des.id is null then raise exception 'Sala inexistente'; end if;
  if v_ori.tipo not in ('madres', 'vege') then
    raise exception 'Desde flora y secado el lote se mueve entero (Cosechar / Enviar a stock)';
  end if;
  if v_des.tipo not in ('vege', 'flora') or (v_ori.tipo = 'vege' and v_des.tipo <> 'flora') then
    raise exception 'Destino no válido para esta sala';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_plants := (v_item->>'plants')::int;
    if v_plants is null or v_plants <= 0 then continue; end if;
    select * into v_row from sala_strains where id = (v_item->>'id')::uuid and sala_id = p_origen for update;
    if v_row.id is null then raise exception 'Las plantas ya no están en la sala de origen'; end if;
    if v_row.es_madre then raise exception 'Las madres no se mueven de sala'; end if;
    if v_plants > v_row.plants then
      raise exception 'Hay % plantas y querés mover %', v_row.plants, v_plants;
    end if;

    v_lote := v_row.lote_id;
    if v_des.tipo = 'flora' then
      if v_lote is null then
        v_lote := _lote_de_sala_flora(p_destino);
      else
        select codigo into v_otro from lotes
          where sala_id = p_destino and estado = 'flora' and id <> v_lote limit 1;
        if v_otro is not null then
          raise exception '% ya tiene el lote % en flora', v_des.name, v_otro;
        end if;
        update lotes
          set estado = 'flora', sala_id = p_destino, sala_flora_id = p_destino,
              flora_inicio = coalesce(flora_inicio, hoy_ar())
          where id = v_lote and estado in ('esquejes', 'vege');
      end if;
    elsif v_lote is not null then
      update lotes set estado = 'vege', sala_id = p_destino where id = v_lote and estado = 'esquejes';
    end if;

    if v_plants = v_row.plants then
      delete from sala_strains where id = v_row.id;
    else
      update sala_strains set plants = plants - v_plants where id = v_row.id;
    end if;
    perform _cultivo_sumar(p_destino, v_row.strain_id, v_lote, false, v_plants);

    insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, sala_destino_id, lote_id, strain_id, plantas)
      values (v_tenant, 'mover', p_origen, p_destino, v_lote, v_row.strain_id, v_plants);
    v_movidas := v_movidas + v_plants;
    if v_lote is not null then select numero into v_ultimo from lotes where id = v_lote; end if;
  end loop;

  if v_movidas = 0 then raise exception 'Elegí al menos una genética con plantas para mover'; end if;
  return v_ultimo;
end;
$$;

create or replace function lote_a_stock(p_lote_id uuid, p_items jsonb)
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_lote lotes;
  v_item jsonb;
  v_seco numeric;
  v_trim numeric;
  v_strain uuid;
  v_codigo text;
  v_total numeric := 0;
begin
  select * into v_lote from lotes where id = p_lote_id for update;
  if v_lote.id is null then raise exception 'Lote inexistente'; end if;
  if v_lote.estado <> 'secado' then raise exception 'El lote no está en secado'; end if;
  v_codigo := v_lote.codigo;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_strain := (v_item->>'strain_id')::uuid;
    v_seco := coalesce(nullif(v_item->>'peso_seco', '')::numeric, 0);
    v_trim := nullif(nullif(v_item->>'peso_trim', '')::numeric, 0);
    if v_seco < 0 then raise exception 'El peso no puede ser negativo'; end if;

    insert into lote_pesajes (tenant_id, lote_id, strain_id, plantas, peso_seco, peso_trim)
      values (
        v_tenant, p_lote_id, v_strain,
        coalesce((select sum(plants)::int from sala_strains where lote_id = p_lote_id and strain_id = v_strain), 0),
        v_seco, v_trim
      )
      on conflict (lote_id, strain_id) do update set peso_seco = excluded.peso_seco, peso_trim = excluded.peso_trim;

    if v_seco > 0 then
      perform adjust_stock_general(v_strain, 'add', v_seco, 'Cosecha lote ' || v_codigo);
      insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, lote_id, strain_id, gramos, nota)
        values (v_tenant, 'stock', v_lote.sala_id, p_lote_id, v_strain, v_seco,
                case when v_trim is not null then 'Trim: ' || v_trim || ' g' end);
      v_total := v_total + v_seco;
    end if;
  end loop;

  if v_total <= 0 then raise exception 'Cargá el peso seco de al menos una genética'; end if;

  delete from sala_strains where lote_id = p_lote_id;
  update lotes set estado = 'cerrado', cerrado_at = now(), sala_id = null where id = p_lote_id;
end;
$$;


create or replace function proceso_desde_stock(
  p_strain uuid, p_tipo text, p_gramos numeric, p_lote uuid default null, p_nota text default null
) returns uuid
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_disp numeric;
  v_id uuid;
  v_codigo text;
  v_label text;
begin
  if p_tipo not in ('extraccion', 'aceite') then raise exception 'Proceso inválido'; end if;
  if p_gramos is null or p_gramos <= 0 then raise exception 'Indicá cuántos gramos se destinan'; end if;

  select grams into v_disp from stock_general where tenant_id = v_tenant and strain_id = p_strain for update;
  if coalesce(v_disp, 0) < p_gramos then
    raise exception 'En stock general hay % g de esa genética', coalesce(v_disp, 0);
  end if;

  if p_lote is not null then
    select codigo into v_codigo from lotes where id = p_lote;
  end if;
  v_label := case p_tipo when 'extraccion' then 'A extracción' else 'A aceites' end
    || case when v_codigo is not null then ' · lote ' || v_codigo else '' end;

  perform adjust_stock_general(p_strain, 'remove', p_gramos, v_label);

  insert into lote_procesos (tenant_id, lote_id, strain_id, tipo, plantas, peso_entrada, origen, nota)
    values (v_tenant, p_lote, p_strain, p_tipo, null, p_gramos, 'stock', nullif(p_nota, ''))
    returning id into v_id;

  insert into cultivo_movimientos (tenant_id, tipo, lote_id, strain_id, gramos, nota)
    values (v_tenant, 'derivar', p_lote, p_strain, p_gramos, 'Desde stock: ' || v_label);

  return v_id;
end;
$$;


create or replace function proceso_terminar(
  p_id uuid, p_resultado numeric, p_unidad text, p_producto uuid default null, p_nota text default null
) returns void
language plpgsql as $$
declare
  v_proc lote_procesos;
  v_codigo text;
  v_label text;
begin
  select * into v_proc from lote_procesos where id = p_id for update;
  if v_proc.id is null then raise exception 'Proceso inexistente'; end if;
  if v_proc.estado <> 'pendiente' then raise exception 'Este proceso ya se cerró'; end if;
  if p_resultado is null or p_resultado < 0 then raise exception 'Cargá cuánto rindió'; end if;
  if p_unidad not in ('g', 'ml') then raise exception 'Unidad inválida'; end if;

  update lote_procesos
    set estado = 'terminado', resultado = p_resultado, unidad = p_unidad, producto_id = p_producto,
        nota = coalesce(nullif(p_nota, ''), nota), terminado_at = now(), terminado_by = auth.uid()
    where id = p_id;

  if v_proc.lote_id is not null then
    select codigo into v_codigo from lotes where id = v_proc.lote_id;
  end if;
  v_label := case v_proc.tipo when 'extraccion' then 'Extracción' else 'Aceites' end
    || case when v_codigo is not null then ' · lote ' || v_codigo else ' · desde stock' end;

  if p_producto is not null and p_resultado > 0 then
    perform adjust_stock_general(p_producto, 'add', p_resultado, v_label);
  end if;

  insert into cultivo_movimientos (tenant_id, tipo, lote_id, strain_id, plantas, gramos, nota)
    values (
      current_tenant_id(), 'proceso', v_proc.lote_id, v_proc.strain_id, v_proc.plantas, p_resultado,
      v_label || ': rindió ' || p_resultado || ' ' || p_unidad
        || case when p_producto is null then ' (sin artículo de stock)' else '' end
    );
end;
$$;

