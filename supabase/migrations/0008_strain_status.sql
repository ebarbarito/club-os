-- Reemplaza el boolean `active` por un estado de 3 valores: el admin
-- necesita poder marcar una genética como "sin stock" (pausada, aunque
-- técnicamente haya gramos cargados) sin tener que ocultarla del todo.
create type strain_status as enum ('activa', 'sin_stock', 'inactiva');

alter table strains add column status strain_status not null default 'activa';
update strains set status = case when active then 'activa'::strain_status else 'inactiva'::strain_status end;
alter table strains drop column active;
