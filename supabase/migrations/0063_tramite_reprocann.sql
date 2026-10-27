-- Pre-inscripción sin REPROCANN (en trámite / no tengo): cómo lo va a
-- tramitar el socio.
--   'propio'      → lo tramita por su cuenta (se le muestran los requisitos)
--   'acompanado'  → quiere que lo acompañemos: lo contacta Clinicann
-- Null cuando ya tiene REPROCANN vigente.
alter table members add column tramite_reprocann text
  check (tramite_reprocann in ('propio', 'acompanado'));
