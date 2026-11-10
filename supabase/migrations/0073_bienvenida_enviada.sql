-- Alertas de acciones pendientes del club en el ida y vuelta del alta.
-- Para saber si falta mandar la bienvenida, se registra cuándo se envió (o
-- copió) ese mensaje desde la ficha. Los socios que ya estaban validados
-- quedan como con la bienvenida enviada, para que no aparezcan alertas viejas.
alter table members add column if not exists bienvenida_enviada_at timestamptz;
update members set bienvenida_enviada_at = now()
  where status = 'valid' and etapa2_completada_at is not null and bienvenida_enviada_at is null;
