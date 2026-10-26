-- Alta de socio en dos etapas (circuito real de Green Level, ver
-- "Propuesta para pacientes"):
--
--   Etapa 1 — Pre-inscripción (link público /alta-socio, se manda por
--   WhatsApp en la consulta inicial): datos personales, categoría y
--   REPROCANN propio. Si todavía no tiene REPROCANN (en trámite o sin
--   REPROCANN) queda asentado en `reprocann` y se completa en la etapa 2.
--   El socio queda en estado 'preinscripto'.
--
--   El club revisa los datos y, cuando el socio ya tiene su indicación
--   médica, le manda desde la ficha el link PERSONAL de la etapa 2.
--
--   Etapa 2 — Formulario de adhesión (/alta-socio/completar/<token>):
--   datos médicos, REPROCANN pendiente, plan elegido, retiro/envío,
--   documentación, consentimientos y firma. Al enviarlo pasa a 'pending'
--   (En evaluación) como cualquier alta, y el club valida.

-- Nuevo estado antes de 'pending'. ADD VALUE no puede usarse en la misma
-- transacción en la que se agrega, por eso esta migración no lo usa.
alter type member_status add value if not exists 'preinscripto' before 'pending';

-- Link personal de la etapa 2. Se genera recién cuando el club lo envía
-- (no al pre-inscribirse) y se borra cuando el socio completa la etapa 2,
-- así un link viejo no sirve para volver a pisar los datos.
alter table members add column etapa2_token text unique;
alter table members add column etapa2_enviada_at timestamptz;
alter table members add column etapa2_completada_at timestamptz;

-- Lo que el socio elige en la etapa 2. Es lo SOLICITADO por el socio:
-- el servicio pactado y la cuota social (0035) los sigue cargando el club
-- al validar, porque dependen de la indicación médica.
alter table members add column plan_solicitado text;
alter table members add column adicionales_solicitados text[] not null default '{}';
alter table members add column entrega_preferida text
  check (entrega_preferida in ('retiro', 'envio', 'interior'));
