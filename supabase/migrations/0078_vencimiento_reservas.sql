-- Las reservas (tablet de la sede y sitio de socios) valen 24 horas.
-- Pasado ese plazo sin entregarse, se cancelan solas y lo pedido vuelve a
-- estar disponible (los pedidos no descuentan stock: solo lo comprometen).
-- No vencen los que ya salieron con envío ("enviando").

alter table orders add column if not exists vencida_at timestamptz;

create or replace function vencer_reservas()
returns int
language sql
security definer
set search_path = public
as $$
  with vencidas as (
    update orders
       set status = 'cancelado', vencida_at = now()
     where status in ('reservado', 'preparacion', 'listo')
       and created_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::int from vencidas;
$$;

revoke all on function vencer_reservas() from public, anon, authenticated;

-- Corre cada 15 minutos (además, el sistema la llama al abrir pedidos y catálogo).
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'vencer-reservas';
select cron.schedule('vencer-reservas', '*/15 * * * *', 'select public.vencer_reservas()');

select vencer_reservas() as vencidas_ahora;
