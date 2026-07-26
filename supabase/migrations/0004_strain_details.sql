-- Datos de ficha técnica de genética (cruza, composición legible, aroma,
-- efectos, notas de cultivo) — el catálogo público los muestra tal cual
-- vienen de la ficha del criador. Nullable: no todas las genéticas van a
-- tener esta info cargada (ej. altas rápidas desde Stock).
alter table strains
  add column cross_info text,
  add column composition text,
  add column aroma text,
  add column effects text,
  add column notes text;
