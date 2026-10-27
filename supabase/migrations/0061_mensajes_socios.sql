-- Mensajes para socios (guía "Mensajes para socios · Green Level"):
-- los textos de la guía viven en el código (src/lib/alta/mensajes.ts) y se
-- completan solos con los datos del club y del socio.

-- Datos del club que la guía deja entre corchetes ([DIRECCIÓN],
-- [VALOR CONSULTA], etc.). Se cargan una vez en Configuración. jsonb para
-- poder sumar campos sin otra migración; las claves están tipadas en
-- DatosMensajes (mensajes.ts).
alter table tenants add column datos_mensajes jsonb not null default '{}'::jsonb;

-- Nombre de pila para el saludo de los mensajes ("¡Hola Juan!"). `name`
-- sigue siendo "Apellido y nombre" en un solo texto, y de ahí no se puede
-- sacar el nombre de forma confiable. La pre-inscripción ahora lo pide
-- aparte; para los socios viejos queda vacío (el saludo sale sin nombre) y
-- se puede completar desde "Editar".
alter table members add column nombre_pila text;
