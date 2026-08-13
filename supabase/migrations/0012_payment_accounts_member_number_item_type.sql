-- Cuentas de pago configurables por club (Efectivo, US$, bancos, MP...) —
-- reemplaza el enum fijo payment_method en dispensas/caja. `is_cash` marca
-- qué cuentas cuentan como efectivo físico para el arqueo de Caja.
create table payment_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  currency text not null default 'ARS',
  exchange_rate numeric not null default 1,
  is_cash boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table payment_accounts enable row level security;
create policy payment_accounts_tenant on payment_accounts for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

insert into payment_accounts (tenant_id, name, currency, exchange_rate, is_cash)
  select id, 'Efectivo', 'ARS', 1, true from tenants
  union all
  select id, 'Transferencia', 'ARS', 1, false from tenants;

-- N° de socio: correlativo por club, asignado automáticamente al crear.
alter table members add column member_number integer;

create function assign_member_number() returns trigger
language plpgsql as $$
begin
  if new.member_number is null then
    select coalesce(max(member_number), 0) + 1 into new.member_number
      from members where tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger members_assign_number before insert on members
  for each row execute function assign_member_number();

with numbered as (
  select id, row_number() over (partition by tenant_id order by alta_date) as rn
  from members
)
update members set member_number = numbered.rn
from numbered where members.id = numbered.id;

alter table members alter column member_number set not null;
alter table members add constraint members_tenant_number_key unique (tenant_id, member_number);

-- Catálogo unificado "Artículos": strains pasa a incluir accesorios
-- (encendedores, papeles...) además de genéticas. Los campos de ficha
-- técnica de cannabis (type/thc/cbd/cross_info/etc.) solo aplican cuando
-- item_type = 'genetica' — la UI los oculta para 'accesorio'.
create type item_type as enum ('genetica', 'accesorio');
alter table strains add column item_type item_type not null default 'genetica';
alter table strains add column code text;
alter table strains alter column type drop not null;

create unique index strains_tenant_code_key on strains (tenant_id, code) where code is not null;
