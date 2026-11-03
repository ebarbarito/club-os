-- Derivaciones al cosechar: parte de las plantas de un lote puede ir a
-- extracción (prensa) o a aceites en vez de a secado. Siguen atadas al lote.
--
-- * Al cosechar se indica, por genética, cuántas plantas van a cada proceso
--   y con cuánto peso salen de la sala.
-- * Cada derivación queda como proceso pendiente; al terminar se carga lo que
--   rindió (g o ml) y, si ya existe el artículo en el catálogo, se suma a su
--   stock general.

create table lote_procesos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lote_id uuid not null references lotes(id) on delete cascade,
  strain_id uuid not null references strains(id),
  tipo text not null check (tipo in ('extraccion', 'aceite')),
  plantas int not null check (plantas > 0),
  peso_entrada numeric,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'terminado')),
  resultado numeric,
  unidad text check (unidad in ('g', 'ml')),
  producto_id uuid references strains(id),
  nota text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid(),
  terminado_at timestamptz,
  terminado_by uuid references profiles(id)
);

create index lote_procesos_lote_idx on lote_procesos(lote_id);
create index lote_procesos_tenant_idx on lote_procesos(tenant_id, estado);

alter table lote_procesos enable row level security;
create policy lote_procesos_tenant on lote_procesos for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table cultivo_movimientos drop constraint if exists cultivo_movimientos_tipo_check;
alter table cultivo_movimientos add constraint cultivo_movimientos_tipo_check
  check (tipo in ('alta', 'mover', 'descarte', 'cosecha', 'stock', 'ajuste', 'derivar', 'proceso'));

-- Cosecha con derivaciones.
-- p_items: [{"strain_id": "...", "peso_humedo": 1234,
--            "extraccion_plantas": 5, "extraccion_peso": 900,
--            "aceite_plantas": 3, "aceite_peso": 400}]
-- Las plantas que no se derivan pasan a secado. Si se deriva todo, el lote
-- se cierra (sale de las salas) y quedan solo sus procesos.
create or replace function lote_cosechar(p_lote_id uuid, p_sala_secado uuid, p_items jsonb default '[]')
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_lote lotes;
  v_sec salas;
  r record;
  v_item jsonb;
  v_humedo numeric;
  v_ext int;
  v_ace int;
  v_ext_peso numeric;
  v_ace_peso numeric;
  v_quedan int;
  v_hay boolean := false;
  v_restantes int;
