-- Copia toda la data operativa del tenant Green Level al tenant Test,
-- reemplazando lo que hoy hay en Test. No es una migracion de esquema;
-- es una carga de datos puntual (pedida para que Test refleje produccion).
--
-- No se copian `profiles` (usuarios/login). Las columnas que referencian
-- profiles (registered_by, voided_by, opened_by, closed_by, created_by,
-- deleted_by, audit_log.user_id) quedan en NULL en la copia.
--
-- IDs se regeneran (gen_random_uuid()) y todas las FK internas se remapean
-- via tablas temporales id->id. receipt_counters se sincroniza aparte
-- (su PK es tenant_id, no tiene fila propia para clonar).

begin;

\set gl 'c4f3abf7-cdc5-4071-8823-5e11ace67730'
\set test '9204df5e-a559-40bc-8bac-17f0e3893852'

-- 1) Borrar todo lo que hoy tiene el tenant Test (hijos antes que padres)
delete from audit_log where tenant_id = :'test';
delete from ledger where tenant_id = :'test';
delete from dispensa_payments where tenant_id = :'test';
delete from dispensa_items where tenant_id = :'test';
delete from order_items where tenant_id = :'test';
delete from stock_movements where tenant_id = :'test';
delete from member_documents where tenant_id = :'test';
delete from member_credits where tenant_id = :'test';
delete from ciclo_items where tenant_id = :'test';
delete from sala_strains where tenant_id = :'test';
delete from account_taxes where tenant_id = :'test';
delete from caja_shifts where tenant_id = :'test';
delete from dispensas where tenant_id = :'test';
delete from orders where tenant_id = :'test';
delete from ciclos where tenant_id = :'test';
delete from stock where tenant_id = :'test';
delete from stock_general where tenant_id = :'test';
delete from employees where tenant_id = :'test';
delete from members where tenant_id = :'test';
delete from salas where tenant_id = :'test';
delete from strains where tenant_id = :'test';
delete from payment_accounts where tenant_id = :'test';

-- 2) Mapeos de id viejo (GL) -> id nuevo (Test), para las tablas
--    referenciadas por FK desde otras tablas.
create temp table map_payment_accounts as
  select id as old_id, gen_random_uuid() as new_id from payment_accounts where tenant_id = :'gl';
create temp table map_strains as
  select id as old_id, gen_random_uuid() as new_id from strains where tenant_id = :'gl';
create temp table map_salas as
  select id as old_id, gen_random_uuid() as new_id from salas where tenant_id = :'gl';
create temp table map_employees as
  select id as old_id, gen_random_uuid() as new_id from employees where tenant_id = :'gl';
create temp table map_members as
  select id as old_id, gen_random_uuid() as new_id from members where tenant_id = :'gl';
create temp table map_orders as
  select id as old_id, gen_random_uuid() as new_id from orders where tenant_id = :'gl';
create temp table map_ciclos as
  select id as old_id, gen_random_uuid() as new_id from ciclos where tenant_id = :'gl';
create temp table map_dispensas as
  select id as old_id, gen_random_uuid() as new_id from dispensas where tenant_id = :'gl';
create temp table map_caja_shifts as
  select id as old_id, gen_random_uuid() as new_id from caja_shifts where tenant_id = :'gl';

-- 3) Copiar tablas padre primero, hijas despues.

insert into payment_accounts (id, tenant_id, name, currency, exchange_rate, is_cash, active, created_at)
select m.new_id, :'test', p.name, p.currency, p.exchange_rate, p.is_cash, p.active, p.created_at
from payment_accounts p join map_payment_accounts m on m.old_id = p.id
where p.tenant_id = :'gl';

insert into strains (id, tenant_id, name, type, thc, cbd, price_per_gram, created_at, cross_info, composition, aroma, effects, notes, images, description, status, item_type, code)
select m.new_id, :'test', s.name, s.type, s.thc, s.cbd, s.price_per_gram, s.created_at, s.cross_info, s.composition, s.aroma, s.effects, s.notes, s.images, s.description, s.status, s.item_type, s.code
from strains s join map_strains m on m.old_id = s.id
where s.tenant_id = :'gl';

