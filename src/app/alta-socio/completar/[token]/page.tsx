import type { Metadata } from 'next';
import { getEtapa2 } from '@/lib/public/actions';
import { Etapa2Form } from './etapa2-form';

export const metadata: Metadata = {
  title: 'Formulario de adhesión',
  // Link personal: que no lo indexe ningún buscador.
  robots: { index: false, follow: false },
};

// ETAPA 2 del alta. No usa el gate de public_site_enabled: el link lo
// manda el club a mano a un socio puntual, y el token ya es el permiso.
export default async function CompletarAltaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const etapa2 = await getEtapa2(token);

  if (!etapa2) {
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
