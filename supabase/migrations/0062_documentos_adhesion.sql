-- Firma digital de la documentación en la segunda parte del alta: el
-- socio lee cada documento (scroll hasta el final), marca "Leí y acepto" y
-- firma.

-- Textos de los documentos a firmar (Formulario de Adhesión, Contrato de
-- Membresía, etc.), editables en Configuración. Lista ordenada de
-- {titulo, texto}. Vacía = se usan los textos por defecto del código
-- (src/lib/alta/documentos.ts).
alter table tenants add column documentos_adhesion jsonb not null default '[]'::jsonb;

-- Constancia de cada aceptación: se guarda el texto EXACTO que leyó el
-- socio (ya personalizado con su nombre/DNI/fecha), con fecha, IP y
-- navegador. Si después el club cambia el texto del contrato, lo firmado
-- por cada socio no cambia.
create table member_aceptaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  orden int not null,
  documento_titulo text not null,
  documento_texto text not null,
  aceptado_at timestamptz not null default now(),
  ip text,
  user_agent text
);

create index member_aceptaciones_member_idx on member_aceptaciones(member_id);

alter table member_aceptaciones enable row level security;

create policy member_aceptaciones_tenant on member_aceptaciones for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
