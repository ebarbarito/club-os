-- Proveedores: gestión de proveedores con cuenta corriente (deudas + pagos).
-- Los pagos generan un egreso en el ledger vinculado a la cuenta de pago.

create table proveedores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  cuit text,
  contact_name text,
  phone text,
  email text,
  address text,
  rubro text,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index proveedores_tenant_idx on proveedores(tenant_id);

alter table proveedores enable row level security;
create policy proveedores_tenant on proveedores for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create type proveedor_mov_type as enum ('deuda', 'pago');

create table proveedor_movimientos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  type proveedor_mov_type not null,
  amount numeric not null,
  description text not null,
  date date not null default current_date,
  account_id uuid references payment_accounts(id), -- solo para pagos
  exchange_rate numeric not null default 1,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index proveedor_movimientos_proveedor_idx on proveedor_movimientos(proveedor_id);
create index proveedor_movimientos_tenant_idx on proveedor_movimientos(tenant_id, created_at);

alter table proveedor_movimientos enable row level security;
create policy proveedor_movimientos_tenant on proveedor_movimientos for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
