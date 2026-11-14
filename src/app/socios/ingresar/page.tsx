import { redirect } from 'next/navigation';
import { getRequestTenant } from '@/lib/tenant/request';
import { getSocioSesion } from '@/lib/socios/sesion';
import { IngresarForm } from './ingresar-form';

export default async function IngresarPage() {
  const tenant = await getRequestTenant();
  if (!tenant) return null;
  const sesion = await getSocioSesion(tenant.id);
  if (sesion) redirect(sesion.debeCambiarClave ? '/socios/clave' : '/socios');
  return <IngresarForm clubName={tenant.name} />;
}
