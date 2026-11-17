-- Pedidos hechos por el socio en la tablet de la sede: quedan como pedido
-- "reservado" para que el operador lo prepare y lo entregue desde Dispensa.
alter table orders
  add column if not exists canal text,
  add column if not exists nota text;

comment on column orders.canal is 'Origen del pedido: web (sitio) o tablet (sede)';
comment on column orders.nota is 'Comentario del socio para el pedido';
