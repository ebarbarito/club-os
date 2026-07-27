-- Una sala puede tener varias genéticas en simultáneo, cada una con su
-- propia cantidad de plantas — reemplaza el strain_id/plants únicos de
-- `salas`. Esta es también la fuente que precarga "Cerrar ciclo".
create table sala_strains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sala_id uuid not null references salas(id) on delete cascade,
  strain_id uuid not null references strains(id),
  plants int not null default 0,
  unique (sala_id, strain_id)
);

alter table sala_strains enable row level security;
create policy sala_strains_tenant on sala_strains for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

insert into sala_strains (tenant_id, sala_id, strain_id, plants)
  select tenant_id, id, strain_id, coalesce(plants, 0) from salas where strain_id is not null;

alter table salas drop column strain_id;
alter table salas drop column plants;
