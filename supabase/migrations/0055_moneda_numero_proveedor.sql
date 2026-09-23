-- ============================================================
-- 0055: moneda en comprobantes + número correlativo en proveedores
-- ============================================================

-- 1. Moneda y tipo de cambio en comprobantes de proveedores
ALTER TABLE proveedor_comprobantes
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS tipo_cambio numeric NOT NULL DEFAULT 1;

-- 2. Número correlativo en proveedores
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS numero integer;

-- Backfill: asignar número correlativo por tenant ordenado por created_at
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) AS n
  FROM proveedores
)
UPDATE proveedores p
SET numero = r.n
FROM ranked r
WHERE p.id = r.id AND p.numero IS NULL;
