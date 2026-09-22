-- Agrega el flag cuota_social_bonificada al padrón de socios.
-- Cuando está en true, al generar las cuotas del mes el sistema:
--   • Inserta la dispensa con amount = 0 (sin deuda para el socio).
--   • Acredita el importe original como member_credits(kind='cuota_social')
--     para que el socio pueda retirar producto igualmente.

alter table members
  add column if not exists cuota_social_bonificada boolean not null default false;
