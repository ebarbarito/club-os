import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getRequestTenant } from '@/lib/tenant/request';
import { getSocioSesion } from '@/lib/socios/sesion';
import { salir } from '@/lib/socios/actions';
import { PLANES, labelDe } from '@/lib/alta/opciones';

// Cuenta del socio. Por ahora: sus datos básicos; acá se van a sumar la
// cuota, los retiros y las reservas.
export default async function CuentaSocioPage({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  const tenant = await getRequestTenant();
  if (!tenant) return null;
  const sesion = await getSocioSesion(tenant.id);
  if (!sesion) redirect('/socios/ingresar');
  if (sesion.debeCambiarClave) redirect('/socios/clave');
  const { clave } = await searchParams;

  const s = sesion.socio;
  const primerNombre = (s.name ?? '').trim().split(/\s+/)[0];
  const plan = s.plan ? labelDe(PLANES, s.plan) : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-5">
      {clave === 'ok' && (
        <p className="rounded-lg bg-surface-2 text-text text-sm px-4 py-3" role="status">
          ✓ Listo, tu contraseña quedó guardada. La próxima vez ingresá con tu DNI y esa contraseña.
        </p>
      )}
      <div>
        <h1 className="font-display text-2xl font-bold text-text">¡Hola{primerNombre ? `, ${primerNombre}` : ''}!</h1>
        <p className="text-text-soft text-sm">Bienvenido/a al sitio de socios de {tenant.name}.</p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-xs font-semibold text-text-mute uppercase mb-3">Tu membresía</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-text-mute">Socio N°</dt>
            <dd className="font-semibold text-text">{s.memberNumber ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-mute">Estado</dt>
            <dd className="font-semibold text-accent">Activo</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-text-mute">Plan</dt>
            <dd className="font-semibold text-text">{plan ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <p className="text-text-soft text-sm">
        Muy pronto vas a poder ver acá tu cuota, tus retiros y hacer tus reservas.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-lg border border-line-2 px-4 py-2 text-sm font-semibold text-text">
          Ir al sitio
        </Link>
        <Link href="/socios/clave" className="rounded-lg border border-line-2 px-4 py-2 text-sm font-semibold text-text">
          Cambiar contraseña
        </Link>
        <form action={salir}>
          <button type="submit" className="rounded-lg border border-line-2 px-4 py-2 text-sm font-semibold text-red">
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}
