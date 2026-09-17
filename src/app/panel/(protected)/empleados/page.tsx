import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { Badge } from '@/components/badge';
import { money } from '@/lib/format';
import { EmployeeForm } from './employee-form';
import { SalaryPaymentForm } from './salary-payment-form';

export default async function EmpleadosPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();

  const now = new Date();
  const periodo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .split('T')[0]; // '2026-09-01'

  const [{ data: employees }, { data: salaryRows }, { data: accountRows }] = await Promise.all([
    supabase.from('employees').select('*').order('name'),
    supabase.from('employee_salaries').select('id, employee_id, amount, paid_amount').eq('periodo', periodo),
    supabase.from('payment_accounts').select('id, name, is_cash, currency, exchange_rate').eq('active', true).order('name'),
  ]);

  const salariesByEmployee = new Map((salaryRows ?? []).map((s) => [s.employee_id, s]));
  const accounts = accountRows ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Empleados</h1>
          <p className="text-text-soft">Cuenta corriente de sueldos — solo administrador</p>
        </div>
        <ModalTrigger label="+ Nueva alta" title="Alta de empleado">
          <EmployeeForm />
        </ModalTrigger>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="px-4 py-2.5 font-medium">DNI</th>
              <th className="px-4 py-2.5 font-medium">Remuneración</th>
              <th className="px-4 py-2.5 font-medium">Sueldo del mes</th>
              <th className="px-4 py-2.5 font-medium">Pagado</th>
              <th className="px-4 py-2.5 font-medium">Pendiente</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(employees ?? []).map((e) => {
              const salaryRecord = salariesByEmployee.get(e.id) ?? null;
              const monthAmount = salaryRecord ? salaryRecord.amount : e.salary;
              const paidAmount = salaryRecord?.paid_amount ?? 0;
              const pendingAmount = monthAmount - paidAmount;
              const fullyPaid = pendingAmount <= 0.01;

              return (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium text-text">
                    {e.name} {e.last_name}
                  </td>
                  <td className="px-4 py-2.5 text-text-soft">{e.dni}</td>
                  <td className="px-4 py-2.5 text-text-soft">{money(e.salary)}</td>
                  <td className="px-4 py-2.5 text-text-soft">
                    {salaryRecord ? money(salaryRecord.amount) : <span className="text-text-mute">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-text-soft">
                    {paidAmount > 0 ? money(paidAmount) : <span className="text-text-mute">—</span>}
                  </td>
                  <td className={`px-4 py-2.5 font-medium ${fullyPaid ? 'text-text-mute' : 'text-red'}`}>
                    {fullyPaid ? (
                      <span className="text-green text-xs font-semibold">Pagado ✓</span>
                    ) : (
                      money(pendingAmount)
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge label={e.active ? 'Activo' : 'Inactivo'} color={e.active ? 'green' : 'gray'} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2 justify-end">
                      {e.active && !fullyPaid && (
                        <ModalTrigger
                          label="Pagar"
                          className="rounded-lg bg-accent text-white text-xs font-semibold px-3 py-1.5"
                          title={`Pago de sueldo — ${e.name} ${e.last_name}`}
                        >
                          <SalaryPaymentForm
                            employeeId={e.id}
                            employeeName={`${e.name} ${e.last_name}`}
                            baseSalary={e.salary}
                            salary={salaryRecord ? { id: salaryRecord.id, amount: salaryRecord.amount, paid_amount: salaryRecord.paid_amount } : null}
                            accounts={accounts}
                          />
                        </ModalTrigger>
                      )}
                      <ModalTrigger
                        label="Editar"
                        className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                        title={`Editar — ${e.name} ${e.last_name}`}
                      >
                        <EmployeeForm employee={e} />
                      </ModalTrigger>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(employees ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-mute">
                  Sin empleados cargados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
