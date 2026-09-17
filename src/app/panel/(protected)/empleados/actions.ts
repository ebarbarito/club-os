'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

export async function pagarSueldo(formData: FormData) {
  const profile = await getSessionProfile();
  if (!profile) return { error: 'No autenticado' };
  if (profile.role !== 'admin') return { error: 'Solo administradores pueden registrar pagos de sueldos' };

  const supabase = await createClient();

  const employeeId = String(formData.get('employee_id') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const description = String(formData.get('description') ?? 'Pago');
  const paymentsJson = String(formData.get('payments') ?? '[]');
  const salaryAmountRaw = formData.get('salary_amount');
  const salaryAmount = salaryAmountRaw ? Number(salaryAmountRaw) : null;

  if (!employeeId) return { error: 'Empleado no especificado' };
  if (amount <= 0) return { error: 'El monto debe ser mayor a cero' };

  let payments: { account_id: string; amount: number; exchange_rate: number }[];
  try {
    payments = JSON.parse(paymentsJson);
  } catch {
    return { error: 'Datos de pago inválidos' };
  }

  const { error } = await supabase.rpc('pagar_sueldo', {
    p_employee_id: employeeId,
    p_amount: amount,
    p_description: description,
    p_payments: payments,
    p_salary_amount: salaryAmount,
  });

  if (error) return { error: error.message };

  revalidatePath('/panel/empleados');
  revalidatePath('/panel/caja');
  return {};
}

async function requireAdmin() {
  const profile = await getSessionProfile();
  if (!profile) throw new Error('No autenticado');
  if (profile.role !== 'admin') throw new Error('Solo un administrador puede gestionar empleados');
  return profile;
}

export async function createEmployee(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from('employees').insert({
    tenant_id: profile.tenantId,
    name: String(formData.get('name') ?? ''),
    last_name: String(formData.get('last_name') ?? ''),
    dni: String(formData.get('dni') ?? ''),
    salary: Number(formData.get('salary') ?? 0),
  });
  if (error) return { error: error.message };

  revalidatePath('/panel/empleados');
  revalidatePath('/panel/caja');
  return {};
}

export async function updateEmployee(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id'));
  const { error } = await supabase
    .from('employees')
    .update({
      name: String(formData.get('name') ?? ''),
      last_name: String(formData.get('last_name') ?? ''),
      dni: String(formData.get('dni') ?? ''),
      salary: Number(formData.get('salary') ?? 0),
      active: formData.get('active') === 'on',
    })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/panel/empleados');
  revalidatePath('/panel/caja');
  return {};
}
