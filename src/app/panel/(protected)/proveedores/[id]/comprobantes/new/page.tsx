import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ComprobanteForm } from './comprobante-form';

export default async function NuevoComprobantePage({
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

  const { data: articulos } = await supabase
    .from('proveedor_articulos')
    .select('id, code, description, unit')
    .is('deleted_at', null)
    .order('description', { ascending: true });

  return (
    <ComprobanteForm
      proveedorId={id}
      proveedorName={proveedor.name}
      articulos={articulos ?? []}
    />
  );
}
