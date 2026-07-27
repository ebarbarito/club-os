-- Forma de pago elegida por el socio al reservar (público). Nullable:
-- pedidos viejos no la tienen. Se puede confirmar/corregir al marcar
-- "entregado" por si cambió entre la reserva y la entrega.
alter table orders add column method payment_method;
