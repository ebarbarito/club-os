// Un solo recibo por operación: si una dispensa/cobro/movimiento se pagó
// dividido en varias cuentas, todas esas filas de ledger comparten
// receipt_number y tienen que verse como UN renglón en Caja, no varios.
// Las filas sin receipt_number (ej. los depósitos "Cierre de caja", que
// se agrupan por source_shift_id en otro lado) quedan cada una en su
// propio grupo.
export type GroupableLedgerRow = {
  id: string;
  receipt_number: number | null;
  account_id: string;
  type: 'ingreso' | 'egreso';
  amount: number;
  amount_local: number;
  created_at: string;
};

export type ReceiptGroup<T extends GroupableLedgerRow> = {
  key: string;
  rows: T[];
  byAccountLocal: Map<string, number>;
  byAccountAmount: Map<string, number>;
  created_at: string;
};

export function groupByReceipt<T extends GroupableLedgerRow>(rows: T[]): ReceiptGroup<T>[] {
  const groups = new Map<string, ReceiptGroup<T>>();
  for (const row of rows) {
    const key = row.receipt_number != null ? `r${row.receipt_number}` : row.id;
    const signedLocal = row.type === 'ingreso' ? row.amount_local : -row.amount_local;
    const signedAmount = row.type === 'ingreso' ? row.amount : -row.amount;
    let group = groups.get(key);
    if (!group) {
      group = { key, rows: [], byAccountLocal: new Map(), byAccountAmount: new Map(), created_at: row.created_at };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.byAccountLocal.set(row.account_id, (group.byAccountLocal.get(row.account_id) ?? 0) + signedLocal);
    group.byAccountAmount.set(row.account_id, (group.byAccountAmount.get(row.account_id) ?? 0) + signedAmount);
  }
  return [...groups.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
