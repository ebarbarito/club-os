import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { publicUrlForSlug } from '@/lib/tenant/resolve';
import { CAMPOS_DATOS, PLANTILLAS, SECCIONES, parseDatosMensajes, rellenar } from '@/lib/alta/mensajes';
import { MensajeCopiable } from './mensaje-copiable';

// Toda la guía "Mensajes para socios", lista para copiar y pegar en
// WhatsApp / Instagram, ya completada con los datos del club. Para mandar
// un mensaje a un socio puntual (con su nombre, plan y link personal) se usa
// la tarjeta de mensajes de su ficha.
export default async function MensajesPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, slug, datos_mensajes')
    .eq('id', profile.tenantId)
    .single();

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const origin =
    (tenant && publicUrlForSlug(tenant.slug)) ??
    `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;

  const datos = parseDatosMensajes(tenant?.datos_mensajes);
  const faltantes = CAMPOS_DATOS.filter((c) => !datos[c.key]);
  const ctx = {
    club: tenant?.name ?? 'el club',
    operador: profile.name.trim().split(/\s+/)[0],
    datos,
    linkPreinscripcion: `${origin}/alta-socio`,
  };

  return (
    <div className="max-w-3xl">
      <Link href="/panel/socios" className="text-sm text-text-soft hover:text-accent">
        ← Socios
      </Link>
      <h1 className="font-display text-2xl font-bold text-text mt-2">Mensajes para socios</h1>
      <p className="text-text-soft mb-4">
        Listos para copiar y pegar, en el orden en que avanza una persona. Para un socio puntual, usá los mensajes de su
        ficha: salen con su nombre, su plan y su link.
      </p>

      <div className="rounded-xl border border-line bg-surface p-4 mb-6 text-sm text-text-soft space-y-1.5">
        <p>
          <strong className="text-text">Instagram para el primer contacto, WhatsApp para el resto.</strong> Valores, planes
          y formularios conviene hablarlos por WhatsApp.
        </p>
        <p>
          <strong className="text-text">Nunca des indicaciones médicas por chat</strong> (dosis, productos,
          combinaciones): eso lo define el médico en la consulta (ver 6.1).
        </p>
        <p>
          <strong className="text-text">Lo que queda entre corchetes</strong> se completa a mano antes de enviar.
        </p>
      </div>

      {faltantes.length > 0 && (
        <p className="text-amber-tx text-sm bg-amber-bg rounded-lg px-3 py-2 mb-6">
          Faltan datos del club para completar los mensajes: {faltantes.map((f) => f.label.toLowerCase()).join(', ')}.{' '}
          <Link href="/panel/configuracion" className="font-semibold underline">
            Cargarlos en Configuración
          </Link>
        </p>
      )}

      <div className="space-y-8">
        {SECCIONES.map((s) => (
          <section key={s.id}>
            <h2 className="font-display text-lg font-bold text-text">{s.titulo}</h2>
            <p className="text-text-mute text-sm mb-3">{s.desc}</p>
            <div className="space-y-3">
              {PLANTILLAS.filter((p) => p.seccion === s.id).map((p) => (
                <MensajeCopiable key={p.id} id={p.id} titulo={p.titulo} texto={rellenar(p.texto, ctx)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
