-- Eliminar un socio no puede ser un delete real: hay dispensas/ordenes que
-- referencian members(id) sin cascada. Se marca como eliminado en vez de
-- borrarlo, y se filtra de las vistas.

alter table members add column deleted_at timestamptz;
alter table members add column deleted_by uuid references profiles(id);
