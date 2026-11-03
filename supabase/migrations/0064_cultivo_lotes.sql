-- Recorrido del cultivo por lotes.
--
--   Madres y esquejes → Vege → Flora (una o varias salas) → Secado → Stock
--
-- * Madres/esquejes y vege: plantas por genética y cantidad, sin lote. Las
--   madres quedan fijas (es_madre) y no se mueven.
-- * El lote nace cuando las plantas entran a una sala de flora. Si la sala ya
--   tiene un lote en flora, las plantas se suman a ese lote. Desde ahí el
--   lote viaja entero: flora → secado → stock.
-- * Los días de cada etapa se calculan desde la fecha de inicio (ya no se
--   cargan a mano).
-- * Al enviar a stock, el peso seco de cada genética se suma al stock general
--   con la nota "Cosecha lote L-00X".

create or replace function hoy_ar() returns date
language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- ── Salas: tipo y orden en el recorrido ───────────────────────────────────
alter table salas add column if not exists tipo text;
alter table salas add column if not exists orden int not null default 0;

update salas set tipo = case
    when etapa = 'floracion' then 'flora'
    when etapa = 'secado' then 'secado'
    when name ~* '(madre|clon|esqueje)' then 'madres'
    else 'vege'
  end
where tipo is null;

update salas set orden = case tipo when 'madres' then 1 when 'vege' then 2 when 'flora' then 3 when 'secado' then 5 else 9 end;

alter table salas alter column tipo set default 'vege';
alter table salas alter column tipo set not null;
alter table salas add constraint salas_tipo_chk check (tipo in ('madres', 'vege', 'flora', 'secado'));

-- ── Lotes ──────────────────────────────────────────────────────────────────
create table lotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  numero int not null,
  -- Sala donde está ahora (null cuando ya pasó a stock).
  sala_id uuid references salas(id) on delete set null,
  -- Sala de flora donde nació (para el historial).
  sala_flora_id uuid references salas(id) on delete set null,
  estado text not null default 'flora' check (estado in ('flora', 'secado', 'cerrado')),
  flora_inicio date not null default hoy_ar(),
  dias_flora int not null default 63,
  secado_inicio date,
  cerrado_at timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid(),
  unique (tenant_id, numero)
);

create index lotes_tenant_idx on lotes(tenant_id, estado);

alter table lotes enable row level security;
create policy lotes_tenant on lotes for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- ── Plantas por sala: lote, madre y fecha de ingreso ──────────────────────
alter table sala_strains drop constraint if exists sala_strains_sala_id_strain_id_key;
alter table sala_strains add column if not exists lote_id uuid references lotes(id) on delete cascade;
alter table sala_strains add column if not exists es_madre boolean not null default false;
alter table sala_strains add column if not exists ingreso_at date not null default hoy_ar();

create index if not exists sala_strains_lote_idx on sala_strains(lote_id);

-- ── Pesajes por lote y genética ────────────────────────────────────────────
create table lote_pesajes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lote_id uuid not null references lotes(id) on delete cascade,
  strain_id uuid not null references strains(id),
  plantas int not null default 0,
  peso_humedo numeric,
  peso_seco numeric,
  peso_trim numeric,
  unique (lote_id, strain_id)
);

alter table lote_pesajes enable row level security;
create policy lote_pesajes_tenant on lote_pesajes for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- ── Registro de movimientos (el recorrido) ─────────────────────────────────
create table cultivo_movimientos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid(),
  tipo text not null check (tipo in ('alta', 'mover', 'descarte', 'cosecha', 'stock', 'ajuste')),
  sala_origen_id uuid references salas(id) on delete set null,
  sala_destino_id uuid references salas(id) on delete set null,
  lote_id uuid references lotes(id) on delete set null,
  strain_id uuid references strains(id),
  plantas int,
  gramos numeric,
  nota text
);

create index cultivo_movimientos_lote_idx on cultivo_movimientos(lote_id);
create index cultivo_movimientos_tenant_idx on cultivo_movimientos(tenant_id, created_at desc);

alter table cultivo_movimientos enable row level security;
create policy cultivo_movimientos_tenant on cultivo_movimientos for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- ── Datos actuales: lotes para lo que ya está en flora / secado ───────────
-- Como hasta ahora solo había "día X" cargado a mano, la fecha de inicio se
-- aproxima desde ese número (se corrige desde "Editar lote").
do $$
declare
  s record;
  v_lote uuid;
  v_num int;
  v_inicio date;