begin
  select * into v_lote from lotes where id = p_lote_id for update;
  if v_lote.id is null then raise exception 'Lote inexistente'; end if;
  if v_lote.estado <> 'flora' then raise exception 'El lote ya no está en flora'; end if;

  for r in
    select ss.strain_id, st.name, sum(ss.plants)::int as plants
    from sala_strains ss join strains st on st.id = ss.strain_id
    where ss.lote_id = p_lote_id
    group by ss.strain_id, st.name
  loop
    v_hay := true;
    v_item := null;
    select e.value into v_item from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as e(value)
      where (e.value->>'strain_id')::uuid = r.strain_id limit 1;

    v_humedo := nullif(nullif(v_item->>'peso_humedo', '')::numeric, 0);
    v_ext := coalesce(nullif(v_item->>'extraccion_plantas', '')::int, 0);
    v_ace := coalesce(nullif(v_item->>'aceite_plantas', '')::int, 0);
    v_ext_peso := nullif(nullif(v_item->>'extraccion_peso', '')::numeric, 0);
    v_ace_peso := nullif(nullif(v_item->>'aceite_peso', '')::numeric, 0);

    if v_ext < 0 or v_ace < 0 then raise exception 'Cantidad de plantas inválida en %', r.name; end if;
    if v_ext + v_ace > r.plants then
      raise exception '% tiene % plantas y querés derivar %', r.name, r.plants, v_ext + v_ace;
    end if;
    if v_ext > 0 and v_ext_peso is null then
      raise exception 'Cargá el peso que sale a extracción de %', r.name;
    end if;
    if v_ace > 0 and v_ace_peso is null then
      raise exception 'Cargá el peso que sale a aceites de %', r.name;
    end if;

    if v_ext > 0 then
      insert into lote_procesos (tenant_id, lote_id, strain_id, tipo, plantas, peso_entrada)
        values (v_tenant, p_lote_id, r.strain_id, 'extraccion', v_ext, v_ext_peso);
      insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, lote_id, strain_id, plantas, gramos, nota)
        values (v_tenant, 'derivar', v_lote.sala_id, p_lote_id, r.strain_id, v_ext, v_ext_peso, 'A extracción');
    end if;
    if v_ace > 0 then
      insert into lote_procesos (tenant_id, lote_id, strain_id, tipo, plantas, peso_entrada)
        values (v_tenant, p_lote_id, r.strain_id, 'aceite', v_ace, v_ace_peso);
      insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, lote_id, strain_id, plantas, gramos, nota)
        values (v_tenant, 'derivar', v_lote.sala_id, p_lote_id, r.strain_id, v_ace, v_ace_peso, 'A aceites');
    end if;

    v_quedan := r.plants - v_ext - v_ace;
    -- En flora hay una fila por genética y lote; se deja con lo que va a secado.
    delete from sala_strains where lote_id = p_lote_id and strain_id = r.strain_id;
    if v_quedan > 0 then
      insert into sala_strains (tenant_id, sala_id, strain_id, plants, lote_id, es_madre, ingreso_at)
        values (v_tenant, v_lote.sala_id, r.strain_id, v_quedan, p_lote_id, false, hoy_ar());
      insert into lote_pesajes (tenant_id, lote_id, strain_id, plantas, peso_humedo)
        values (v_tenant, p_lote_id, r.strain_id, v_quedan, v_humedo)
        on conflict (lote_id, strain_id) do update set plantas = excluded.plantas, peso_humedo = excluded.peso_humedo;
      insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, sala_destino_id, lote_id, strain_id, plantas, gramos)
        values (v_tenant, 'cosecha', v_lote.sala_id, p_sala_secado, p_lote_id, r.strain_id, v_quedan, v_humedo);
    end if;
  end loop;

  if not v_hay then raise exception 'El lote no tiene plantas cargadas'; end if;

  select coalesce(sum(plants), 0)::int into v_restantes from sala_strains where lote_id = p_lote_id;
  if v_restantes = 0 then
    -- Todo fue a extracción / aceites: el lote sale de las salas.
    update lotes set estado = 'cerrado', cerrado_at = now(), sala_id = null where id = p_lote_id;
    return;
  end if;

  select * into v_sec from salas where id = p_sala_secado;
  if v_sec.id is null or v_sec.tipo <> 'secado' then raise exception 'Elegí una sala de secado'; end if;
  update sala_strains set sala_id = p_sala_secado, ingreso_at = hoy_ar() where lote_id = p_lote_id;
  update lotes set estado = 'secado', secado_inicio = hoy_ar(), sala_id = p_sala_secado where id = p_lote_id;
end;
$$;

-- Fin de un proceso: lo que rindió. Con artículo elegido, suma a su stock
-- general.
create or replace function proceso_terminar(
  p_id uuid, p_resultado numeric, p_unidad text, p_producto uuid default null, p_nota text default null
) returns void
language plpgsql as $$
declare
  v_proc lote_procesos;
  v_numero int;
begin
  select * into v_proc from lote_procesos where id = p_id for update;
  if v_proc.id is null then raise exception 'Proceso inexistente'; end if;
  if v_proc.estado <> 'pendiente' then raise exception 'Este proceso ya se cerró'; end if;
  if p_resultado is null or p_resultado < 0 then raise exception 'Cargá cuánto rindió'; end if;
  if p_unidad not in ('g', 'ml') then raise exception 'Unidad inválida'; end if;

  update lote_procesos
    set estado = 'terminado', resultado = p_resultado, unidad = p_unidad, producto_id = p_producto,
        nota = nullif(p_nota, ''), terminado_at = now(), terminado_by = auth.uid()
    where id = p_id;

  select numero into v_numero from lotes where id = v_proc.lote_id;
  if p_producto is not null and p_resultado > 0 then
    perform adjust_stock_general(
      p_producto, 'add', p_resultado,
      'Lote L-' || lpad(v_numero::text, 3, '0') || ' · ' ||
        case v_proc.tipo when 'extraccion' then 'Extracción' else 'Aceites' end
    );
  end if;

  insert into cultivo_movimientos (tenant_id, tipo, lote_id, strain_id, plantas, gramos, nota)
    values (
      current_tenant_id(), 'proceso', v_proc.lote_id, v_proc.strain_id, v_proc.plantas, p_resultado,
      case v_proc.tipo when 'extraccion' then 'Extracción' else 'Aceites' end || ': rindió ' || p_resultado || ' ' || p_unidad
        || case when p_producto is null then ' (sin artículo de stock)' else '' end
    );
end;
$$;