insert into salas (id, tenant_id, name, etapa, etapa_dias, capacity, cosecha_estimada, responsable, temp_min, temp_max, hum_min, hum_max, sensor_id, created_at)
select m.new_id, :'test', s.name, s.etapa, s.etapa_dias, s.capacity, s.cosecha_estimada, s.responsable, s.temp_min, s.temp_max, s.hum_min, s.hum_max, s.sensor_id, s.created_at
from salas s join map_salas m on m.old_id = s.id
where s.tenant_id = :'gl';

insert into employees (id, tenant_id, name, last_name, dni, salary, active, created_at)
select m.new_id, :'test', e.name, e.last_name, e.dni, e.salary, e.active, e.created_at
from employees e join map_employees m on m.old_id = e.id
where e.tenant_id = :'gl';

insert into members (id, tenant_id, name, dni, birth, phone, email, zona, reprocann, repr_num, repr_exp, doctor, matricula, modalidad, patologia, status, alta_date, created_at, member_number, address, reprocann_type, deleted_at, deleted_by)
select m.new_id, :'test', mm.name, mm.dni, mm.birth, mm.phone, mm.email, mm.zona, mm.reprocann, mm.repr_num, mm.repr_exp, mm.doctor, mm.matricula, mm.modalidad, mm.patologia, mm.status, mm.alta_date, mm.created_at, mm.member_number, mm.address, mm.reprocann_type, mm.deleted_at, null
from members mm join map_members m on m.old_id = mm.id
where mm.tenant_id = :'gl';

insert into orders (id, tenant_id, member_id, delivery, status, pickup_day, pickup_time, address, zona, created_at, method)
select mo.new_id, :'test', mm.new_id, o.delivery, o.status, o.pickup_day, o.pickup_time, o.address, o.zona, o.created_at, o.method
from orders o
  join map_orders mo on mo.old_id = o.id
  join map_members mm on mm.old_id = o.member_id
where o.tenant_id = :'gl';

insert into ciclos (id, tenant_id, sala_id, closed_at, closed_by)
select mc.new_id, :'test', ms.new_id, c.closed_at, null
from ciclos c
  join map_ciclos mc on mc.old_id = c.id
  join map_salas ms on ms.old_id = c.sala_id
where c.tenant_id = :'gl';

insert into stock (id, tenant_id, strain_id, grams, min_grams, updated_at)
select gen_random_uuid(), :'test', ms.new_id, s.grams, s.min_grams, s.updated_at
from stock s join map_strains ms on ms.old_id = s.strain_id
where s.tenant_id = :'gl';

insert into stock_general (id, tenant_id, strain_id, grams, updated_at)
select gen_random_uuid(), :'test', ms.new_id, s.grams, s.updated_at
from stock_general s join map_strains ms on ms.old_id = s.strain_id
where s.tenant_id = :'gl';

insert into sala_strains (id, tenant_id, sala_id, strain_id, plants)
select gen_random_uuid(), :'test', msa.new_id, mst.new_id, ss.plants
from sala_strains ss
  join map_salas msa on msa.old_id = ss.sala_id
  join map_strains mst on mst.old_id = ss.strain_id
where ss.tenant_id = :'gl';

insert into account_taxes (id, tenant_id, account_id, name, pct, applies_to, created_at)
select gen_random_uuid(), :'test', mp.new_id, a.name, a.pct, a.applies_to, a.created_at
from account_taxes a join map_payment_accounts mp on mp.old_id = a.account_id
where a.tenant_id = :'gl';

insert into caja_shifts (id, tenant_id, opened_by, opening_cash, opened_at, closed_at, counted_cash, difference, kind, opening_usd, counted_usd, leave_cash, leave_usd, difference_usd)
select mc.new_id, :'test', null, c.opening_cash, c.opened_at, c.closed_at, c.counted_cash, c.difference, c.kind, c.opening_usd, c.counted_usd, c.leave_cash, c.leave_usd, c.difference_usd
from caja_shifts c join map_caja_shifts mc on mc.old_id = c.id
where c.tenant_id = :'gl';

insert into dispensas (id, tenant_id, member_id, amount, registered_by, created_at, suggested_amount, voided_at, voided_by, void_reason, number, note)
select md.new_id, :'test', mm.new_id, d.amount, null, d.created_at, d.suggested_amount, d.voided_at, null, d.void_reason, d.number, d.note
from dispensas d
  join map_dispensas md on md.old_id = d.id
  join map_members mm on mm.old_id = d.member_id
where d.tenant_id = :'gl';

