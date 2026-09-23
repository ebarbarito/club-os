import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import type { PaymentAccount } from '@/components/payment-split';
import { PagoForm } from './pago-form';

export default async function NuevoPagoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const { id } = await params;
  const supabase = await createClient();

  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, name')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!proveedor) notFound();

  // Facturas con saldo > 0 (deuda pendiente)
  const { data: facturas } = await supabase
    .from('proveedor_comprobantes')
    .select('id, tipo, fecha, punto_venta, numero, total, saldo')
    .eq('proveedor_id', id)
    .eq('tipo', 'factura')
    .gt('saldo', 0)
    .order('fecha', { ascending: true });

  // Notas de crédito con saldo < 0 (crédito disponible del proveedor)
  const { data: notasCredito } = await supabase
    .from('proveedor_comprobantes')
    .select('id, tipo, fecha, punto_venta, numero, total, saldo')
    .eq('proveedor_id', id)
    .eq('tipo', 'nota_credito')
    .lt('saldo', 0)
    .order('fecha', { ascending: true });

  const { data: accounts } = await supabase
    .from('payment_accounts')
    .select('id, name, currency, exchange_rate, is_cash')
    .eq('active', true)
    .order('name');

  type ComprobantePendiente = {
    id: string;
    tipo: 'factura' | 'nota_credito';
    fecha: string;
    punto_venta: string;
    numero: string;
    total: number;
    saldo: number;
  };

  return (
    <PagoForm
      proveedorId={id}
      proveedorName={proveedor.name}
      facturas={(facturas ?? []) as ComprobantePendiente[]}
      notasCredito={(notasCredito ?? []) as ComprobantePendiente[]}
      accounts={(accounts ?? []) as PaymentAccount[]}
    />
  );
}
