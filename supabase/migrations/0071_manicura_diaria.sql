-- Manicura diaria en Secado.
--
-- Mientras el lote está en secado, cada día se carga la manicura hecha: por
-- genética, el peso de flor manicurada, el trim, cuántas plantas se
-- trabajaron y quién la hizo. La flor entra al stock general en el momento.
-- Cuando se termina la manicura de todo el lote, "Terminar secado" lo
-- cierra (sale de la sala) con los totales acumulados.

create table lote_manicuras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lote_id uuid not null references lotes(id) on delete cascade,
  strain_id uuid not null references strains(id),
  fecha date not null default hoy_ar(),
  peso_seco numeric not null default 0 check (peso_seco >= 0),
  peso_trim numeric check (peso_trim is null or peso_trim >= 0),
  plantas int check (plantas is null or plantas > 0),
  operario text,
  nota text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid()
);

create index lote_manicuras_lote_idx on lote_manicuras(lote_id, fecha);

alter table lote_manicuras enable row level security;
create policy lote_manicuras_tenant on lote_manicuras for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Carga de la manicura de un día.
-- p_items: [{"strain_id": "...", "peso_seco": 320, "peso_trim": 45, "plantas": 4}]
create or replace function lote_manicura(
  p_lote_id uuid,
  p_items jsonb,
  p_fecha date default null,
  p_operario text default null,
  p_nota text default null
) returns int
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_lote lotes;
  v_item jsonb;
  v_strain uuid;
  v_seco numeric;
  v_trim numeric;
  v_plantas int;
  v_fecha date := coalesce(p_fecha, hoy_ar());
  v_fecha_txt text;
  v_count int := 0;
begin
  select * into v_lote from lotes where id = p_lote_id for update;
  if v_lote.id is null then raise exception 'Lote inexistente'; end if;
  if v_lote.estado <> 'secado' then raise exception 'El lote % no está en secado', v_lote.codigo; end if;
  if v_fecha > hoy_ar() then raise exception 'La fecha no puede ser futura'; end if;
  v_fecha_txt := to_char(v_fecha, 'DD/MM');

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_strain := (v_item->>'strain_id')::uuid;
    v_seco := coalesce(nullif(v_item->>'peso_seco', '')::numeric, 0);
    v_trim := nullif(nullif(v_item->>'peso_trim', '')::numeric, 0);
    v_plantas := nullif(nullif(v_item->>'plantas', '')::int, 0);
    if v_seco < 0 or coalesce(v_trim, 0) < 0 then raise exception 'Los pesos no pueden ser negativos'; end if;
    if v_seco = 0 and v_trim is null then continue; end if;
    if not exists (select 1 from sala_strains where lote_id = p_lote_id and strain_id = v_strain) then
      raise exception 'Esa genética no está en el lote %', v_lote.codigo;
    end if;

    insert into lote_manicuras (tenant_id, lote_id, strain_id, fecha, peso_seco, peso_trim, plantas, operario, nota)
      values (v_tenant, p_lote_id, v_strain, v_fecha, v_seco, v_trim, v_plantas, nullif(trim(p_operario), ''), nullif(p_nota, ''));

    -- Totales del lote por genética (se van acumulando).
    insert into lote_pesajes (tenant_id, lote_id, strain_id, plantas, peso_seco, peso_trim)
      values (
        v_tenant, p_lote_id, v_strain,
        coalesce((select sum(plants)::int from sala_strains where lote_id = p_lote_id and strain_id = v_strain), 0),
        v_seco, v_trim
      )
      on conflict (lote_id, strain_id) do update
        set peso_seco = coalesce(lote_pesajes.peso_seco, 0) + excluded.peso_seco,
            peso_trim = case when excluded.peso_trim is null then lote_pesajes.peso_trim
                             else coalesce(lote_pesajes.peso_trim, 0) + excluded.peso_trim end;

    if v_seco > 0 then
      perform adjust_stock_general(v_strain, 'add', v_seco, 'Manicura lote ' || v_lote.codigo || ' · ' || v_fecha_txt);
    end if;

    insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, lote_id, strain_id, plantas, gramos, nota)
      values (
        v_tenant, 'stock', v_lote.sala_id, p_lote_id, v_strain, v_plantas, v_seco,
        'Manicura ' || v_fecha_txt
          || coalesce(' · ' || nullif(trim(p_operario), ''), '')
          || case when v_trim is not null then ' · trim ' || v_trim || ' g' else '' end
          || coalesce(' · ' || nullif(p_nota, ''), '')
      );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'Cargá el peso de al menos una genética'; end if;
  return v_count;
end;
$$;

-- Fin del secado: el lote sale de la sala con lo manicurado hasta ahora.
create or replace function lote_terminar_secado(p_lote_id uuid)
returns void
language plpgsql as $$
declare
  v_lote lotes;
begin
  select * into v_lote from lotes where id = p_lote_id for update;
  if v_lote.id is null then raise exception 'Lote inexistente'; end if;
  if v_lote.estado <> 'secado' then raise exception 'El lote % no está en secado', v_lote.codigo; end if;
  if not exists (select 1 from lote_pesajes where lote_id = p_lote_id and coalesce(peso_seco, 0) > 0) then
    raise exception 'Cargá al menos una manicura antes de terminar el secado';
  end if;

  -- Deja registrado en el lote cuántas plantas tenía cada genética.
  update lote_pesajes lp set plantas = s.plants
    from (select strain_id, sum(plants)::int as plants from sala_strains where lote_id = p_lote_id group by strain_id) s
    where lp.lote_id = p_lote_id and lp.strain_id = s.strain_id;

  insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, lote_id, nota)
    values (current_tenant_id(), 'stock', v_lote.sala_id, p_lote_id, 'Fin del secado y la manicura');

  delete from sala_strains where lote_id = p_lote_id;
  update lotes set estado = 'cerrado', cerrado_at = now(), sala_id = null where id = p_lote_id;
end;
$$;
