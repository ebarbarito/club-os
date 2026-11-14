import { redirect } from 'next/navigation';
import { getRequestTenant } from '@/lib/tenant/request';
import { getSocioSesion } from '@/lib/socios/sesion';
import { ClaveForm } from './clave-form';

export default async function ClavePage() {
  const tenant = await getRequestTenant();
  if (!tenant) return null;
  const sesion = await getSocioSesion(tenant.id);
  if (!sesion) redirect('/socios/ingresar');
  return <ClaveForm obligatoria={sesion.debeCambiarClave} nombre={sesion.socio.name} />;
}