begin
  for s in
    select * from salas
    where tipo in ('flora', 'secado')
      and exists (select 1 from sala_strains ss where ss.sala_id = salas.id and ss.plants > 0)
    order by tenant_id, orden, name
  loop
    select coalesce(max(numero), 0) + 1 into v_num from lotes where tenant_id = s.tenant_id;
    v_inicio := hoy_ar() - greatest(s.etapa_dias - 1, 0);
    insert into lotes (tenant_id, numero, sala_id, sala_flora_id, estado, flora_inicio, secado_inicio, created_by)
      values (
        s.tenant_id, v_num, s.id, case when s.tipo = 'flora' then s.id end,
        case when s.tipo = 'flora' then 'flora' else 'secado' end,
        v_inicio, case when s.tipo = 'secado' then v_inicio end, null
      )
      returning id into v_lote;
    update sala_strains set lote_id = v_lote, ingreso_at = v_inicio where sala_id = s.id;
    insert into cultivo_movimientos (tenant_id, created_by, tipo, sala_destino_id, lote_id, strain_id, plantas, nota)
      select s.tenant_id, null, 'alta', s.id, v_lote, strain_id, plants, 'Lote creado al pasar al registro por lotes'
      from sala_strains where sala_id = s.id and plants > 0;
  end loop;

  update sala_strains ss
    set ingreso_at = hoy_ar() - greatest(sa.etapa_dias - 1, 0)
    from salas sa
    where sa.id = ss.sala_id and sa.tipo in ('madres', 'vege');

  delete from sala_strains where plants <= 0;
end $$;

-- ── Funciones ──────────────────────────────────────────────────────────────

-- Suma plantas a una sala (agrupa por genética + lote + madre).
create or replace function _cultivo_sumar(
  p_sala uuid, p_strain uuid, p_lote uuid, p_madre boolean, p_plants int
) returns void
language plpgsql as $$
begin
  update sala_strains
    set plants = plants + p_plants
    where sala_id = p_sala and strain_id = p_strain
      and lote_id is not distinct from p_lote and es_madre = p_madre;
  if not found then
    insert into sala_strains (tenant_id, sala_id, strain_id, plants, lote_id, es_madre, ingreso_at)
      values (current_tenant_id(), p_sala, p_strain, p_plants, p_lote, p_madre, hoy_ar());
  end if;
end;
$$;

-- Lote en flora de una sala de flora; si no hay, lo crea con el número
-- siguiente.
create or replace function _lote_de_sala_flora(p_sala uuid) returns uuid
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_lote uuid;
  v_num int;
begin
  select id into v_lote from lotes
    where sala_id = p_sala and estado = 'flora'
    order by created_at desc limit 1;
  if v_lote is not null then
    return v_lote;
  end if;
  perform pg_advisory_xact_lock(hashtext('lotes:' || v_tenant::text));
  select coalesce(max(numero), 0) + 1 into v_num from lotes where tenant_id = v_tenant;
  insert into lotes (tenant_id, numero, sala_id, sala_flora_id, estado)
    values (v_tenant, v_num, p_sala, p_sala, 'flora')
    returning id into v_lote;
  return v_lote;
end;
$$;

-- Carga de plantas nuevas (esquejes, madres o correcciones).
-- p_items: [{"strain_id": "...", "plants": 10, "es_madre": false}]
create or replace function cultivo_cargar(p_sala_id uuid, p_items jsonb, p_nota text default null)
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_sala salas;
  v_item jsonb;
  v_lote uuid;
  v_plants int;
  v_madre boolean;
begin
  select * into v_sala from salas where id = p_sala_id;
  if v_sala.id is null then raise exception 'Sala inexistente'; end if;
  if v_sala.tipo = 'secado' then
    raise exception 'A secado las plantas llegan cosechando un lote de flora';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Cargá al menos una genética con plantas';
  end if;

  if v_sala.tipo = 'flora' then
    v_lote := _lote_de_sala_flora(p_sala_id);
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_plants := (v_item->>'plants')::int;
    v_madre := v_sala.tipo = 'madres' and coalesce((v_item->>'es_madre')::boolean, false);
    if v_plants is null or v_plants <= 0 then continue; end if;
    perform _cultivo_sumar(p_sala_id, (v_item->>'strain_id')::uuid, v_lote, v_madre, v_plants);
    insert into cultivo_movimientos (tenant_id, tipo, sala_destino_id, lote_id, strain_id, plantas, nota)
      values (v_tenant, 'alta', p_sala_id, v_lote, (v_item->>'strain_id')::uuid, v_plants,
              coalesce(nullif(p_nota, ''), case when v_madre then 'Madres' end));
  end loop;
