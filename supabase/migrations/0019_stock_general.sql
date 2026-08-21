-- Stock general (deposito) separado del stock que usa la dispensa. La
-- tabla `stock` existente sigue siendo "stock dispensa" tal cual —
-- register_dispensa/void_dispensa no se tocan. "Enviar" mueve stock de
-- general a dispensa (o lo descarta como muestra); "Ajustar" es el
-- ingreso manual (compra/cosecha) que solo existe del lado de general.

create table stock_general (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  strain_id uuid not null references strains(id),
  grams numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (tenant_id, strain_id)
);

alter table stock_general enable row level security;
create policy stock_general_tenant on stock_general for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

insert into stock_general (tenant_id, strain_id, grams)
  select tenant_id, strain_id, 0 from stock;

create type stock_movement_type as enum ('envio_muestra', 'envio_dispensa', 'ajuste');

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  strain_id uuid not null references strains(id),
  type stock_movement_type not null,
  quantity numeric not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table stock_movements enable row level security;
create policy stock_movements_tenant on stock_movements for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Envio general -> dispensa (o descarte como muestra). Siempre resta de
-- stock general; solo suma en stock dispensa cuando el tipo es
-- 'envio_dispensa'.
create function send_stock(p_strain_id uuid, p_quantity numeric, p_type stock_movement_type, p_note text default null)
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_general_grams numeric;
begin
  if p_type = 'ajuste' then
    raise exception 'Un envío no puede ser de tipo ajuste';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  select grams into v_general_grams from stock_general
    where tenant_id = v_tenant and strain_id = p_strain_id
    for update;
  if v_general_grams is null or v_general_grams < p_quantity then
    raise exception 'Stock insuficiente en stock general (disponible: %)', coalesce(v_general_grams, 0);
  end if;

  update stock_general set grams = grams - p_quantity, updated_at = now()
    where tenant_id = v_tenant and strain_id = p_strain_id;

  if p_type = 'envio_dispensa' then
    insert into stock (tenant_id, strain_id, grams) values (v_tenant, p_strain_id, p_quantity)
      on conflict (tenant_id, strain_id) do update set grams = stock.grams + excluded.grams, updated_at = now();
  end if;

  insert into stock_movements (tenant_id, strain_id, type, quantity, note, created_by)
    values (v_tenant, p_strain_id, p_type, p_quantity, p_note, auth.uid());
end;
$$;

-- Ajuste manual de stock general (ingreso de compra/cosecha, merma, o
-- fijar un valor exacto) — analogo al viejo "Ajustar stock" pero ahora
-- solo aplica al deposito general, nunca a la sala de dispensa.
create function adjust_stock_general(p_strain_id uuid, p_mode text, p_value numeric, p_note text default null)
returns void
language plpgsql as $$
declare
  v_tenant uuid := current_tenant_id();
  v_current numeric;
  v_new numeric;
begin
  select grams into v_current from stock_general
    where tenant_id = v_tenant and strain_id = p_strain_id
    for update;
  if v_current is null then
    insert into stock_general (tenant_id, strain_id, grams) values (v_tenant, p_strain_id, 0);
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

  update stock_general set grams = v_new, updated_at = now()
    where tenant_id = v_tenant and strain_id = p_strain_id;

  insert into stock_movements (tenant_id, strain_id, type, quantity, note, created_by)
    values (v_tenant, p_strain_id, 'ajuste', v_new - v_current, p_note, auth.uid());
end;
$$;
