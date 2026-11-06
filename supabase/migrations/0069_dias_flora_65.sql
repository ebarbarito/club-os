-- Los lotes nuevos arrancan con 65 días de flora estimados (como trabaja el
-- club). El día de ingreso cuenta como día 0.
alter table lotes alter column dias_flora set default 65;
