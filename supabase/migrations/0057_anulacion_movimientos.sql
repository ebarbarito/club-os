-- ============================================================
-- 0057: Sistema de anulación de movimientos
--
-- 1. Columna `anulado` en ledger — marca una fila como revertida
--    contablemente (la contrapartida ya fue insertada con
--    category = 'Anulación'). La fila original queda en la tabla
--    para trazabilidad pero se filtra en la UI.
--
-- 2. Columna `receipt_number` en proveedor_pagos — almacena el
--    número de recibo que vincula las filas de ledger generadas
--    al registrar el pago, de modo que la anulación pueda
--    encontrarlas sin búsqueda heurística.
--
-- 3. Exclusión de 'Anulación' del trigger de impuestos automáticos
--    (las contrapartidas no deben generar nuevas filas de impuesto).
-- ============================================================

-- 1. Marcar filas anuladas en ledger
alter table ledger
  add column if not exists anulado boolean not null default false;

-- 2. Vincular pago de proveedor con sus filas de ledger
alter table proveedor_pagos
  add column if not exists receipt_number integer;

-- 3. Recrear trigger excluyendo 'Anulación'
CREATE OR REPLACE FUNCTION apply_account_taxes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  IF NEW.category IN (
    'Cierre de caja',
    'Envío a caja diaria',
    'Impuesto',
    'Compra/Venta USD',
    'Anulación'
  ) THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT rate FROM account_taxes
    WHERE account_id = NEW.account_id
      AND tenant_id  = NEW.tenant_id
  LOOP
    INSERT INTO ledger (
      tenant_id, shift_id, type, category, concept,
      amount, exchange_rate, amount_local, account_id
    ) VALUES (
      NEW.tenant_id,
      NEW.shift_id,
      'egreso',
      'Impuesto',
      'Impuesto sobre ' || NEW.concept,
      NEW.amount       * r.rate,
      NEW.exchange_rate,
      NEW.amount_local * r.rate,
      NEW.account_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;
