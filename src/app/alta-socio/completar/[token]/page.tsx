import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { etapa2Completada, getEtapa2 } from '@/lib/public/actions';
import { getTenantBySlug } from '@/lib/tenant/get-tenant';
import { metadataPublica } from '@/lib/tenant/metadata';
import { Etapa2Form } from './etapa2-form';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  // Link personal: que no lo indexe ningún buscador.
  const robots = { index: false, follow: false };
  const slug = (await headers()).get('x-club-os-tenant-slug');
  const tenant = slug ? await getTenantBySlug(slug) : null;
  if (!tenant) return { title: 'Formulario de adhesión', robots };
  return {
    ...(await metadataPublica(tenant, {
      title: `Formulario de adhesión · ${tenant.name}`,
      description: 'Segunda parte de tu ingreso: indicación médica y firma de la documentación.',
      path: `/alta-socio/completar/${token}`,
    })),
    robots,
  };
}

// ETAPA 2 del alta. No usa el gate de public_site_enabled: el link lo
// manda el club a mano a un socio puntual, y el token ya es el permiso.
export default async function CompletarAltaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const etapa2 = await getEtapa2(token);

  if (!etapa2) {
    // Ya lo completó (por ejemplo, la página se recargó justo después de
    // enviarlo): se muestra la confirmación en vez de "link no disponible".
    const completada = await etapa2Completada(token);
    if (completada) {
      return (
        <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg font-sans text-center px-4 py-16">
          <h1 className="font-display text-2xl font-bold">¡Listo!</h1>
          <p className="text-text-soft max-w-md">
            Recibimos tu formulario de adhesión. {completada.tenantName} lo va a validar y te avisamos por WhatsApp para
            coordinar la vinculación en REPROCANN y tu primer retiro.
          </p>
        </main>
      );
    }
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg font-sans text-center px-4 py-16">
        <h1 className="font-display text-2xl font-bold">Link no disponible</h1>
        <p className="text-text-soft max-w-md">
          Este link ya se usó o no es válido. Si todavía no completaste tu formulario, pedile al club uno nuevo por
          WhatsApp.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-bg font-sans">
      <Etapa2Form
        token={token}
        tenantName={etapa2.tenantName}
        nombre={etapa2.nombre}
        reprocannPendiente={etapa2.reprocann !== 'vigente'}
        planInicial={etapa2.plan}
        adicionalesIniciales={etapa2.adicionales}
        documentos={etapa2.documentos}
        tipo={etapa2.tipo}
        reprocannActual={etapa2.reprocannActual}
      />
    </main>
  );
}
