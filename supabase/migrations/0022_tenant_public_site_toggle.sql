-- El sitio publico de un club (catalogo/reservas/alta) arranca OFF por
-- default para todos los clubes existentes y nuevos — nadie lo ve hasta
-- que el propio admin del club lo prenda desde el panel.
alter table tenants add column public_site_enabled boolean not null default false;