insert into order_items (id, tenant_id, order_id, strain_id, grams)
select gen_random_uuid(), :'test', mo.new_id, ms.new_id, oi.grams
from order_items oi
  join map_orders mo on mo.old_id = oi.order_id
  join map_strains ms on ms.old_id = oi.strain_id
where oi.tenant_id = :'gl';

insert into ciclo_items (id, tenant_id, ciclo_id, strain_id, grams)
select gen_random_uuid(), :'test', mc.new_id, ms.new_id, ci.grams
from ciclo_items ci
  join map_ciclos mc on mc.old_id = ci.ciclo_id
  join map_strains ms on ms.old_id = ci.strain_id
where ci.tenant_id = :'gl';

insert into dispensa_items (id, tenant_id, dispensa_id, strain_id, description, quantity, unit_price, bonif1_pct, bonif2_pct, total)
select gen_random_uuid(), :'test', md.new_id, ms.new_id, di.description, di.quantity, di.unit_price, di.bonif1_pct, di.bonif2_pct, di.total
from dispensa_items di
  join map_dispensas md on md.old_id = di.dispensa_id
  join map_strains ms on ms.old_id = di.strain_id
where di.tenant_id = :'gl';

insert into dispensa_payments (id, tenant_id, dispensa_id, amount, account_id, exchange_rate, amount_local, created_at, receipt_number)
select gen_random_uuid(), :'test', md.new_id, dp.amount, mp.new_id, dp.exchange_rate, dp.amount_local, dp.created_at, dp.receipt_number
from dispensa_payments dp
  join map_dispensas md on md.old_id = dp.dispensa_id
  join map_payment_accounts mp on mp.old_id = dp.account_id
where dp.tenant_id = :'gl';

-- El trigger ledger_apply_account_taxes generaria impuestos nuevos sobre
-- Test al reinsertar; se desactiva durante la copia porque los renglones
-- de impuesto de GL ya vienen incluidos en la data que estamos copiando.
alter table ledger disable trigger ledger_apply_account_taxes;

insert into ledger (id, tenant_id, shift_id, type, category, concept, amount, created_at, account_id, exchange_rate, amount_local, dispensa_id, source_shift_id, receipt_number, employee_id)
select
  gen_random_uuid(), :'test',
  mcs.new_id, l.type, l.category, l.concept, l.amount, l.created_at,
  mpa.new_id, l.exchange_rate, l.amount_local,
  md.new_id, mcs2.new_id, l.receipt_number, me.new_id
from ledger l
  left join map_caja_shifts mcs on mcs.old_id = l.shift_id
  left join map_payment_accounts mpa on mpa.old_id = l.account_id
  left join map_dispensas md on md.old_id = l.dispensa_id
  left join map_caja_shifts mcs2 on mcs2.old_id = l.source_shift_id
  left join map_employees me on me.old_id = l.employee_id
where l.tenant_id = :'gl';

alter table ledger enable trigger ledger_apply_account_taxes;

insert into member_credits (id, tenant_id, member_id, amount, description, receipt_number, created_by, created_at)
select gen_random_uuid(), :'test', mm.new_id, mc.amount, mc.description, mc.receipt_number, null, mc.created_at
from member_credits mc join map_members mm on mm.old_id = mc.member_id
where mc.tenant_id = :'gl';

insert into member_documents (id, tenant_id, member_id, storage_path, label, created_at)
select gen_random_uuid(), :'test', mm.new_id, d.storage_path, d.label, d.created_at
from member_documents d join map_members mm on mm.old_id = d.member_id
where d.tenant_id = :'gl';

insert into stock_movements (id, tenant_id, strain_id, type, quantity, note, created_by, created_at)
select gen_random_uuid(), :'test', ms.new_id, sm.type, sm.quantity, sm.note, null, sm.created_at
from stock_movements sm join map_strains ms on ms.old_id = sm.strain_id
where sm.tenant_id = :'gl';

insert into audit_log (id, tenant_id, created_at, user_id, entity_type, entity_id, change_type, description, reason)
select gen_random_uuid(), :'test', a.created_at, null, a.entity_type, a.entity_id, a.change_type, a.description, a.reason
from audit_log a
where a.tenant_id = :'gl';

-- receipt_counters: PK es tenant_id, no hay fila para clonar; solo se
-- sincroniza el proximo numero de comprobante con el de GL.
update receipt_counters
set next_value = (select next_value from receipt_counters where tenant_id = :'gl')
where tenant_id = :'test';

commit;
