-- Catálogo de artículos para compras a proveedores
create table proveedor_articulos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  code text,
  description text not null,
  unit text,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index proveedor_articulos_tenant_idx on proveedor_articulos(tenant_id);

alter table proveedor_articulos enable row level security;
create policy proveedor_articulos_tenant on proveedor_articulos for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Tipo de comprobante
create type proveedor_comprobante_tipo as enum ('factura', 'nota_credito');

-- Cabecera de comprobante (factura o nota de crédito)
create table proveedor_comprobantes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  tipo proveedor_comprobante_tipo not null,
  fecha date not null,
  punto_venta text not null default '0001',
  numero text not null,
  subtotal numeric not null default 0,      -- suma de renglones sin impuestos
  iva numeric not null default 0,
  iva_adicional numeric not null default 0,
  otros_impuestos numeric not null default 0,
  total numeric not null,                   -- subtotal + impuestos
  saldo numeric not null,                   -- factura: +total | nota_credito: −total
  notas text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index proveedor_comprobantes_proveedor_idx on proveedor_comprobantes(proveedor_id);
create index proveedor_comprobantes_tenant_idx on proveedor_comprobantes(tenant_id, fecha);

alter table proveedor_comprobantes enable row level security;
create policy proveedor_comprobantes_tenant on proveedor_comprobantes for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Renglones de comprobante
create table proveedor_comprobante_items (
  id uuid primary key default gen_random_uuid(),
  comprobante_id uuid not null references proveedor_comprobantes(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  articulo_id uuid references proveedor_articulos(id),
  descripcion text not null,
  cantidad numeric not null default 1,
  precio_unitario numeric not null default 0,
  descuento numeric not null default 0,     -- porcentaje
  total numeric not null,                   -- cantidad * precio * (1 - descuento/100)
  orden int not null default 0
);

create index proveedor_comprobante_items_comp_idx on proveedor_comprobante_items(comprobante_id);

alter table proveedor_comprobante_items enable row level security;
create policy proveedor_comprobante_items_tenant on proveedor_comprobante_items for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
