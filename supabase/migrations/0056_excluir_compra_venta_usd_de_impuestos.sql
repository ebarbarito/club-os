-- ============================================================
-- 0056: Excluir operaciones "Compra/Venta USD" del trigger
--       de impuestos automáticos por cuenta
-- ============================================================

-- El trigger apply_account_taxes genera filas de impuesto automáticas
-- en cada insert de ledger, excepto para ciertas categorías.
-- Las operaciones de compra/venta de divisas no deben generar impuesto.

CREATE OR REPLACE FUNCTION apply_account_taxes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  -- Categorías que no generan impuesto automático
  IF NEW.category IN (
    'Cierre de caja',
    'Envío a caja diaria',
    'Impuesto',
    'Compra/Venta USD'
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
