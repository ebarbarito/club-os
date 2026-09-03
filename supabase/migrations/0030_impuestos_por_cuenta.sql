-- Impuestos configurables por cuenta (Modificaciones 1/9/26): cada pago o
-- cobro real por una cuenta con impuestos cargados genera renglones de
-- egreso aparte por cada impuesto que corresponda, sin tocar lo que se le
-- cobra al socio (dispensa_payments/deuda siguen con el importe pleno) —
-- es puramente un ajuste contable del lado de la cuenta/caja.
create table account_taxes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id uuid not null references payment_accounts(id) on delete cascade,
  name text not null,
  pct numeric not null check (pct > 0),
  applies_to text not null check (applies_to in ('ingreso', 'egreso', 'ambos')),
  created_at timestamptz not null default now()
);

create index account_taxes_account_idx on account_taxes (account_id);

alter table account_taxes enable row level security;
create policy account_taxes_tenant on account_taxes for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Se excluyen los movimientos internos de caja (depositos de cierre,
-- envios entre cajas) y las filas de impuesto mismas (para no generar
-- impuesto sobre impuesto).
create function apply_account_taxes() returns trigger
language plpgsql as $$
declare
  v_tax record;
  v_tax_amount numeric;
begin
  if NEW.category in ('Cierre de caja', 'Envío a caja diaria', 'Impuesto') then
    return NEW;
  end if;

  for v_tax in
    select name, pct from account_taxes
    where tenant_id = NEW.tenant_id and account_id = NEW.account_id
      and applies_to in (NEW.type::text, 'ambos')
  loop
    v_tax_amount := NEW.amount * v_tax.pct / 100;
    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, dispensa_id)
      values (
        NEW.tenant_id, NEW.shift_id, 'egreso', 'Impuesto',
        v_tax.name || ' (' || v_tax.pct || '%) — ' || NEW.concept,
        v_tax_amount, NEW.exchange_rate, v_tax_amount * NEW.exchange_rate,
        NEW.account_id, NEW.dispensa_id
      );
  end loop;
  return NEW;
end;
$$;

create trigger ledger_apply_account_taxes
  after insert on ledger
  for each row execute function apply_account_taxes();
