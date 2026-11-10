-- Médico tratante del club: se precarga en la segunda parte del alta. Si el
-- socio viene con REPROCANN de otro médico, reemplaza los datos en el
-- formulario. Se edita en Configuración.
alter table tenants add column if not exists medico_por_defecto jsonb not null default '{}'::jsonb;

update tenants set medico_por_defecto = jsonb_build_object(
  'doctor', 'Wiliam',
  'matricula', '180440',
  'especialidad_institucion', 'Médico / Clinicann',
  'producto_prescripto', 'Flores'
) where slug = 'greenlevel';