end;
$$;

-- Pasa plantas de una sala a la siguiente.
--   madres → vege · madres → flora · vege → flora
-- Al entrar a flora quedan dentro del lote de esa sala (o nace uno nuevo).
-- p_items: [{"id": "<sala_strains.id>", "plants": 10}]
-- Devuelve el número de lote cuando el destino es flora.
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
  v_movidas int := 0;
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

  if v_des.tipo = 'flora' then
    v_lote := _lote_de_sala_flora(p_destino);
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

    if v_plants = v_row.plants then
      delete from sala_strains where id = v_row.id;
    else
      update sala_strains set plants = plants - v_plants where id = v_row.id;
    end if;
    perform _cultivo_sumar(p_destino, v_row.strain_id, v_lote, false, v_plants);

    insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, sala_destino_id, lote_id, strain_id, plantas)
      values (v_tenant, 'mover', p_origen, p_destino, v_lote, v_row.strain_id, v_plants);
    v_movidas := v_movidas + v_plants;
  end loop;

  if v_movidas = 0 then raise exception 'Elegí al menos una genética con plantas para mover'; end if;

  if v_lote is not null then
    return (select numero from lotes where id = v_lote);
  end if;
  return null;
end;
$$;

-- Plantas que se pierden o se descartan.
create or replace function cultivo_descartar(p_id uuid, p_plants int, p_nota text default null)
returns void
language plpgsql as $$
declare
  v_row sala_strains;
begin
  select * into v_row from sala_strains where id = p_id for update;
  if v_row.id is null then raise exception 'Las plantas ya no están en la sala'; end if;
  if p_plants is null or p_plants <= 0 then raise exception 'Indicá cuántas plantas'; end if;
  if p_plants > v_row.plants then
    raise exception 'Hay % plantas y querés descartar %', v_row.plants, p_plants;
  end if;
  if p_plants = v_row.plants then
    delete from sala_strains where id = v_row.id;
  else
    update sala_strains set plants = plants - p_plants where id = v_row.id;
  end if;
  insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, lote_id, strain_id, plantas, nota)
    values (current_tenant_id(), 'descarte', v_row.sala_id, v_row.lote_id, v_row.strain_id, p_plants, nullif(p_nota, ''));
end;
$$;

-- Cosecha: el lote pasa entero de flora a secado.
-- p_items (opcional): [{"strain_id": "...", "peso_humedo": 1234}]
create or replace function lote_cosechar(p_lote_id uuid, p_sala_secado uuid, p_items jsonb default '[]')
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_lote lotes;
  v_sec salas;
  r record;
  v_humedo numeric;
begin
  select * into v_lote from lotes where id = p_lote_id for update;
  if v_lote.id is null then raise exception 'Lote inexistente'; end if;
  if v_lote.estado <> 'flora' then raise exception 'El lote ya no está en flora'; end if;
  select * into v_sec from salas where id = p_sala_secado;
  if v_sec.id is null or v_sec.tipo <> 'secado' then raise exception 'Elegí una sala de secado'; end if;

  for r in
    select strain_id, sum(plants)::int as plants from sala_strains
    where lote_id = p_lote_id group by strain_id
  loop
    select nullif((i->>'peso_humedo')::numeric, 0) into v_humedo
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
      where (i->>'strain_id')::uuid = r.strain_id limit 1;
    insert into lote_pesajes (tenant_id, lote_id, strain_id, plantas, peso_humedo)
      values (v_tenant, p_lote_id, r.strain_id, r.plants, v_humedo)
      on conflict (lote_id, strain_id) do update set plantas = excluded.plantas, peso_humedo = excluded.peso_humedo;
    insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, sala_destino_id, lote_id, strain_id, plantas, gramos)
      values (v_tenant, 'cosecha', v_lote.sala_id, p_sala_secado, p_lote_id, r.strain_id, r.plants, v_humedo);
  end loop;

  if not found then raise exception 'El lote no tiene plantas cargadas'; end if;

  update sala_strains set sala_id = p_sala_secado, ingreso_at = hoy_ar() where lote_id = p_lote_id;
  update lotes set estado = 'secado', secado_inicio = hoy_ar(), sala_id = p_sala_secado where id = p_lote_id;
end;
$$;

-- Fin del secado y manicura: peso seco por genética → stock general.
-- p_items: [{"strain_id": "...", "peso_seco": 850, "peso_trim": 120}]
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
  v_codigo := 'L-' || lpad(v_lote.numero::text, 3, '0');

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
