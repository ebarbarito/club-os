import type { createClient } from '@/lib/supabase/server';
import { calcularSueldo, periodoDe, type EstadoSueldo } from './sueldo';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RetiroDetalle = {
  id: string;
  fecha: string;
  concepto: string;
  cuenta: string | null;
  monto: number; // positivo = retiro (egreso); negativo = devolución (ingreso)
};

// Estado de la cuenta de sueldo de uno o varios empleados (servidor).
export async function estadosDeSueldo(
  supabase: Supabase,
  employeeIds?: string[],
): Promise<Map<string, { estado: EstadoSueldo; retiros: RetiroDetalle[] }>> {
  let qEmp = supabase.from('employees').select('id, salary');
  let qLed = supabase
    .from('ledger')
    .select('id, created_at, type, concept, amount_local, employee_id, account:payment_accounts(name)')
    .not('employee_id', 'is', null)
    // Lo anulado no cuenta (ni el original ni su contrapartida).
    .or('anulado.is.null,anulado.eq.false')
    .neq('category', 'Anulación')
    .order('created_at', { ascending: true });
  let qSal = supabase.from('employee_salaries').select('employee_id, periodo, amount');
  if (employeeIds) {
    qEmp = qEmp.in('id', employeeIds);
    qLed = qLed.in('employee_id', employeeIds);
    qSal = qSal.in('employee_id', employeeIds);
  }
  const [{ data: emps }, { data: led }, { data: sals }] = await Promise.all([qEmp, qLed, qSal]);

  const sueldoMes = new Map<string, number>(); // `${emp}|YYYY-MM`
  for (const s of (sals ?? []) as { employee_id: string; periodo: string; amount: number }[]) {
    sueldoMes.set(`${s.employee_id}|${String(s.periodo).slice(0, 7)}`, Number(s.amount) || 0);
  }

  const out = new Map<string, { estado: EstadoSueldo; retiros: RetiroDetalle[] }>();
  for (const e of (emps ?? []) as { id: string; salary: number }[]) {
    const retiros: RetiroDetalle[] = ((led ?? []) as unknown as {
      id: string;
      created_at: string;
      type: string;
      concept: string;
      amount_local: number;
      employee_id: string;
      account: { name: string } | { name: string }[] | null;
    }[])
      .filter((l) => l.employee_id === e.id)
      .map((l) => {
        const cuenta = Array.isArray(l.account) ? l.account[0] : l.account;
        const monto = Number(l.amount_local) || 0;
        return {
          id: l.id,
          fecha: l.created_at,
          concepto: l.concept,
          cuenta: cuenta?.name ?? null,
          monto: l.type === 'ingreso' ? -monto : monto,
        };
      });
    const base = Number(e.salary) || 0;
    const estado = calcularSueldo(
      retiros.map((r) => ({ fecha: r.fecha, monto: r.monto })),
      (p) => sueldoMes.get(`${e.id}|${p}`) ?? base,
    );
    out.set(e.id, { estado, retiros });
  }
  return out;
}

export { periodoDe };
