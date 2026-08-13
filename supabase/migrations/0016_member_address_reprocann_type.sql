-- Direccion completa (antes solo existia 'zona', un campo corto) y tipo
-- de reprocann (autocultivador vs paciente), separado del estado
-- (vigente/tramite/no) que ya vivia en la columna 'reprocann'.

alter table members add column address text;

create type reprocann_type as enum ('autocultivador', 'paciente');
alter table members add column reprocann_type reprocann_type;
