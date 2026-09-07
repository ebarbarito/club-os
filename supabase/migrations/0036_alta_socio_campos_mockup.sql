-- Campos nuevos del mockup "Alta de Socios" (Green Level), comparado
-- contra el alta actual (pública y privada). Queda afuera todo lo de la
-- sección 3 del mockup (no vista) y los datos de tutor/representante
-- legal para socios menores -- se agrega cuando llegue esa parte.
--
-- `modalidad` (cultivo propio/solidario/ONG) se deja intacta: es otra
-- dimensión, no la reemplaza nada de esto.
--
-- `categoria_socio` es NUEVO -- no se fusiona con `modalidad` ni con
-- `reprocann_type` todavía; conviven hasta resolver con el club real si
-- categoria_socio los reemplaza o los complementa.
--
-- "Dosis mensual indicada" del mockup se guarda aparte de
-- servicio_pactado_cantidad (cuota social): una es un dato médico
-- (prescripción), la otra es el valor comercial pactado para la cuota.
-- Pueden coincidir en la práctica pero no son el mismo campo.
alter table members add column nacionalidad text;
alter table members add column estado_civil text;
alter table members add column cuil_cuit text;
alter table members add column localidad text;
alter table members add column provincia text;
alter table members add column codigo_postal text;

alter table members add column categoria_socio text
  check (categoria_socio in ('activo', 'autocultivador', 'adherente_menor', 'adherente'));

alter table members add column especialidad_institucion text;
alter table members add column producto_prescripto text;
alter table members add column dosis_mensual numeric;
alter table members add column dosis_unidad text check (dosis_unidad in ('g', 'ml'));

-- Los 3 checks de la sección "Declaración y consentimiento" del mockup
-- (hoy el alta pública solo tenía un único check genérico).
alter table members add column consiente_estatuto boolean not null default false;
alter table members add column consiente_datos boolean not null default false;
alter table members add column consiente_veracidad boolean not null default false;

-- La firma se guarda como un documento más (mismo bucket/tabla que
-- DNI/REPROCANN) en vez de una columna nueva -- reutiliza la infraestructura
-- de signed URLs ya existente en la ficha del socio.
