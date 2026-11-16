import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { AutoImprimir } from './auto-imprimir';

type Deposito = 'dispensa' | 'general' | 'total';
type StrainInfo = { id: string; code: string | null; name: string; type: string | null; item_type: string };

const TITULO_DEPOSITO: Record<Deposito, string> = {
  dispensa: 'Stock dispensa',
  general: 'Stock general',
  total: 'Stock dispensa + general',
};

function num(n: number) {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

// Hoja de stock para imprimir (la arma el botón "Imprimir" de Stock).
export default async function ImprimirStockPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; deposito?: string; ceros?: string; control?: string; ids?: string; auto?: string }>;
}) {
  const profile = await getSessionProfile();
  const p = await searchParams;
  const esAdmin = profile?.role === 'admin';
  const tipo = p.tipo === 'accesorios' || p.tipo === 'ambos' ? p.tipo : 'geneticas';
  const deposito: Deposito = esAdmin && (p.deposito === 'general' || p.deposito === 'total') ? p.deposito : 'dispensa';
  const conCeros = p.ceros === '1';
  const conControl = p.control === '1';
  const ids = p.ids ? new Set(p.ids.split(',').filter(Boolean)) : null;

  const supabase = await createClient();
  const [{ data: dispensaRows }, { data: generalRows }, { data: tenant }] = await Promise.all([
    supabase.from('stock').select('strain_id, grams, strain:strains(id, code, name, type, item_type)'),
    supabase.from('stock_general').select('strain_id, grams, strain:strains(id, code, name, type, item_type)'),
    profile ? supabase.from('tenants').select('name').eq('id', profile.tenantId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const one = (s: StrainInfo | StrainInfo[] | null) => (Array.isArray(s) ? s[0] : s);
  const disp = new Map<string, number>();
  const gral = new Map<string, number>();
  const info = new Map<string, StrainInfo>();
  for (const r of dispensaRows ?? []) {
    disp.set(r.strain_id, Number(r.grams) || 0);
    const s = one(r.strain as StrainInfo | StrainInfo[] | null);
    if (s) info.set(r.strain_id, s);
  }
  for (const r of generalRows ?? []) {
    gral.set(r.strain_id, Number(r.grams) || 0);
    const s = one(r.strain as StrainInfo | StrainInfo[] | null);
    if (s) info.set(r.strain_id, s);
  }

  const cantidad = (id: string) =>
    deposito === 'dispensa' ? disp.get(id) ?? 0 : deposito === 'general' ? gral.get(id) ?? 0 : (disp.get(id) ?? 0) + (gral.get(id) ?? 0);

  const filas = [...info.values()]
    .filter((s) => !ids || ids.has(s.id))
    .filter((s) => conCeros || cantidad(s.id) > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const secciones = [
    { key: 'geneticas', titulo: 'Genéticas', unidad: 'g', filas: filas.filter((s) => s.item_type === 'genetica') },
    { key: 'accesorios', titulo: 'Accesorios y otros productos', unidad: 'u.', filas: filas.filter((s) => s.item_type !== 'genetica') },
  ].filter((s) => tipo === 'ambos' || s.key === tipo);

  const ahora = new Date().toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const parcial = !!ids;
  const columnasNumericas = deposito === 'total' ? 3 : 1;

  return (
    <div>
      <div className="print-hide flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link href="/panel/stock" className="text-sm text-accent hover:underline">
          ← Volver a Stock
        </Link>
        <AutoImprimir auto={p.auto === '1'} />
      </div>

      <div className="print-area bg-white text-black rounded-xl border border-line p-6 max-w-3xl print:max-w-none print:rounded-none print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4 border-b border-black/20 pb-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-black/60">{tenant?.name ?? 'Club'}</p>
            <h1 className="text-xl font-bold">
              {TITULO_DEPOSITO[deposito]}
              {parcial ? ' · parcial' : ''}
            </h1>
          </div>
          <div className="text-right text-xs text-black/70">
            <p>{ahora}</p>
            {profile?.name && <p>Impreso por {profile.name}</p>}
          </div>
        </div>

        {secciones.map((sec) => {
          const total = sec.filas.reduce((acc, s) => acc + cantidad(s.id), 0);
          return (
            <section key={sec.key} className="mb-6 break-inside-avoid-page">
              <h2 className="text-base font-bold mb-2">{sec.titulo}</h2>
              {sec.filas.length === 0 ? (
                <p className="text-sm text-black/60">Sin artículos{conCeros ? '' : ' con stock'}.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black/40 text-left">
                      <th className="py-1.5 pr-2 font-semibold">Artículo</th>
                      {deposito === 'total' ? (
                        <>
                          <th className="py-1.5 px-2 font-semibold text-right">Dispensa</th>
                          <th className="py-1.5 px-2 font-semibold text-right">General</th>
                          <th className="py-1.5 px-2 font-semibold text-right">Total</th>
                        </>
                      ) : (
                        <th className="py-1.5 px-2 font-semibold text-right">Stock</th>
                      )}
                      {conControl && <th className="py-1.5 pl-2 font-semibold w-28">Conteo</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.filas.map((s) => (
                      <tr key={s.id} className="border-b border-black/15 break-inside-avoid">
                        <td className="py-1.5 pr-2">
                          {s.code ? `${s.code} · ` : ''}
                          {s.name}
                          {sec.key === 'geneticas' && s.type && <span className="text-black/50 text-xs"> · {s.type}</span>}
                        </td>
                        {deposito === 'total' ? (
                          <>
                            <td className="py-1.5 px-2 text-right tabular-nums">{num(disp.get(s.id) ?? 0)} {sec.unidad}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{num(gral.get(s.id) ?? 0)} {sec.unidad}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{num(cantidad(s.id))} {sec.unidad}</td>
                          </>
                        ) : (
                          <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{num(cantidad(s.id))} {sec.unidad}</td>
                        )}
                        {conControl && <td className="py-1.5 pl-2 border-b border-black/40" />}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-black/40">
                      <td className="py-1.5 pr-2 font-semibold">
                        {sec.filas.length} artículo{sec.filas.length === 1 ? '' : 's'}
                      </td>
                      <td colSpan={columnasNumericas} className="py-1.5 px-2 text-right font-bold tabular-nums">
                        Total {num(total)} {sec.unidad}
                      </td>
                      {conControl && <td />}
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>
          );
        })}

        {conControl && (
          <div className="grid grid-cols-2 gap-8 mt-10 text-xs text-black/70">
            <p className="border-t border-black/40 pt-1">Contó (firma y aclaración)</p>
            <p className="border-t border-black/40 pt-1">Fecha y hora del conteo</p>
          </div>
        )}
      </div>
    </div>
  );
}
