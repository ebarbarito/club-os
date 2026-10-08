-- ============================================================
-- 0058: Corregir función apply_account_taxes
--
-- Problema: las migraciones 0056 y 0057 recrearon apply_account_taxes()
-- usando `SELECT rate FROM account_taxes`, pero la tabla fue creada en
-- 0030 con la columna `pct` (no `rate`). Si account_taxes tiene filas
-- para una cuenta, cualquier INSERT en ledger para esa cuenta fallaba
-- con "column rate does not exist", causando que los pagos en divisas
-- no se registraran ni en caja ni en la cuenta de dólares.
--
-- Fix:
--   1. Usa `pct / 100` en lugar de `rate` (consistente con migration 0030
--      y con el frontend que guarda el valor como porcentaje entero, ej. 21).
--   2. Restaura el filtro `applies_to` que 0056 eliminó por error.
--   3. Mantiene la exclusión de 'Anulación' introducida en 0057.
-- ============================================================

CREATE OR REPLACE FUNCTION apply_account_taxes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  -- Categorías internas que no generan impuesto automático
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
    SELECT name, pct
    FROM account_taxes
    WHERE account_id  = NEW.account_id
      AND tenant_id   = NEW.tenant_id
      AND applies_to IN (NEW.type::text, 'ambos')
  LOOP
    INSERT INTO ledger (
      tenant_id, shift_id, type, category, concept,
      amount, exchange_rate, amount_local, account_id
    ) VALUES (
      NEW.tenant_id,
      NEW.shift_id,
      'egreso',
      'Impuesto',
      r.name || ' (' || r.pct || '%) — ' || NEW.concept,
      NEW.amount       * r.pct / 100,
      NEW.exchange_rate,
      NEW.amount_local * r.pct / 100,
      NEW.account_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;
