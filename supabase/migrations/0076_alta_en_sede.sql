-- Alta en la sede: una tablet logueada con un usuario general (perfil
-- "sede") donde el interesado completa todo el alta en el momento, asistido
-- por alguien del equipo.
--
-- - Con REPROCANN vigente queda validado en el momento.
-- - Sin REPROCANN completa todo igual, queda "en evaluación" y derivado a
--   Clinicann (derivado_clinicann_at) hasta que tenga la credencial.

alter type user_role add value if not exists 'sede';

alter table members
  add column if not exists alta_canal text,
  add column if not exists alta_asistida_por text,
  add column if not exists derivado_clinicann_at timestamptz;

comment on column members.alta_canal is 'Por dónde se dio de alta: web (pre-inscripción + 2ª parte) o sede (tablet)';
comment on column members.alta_asistida_por is 'Quién del equipo asistió el alta en la sede';
comment on column members.derivado_clinicann_at is 'Sin REPROCANN: derivado a Clinicann para el trámite';
