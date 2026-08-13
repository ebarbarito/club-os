-- dispensa_payments y ledger dejan de usar el enum fijo payment_method y
-- pasan a referenciar payment_accounts — cada línea de pago lleva cuenta,
-- cotización usada, y el monto ya convertido a moneda local (pesos).
alter table dispensa_payments add column account_id uuid references payment_accounts(id);
alter table dispensa_payments add column exchange_rate numeric not null default 1;
alter table dispensa_payments add column amount_local numeric;

update dispensa_payments dp
  set account_id = pa.id, amount_local = dp.amount
  from payment_accounts pa
  where pa.tenant_id = dp.tenant_id
    and pa.name = (case dp.method when 'efectivo' then 'Efectivo' else 'Transferencia' end);

alter table dispensa_payments alter column account_id set not null;
alter table dispensa_payments alter column amount_local set not null;
alter table dispensa_payments drop column method;

alter table ledger add column account_id uuid references payment_accounts(id);
alter table ledger add column exchange_rate numeric not null default 1;
alter table ledger add column amount_local numeric;

update ledger l
  set account_id = pa.id, amount_local = l.amount
  from payment_accounts pa
  where pa.tenant_id = l.tenant_id
    and pa.name = (case l.method when 'efectivo' then 'Efectivo' else 'Transferencia' end);

alter table ledger alter column account_id set not null;
alter table ledger alter column amount_local set not null;
alter table ledger drop column method;
