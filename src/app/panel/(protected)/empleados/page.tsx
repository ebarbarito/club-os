import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { Badge } from '@/components/badge';
import { money } from '@/lib/format';
import { EmployeeForm } from './employee-form';

export default async function EmpleadosPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();
  const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const [{ data: employees }, { data: advanceRows }] = await Promise.all([
    supabase.from('employees').select('*').order('name'),
    supabase.from('ledger').select('employee_id, amount_local').not('employee_id', 'is', null).gte('created_at', startOfMonth),
  ]);

  const advancesByEmployee = new Map<string, number>();
  for (const r of advanceRows ?? []) {
    advancesByEmployee.set(r.employee_id, (advancesByEmployee.get(r.employee_id) ?? 0) + r.amount_local);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Empleados</h1>
          <p className="text-text-soft">Remuneración pactada, adelantos y saldo disponible — solo administrador</p>
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
              <th className="px-4 py-2.5 font-medium">Remuneración pactada</th>
              <th className="px-4 py-2.5 font-medium">Adelantos este mes</th>
              <th className="px-4 py-2.5 font-medium">Saldo disponible</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(employees ?? []).map((e) => {
              const advanced = advancesByEmployee.get(e.id) ?? 0;
              const available = e.salary - advanced;
              return (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium text-text">
                    {e.name} {e.last_name}
                  </td>
                  <td className="px-4 py-2.5 text-text-soft">{e.dni}</td>
                  <td className="px-4 py-2.5 text-text-soft">{money(e.salary)}</td>
                  <td className="px-4 py-2.5 text-text-soft">{money(advanced)}</td>
                  <td className={`px-4 py-2.5 font-medium ${available > 0.01 ? 'text-accent' : 'text-red'}`}>
                    {money(Math.max(available, 0))}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge label={e.active ? 'Activo' : 'Inactivo'} color={e.active ? 'green' : 'gray'} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ModalTrigger
                      label="Editar"
                      className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                      title={`Editar — ${e.name} ${e.last_name}`}
                    >
                      <EmployeeForm employee={e} />
                    </ModalTrigger>
                  </td>
                </tr>
              );
            })}
            {(employees ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-text-mute">
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
