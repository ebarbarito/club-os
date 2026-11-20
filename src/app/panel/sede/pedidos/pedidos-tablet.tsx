'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useAtras, useGuardiaSalida } from '../use-atras';
import { ImageCarousel } from '@/components/public/image-carousel';
import { PASO_GRAMOS, TOPE_GRAMOS_PEDIDO, VIGENCIA_RESERVA_HORAS } from '@/lib/pedidos/reglas';
import { confirmarPedido, crearClaveTablet, identificarSocio, pedirClaveTablet } from './actions';

export type ArticuloCatalogo = {
  id: string;
  nombre: string;
  tipo: string | null;
  esGenetica: boolean;
  precio: number;
  disponible: boolean;
  // Máximo que se puede pedir (g o unidades); no se muestra.
  tope: number;
  imagenes: string[];
};

type Paso = 'ingreso' | 'primera-vez' | 'crear-clave' | 'catalogo' | 'revision' | 'listo';

const inputCls = 'w-full rounded-xl border-2 border-line-2 bg-surface px-4 py-4 text-xl outline-none focus:border-accent';
const btnPrimario = 'rounded-2xl bg-accent text-white text-lg font-bold px-6 py-4 disabled:opacity-60';
const btnSecundario = 'rounded-2xl border-2 border-line-2 text-text text-lg font-bold px-6 py-4';

const pesos = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const INACTIVIDAD_MS = 120_000;

// Sesión del socio en la tablet guardada en sessionStorage: refrescar la
// página no lo saca ni le borra el pedido. Se borra al salir, al terminar o
// por inactividad (y si pasó más que el tiempo de inactividad, no se usa).
const CLAVE_SESION = 'sede-pedido-sesion';
const PASOS_CON_SOCIO: Paso[] = ['crear-clave', 'catalogo', 'revision'];
type SesionGuardada = {
  guardado: number;
  paso: Paso;
  ticket: string;
  nombre: string;
  carrito: Record<string, number>;
  seccion: 'geneticas' | 'accesorios';
  nota: string;
};
function leerSesion(): SesionGuardada | null {
  try {
    const raw = window.sessionStorage.getItem(CLAVE_SESION);
    if (!raw) return null;
    const s = JSON.parse(raw) as SesionGuardada;
    if (!s || Date.now() - s.guardado > INACTIVIDAD_MS || !PASOS_CON_SOCIO.includes(s.paso) || !s.ticket) {
      borrarSesion();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}
function guardarSesion(s: Omit<SesionGuardada, 'guardado'>) {
  try {
    window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ ...s, guardado: Date.now() }));
  } catch {
    // sin storage: sigue sin recuperación
  }
}
function borrarSesion() {
  try {
    window.sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    // nada
  }
}

// El socio, solo en la tablet: se identifica, arma el pedido y lo deja para
// que lo preparen. Si nadie toca la pantalla un rato, vuelve al inicio.
export function PedidosTablet({ catalogo }: { catalogo: ArticuloCatalogo[] }) {
  const [paso, setPaso] = useState<Paso>('ingreso');
  const [dni, setDni] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [ticket, setTicket] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seccion, setSeccion] = useState<'geneticas' | 'accesorios'>('geneticas');
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [nota, setNota] = useState('');
  const ultimoToque = useRef(Date.now());
  const pasoRef = useRef(paso);
  const carritoRef = useRef(carrito);
  pasoRef.current = paso;
  carritoRef.current = carrito;
  const saliendo = useRef(false);
  const [listoSesion, setListoSesion] = useState(false);

  // Recupera la sesión del socio si se refrescó la página.
  useEffect(() => {
    const g = leerSesion();
    if (g) {
      setTicket(g.ticket);
      setNombre(g.nombre);
      setCarrito(g.carrito);
      setSeccion(g.seccion);
      setNota(g.nota);
      setPaso(g.paso);
    }
    setListoSesion(true);
  }, []);
  useEffect(() => {
    if (!listoSesion) return;
    if (PASOS_CON_SOCIO.includes(paso) && ticket) guardarSesion({ paso, ticket, nombre, carrito, seccion, nota });
    else borrarSesion();
  }, [listoSesion, paso, ticket, nombre, carrito, seccion, nota]);
  // Cerrar la pestaña con el socio adentro: el navegador pide confirmación.
  useEffect(() => {
    if (!PASOS_CON_SOCIO.includes(paso)) return;
    const aviso = (e: BeforeUnloadEvent) => {
      if (saliendo.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [paso]);

  function irAPortada() {
    saliendo.current = true;
    borrarSesion();
    window.location.assign('/panel/sede');
  }

  function preguntaSalir(): string {
    const hayAlgo = Object.values(carritoRef.current).some((c) => c > 0);
    return hayAlgo
      ? '¿Salir? Se descarta el pedido y se cierra tu sesión.'
      : '¿Salir? Se cierra tu sesión y vas a tener que volver a ingresar con tu DNI.';
  }

  // El botón "atrás" de la tablet: desde el carrito vuelve al catálogo sin
  // perder nada; con el socio adentro, pregunta siempre antes de salir.
  useAtras(() => {
    const p = pasoRef.current;
    if (p === 'revision') {
      setPaso('catalogo');
      return true;
    }
    if (PASOS_CON_SOCIO.includes(p) && !window.confirm(preguntaSalir())) return true;
    irAPortada();
    return false;
  });

  // Botón "Inicio" del encabezado: con el socio adentro, pregunta antes.
  useGuardiaSalida(() => {
    if (PASOS_CON_SOCIO.includes(pasoRef.current) && !window.confirm(preguntaSalir())) return false;
    saliendo.current = true;
    borrarSesion();
    return true;
  });

  // Vuelta al inicio por inactividad (no quedan datos del socio a la vista).
  useEffect(() => {
    const tocar = () => {
      ultimoToque.current = Date.now();
    };
    window.addEventListener('pointerdown', tocar);
    window.addEventListener('keydown', tocar);
    const t = setInterval(() => {
      const limite = paso === 'listo' ? 20_000 : INACTIVIDAD_MS;
      if (Date.now() - ultimoToque.current > limite) irAPortada();
    }, 5_000);
    return () => {
      window.removeEventListener('pointerdown', tocar);
      window.removeEventListener('keydown', tocar);
      clearInterval(t);
    };
  }, [paso]);

  const porId = useMemo(() => new Map(catalogo.map((a) => [a.id, a])), [catalogo]);
  const lineas: { art: ArticuloCatalogo; cantidad: number }[] = [];
  for (const [id, c] of Object.entries(carrito) as [string, number][]) {
    const art = porId.get(id);
    if (art && c > 0) lineas.push({ art, cantidad: c });
  }
  const total = lineas.reduce((acc, l) => acc + l.art.precio * l.cantidad, 0);
  const cantidadArticulos = lineas.length;
  // Primero lo disponible, después lo sin stock (alfabético dentro de cada grupo).
  const visibles = catalogo
    .filter((a) => (seccion === 'geneticas' ? a.esGenetica : !a.esGenetica))
    .sort((a, b) => Number(b.disponible) - Number(a.disponible) || a.nombre.localeCompare(b.nombre, 'es'));

  const gramosGeneticas = lineas.filter((l) => l.art.esGenetica).reduce((acc, l) => acc + l.cantidad, 0);

  // ¿Se puede sumar un paso más de este artículo? (tope propio y 40 g en total)
  function puedeSumar(a: ArticuloCatalogo) {
    const paso = a.esGenetica ? PASO_GRAMOS : 1;
    const actual = carrito[a.id] ?? 0;
    if (actual + paso > a.tope) return false;
    if (a.esGenetica && gramosGeneticas + paso > TOPE_GRAMOS_PEDIDO) return false;
    return true;
  }

  function sumar(a: ArticuloCatalogo) {
    if (!puedeSumar(a)) return;
    const paso = a.esGenetica ? PASO_GRAMOS : 1;
    setCarrito((prev) => ({ ...prev, [a.id]: (prev[a.id] ?? 0) + paso }));
  }

  function restar(a: ArticuloCatalogo) {
    const paso = a.esGenetica ? PASO_GRAMOS : 1;
    setCarrito((prev) => ({ ...prev, [a.id]: Math.max(0, (prev[a.id] ?? 0) - paso) }));
  }

  function quitar(id: string) {
    setCarrito((prev) => ({ ...prev, [id]: 0 }));
  }

  function ingresar() {
    setError(null);
    startTransition(async () => {
      const res = await identificarSocio(dni, clave);
      setClave('');
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setTicket(res.ticket);
      setNombre(res.nombre);
      setPaso(res.debeCrearClave ? 'crear-clave' : 'catalogo');
    });
  }

  function pedirClave() {
    setError(null);
    startTransition(async () => {
      const res = await pedirClaveTablet(dni);
      if (res.error) setError(res.error);
      else {
        setAviso(res.ok ?? null);
        setPaso('ingreso');
      }
    });
  }

  function crearClave() {
    setError(null);
    startTransition(async () => {
      const res = await crearClaveTablet(ticket, clave, clave2);
      if (res.error) {
        setError(res.error);
        return;
      }
      setClave('');
      setClave2('');
      setPaso('catalogo');
    });
  }

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await confirmarPedido(
        ticket,
        lineas.map((l) => ({ strainId: l.art.id, cantidad: l.cantidad })),
        nota,
      );
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setPaso('listo');
    });
  }

  const errorBox = error && (
    <p role="alert" className="rounded-xl bg-red-bg text-red font-semibold px-4 py-3">
      {error}
    </p>
  );

  // ── Ingreso ───────────────────────────────────────────────────────────
  if (paso === 'ingreso' || paso === 'primera-vez') {
    const primeraVez = paso === 'primera-vez';
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-text mb-2">{primeraVez ? 'Recibí tu clave' : 'Hacé tu pedido'}</h1>
        <p className="text-lg text-text-soft mb-6">
          {primeraVez
            ? 'Te mandamos una clave provisoria al mail que tenés registrado en el club.'
            : 'Ingresá con tu DNI y tu contraseña del sitio de socios.'}
        </p>
        {aviso && !primeraVez && <p className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-text">{aviso}</p>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-soft mb-1.5" htmlFor="dni">DNI</label>
            <input
              id="dni"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Sin puntos"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/[^\d.\s-]/g, ''))}
              className={inputCls}
            />
          </div>
          {!primeraVez && (
            <div>
              <label className="block text-sm font-semibold text-text-soft mb-1.5" htmlFor="clave">Contraseña</label>
              <input
                id="clave"
                type="password"
                autoComplete="off"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ingresar()}
                className={inputCls}
              />
            </div>
          )}
          {errorBox}
          {primeraVez ? (
            <button type="button" onClick={pedirClave} disabled={pending} className={`${btnPrimario} w-full`}>
              {pending ? 'Enviando…' : 'Enviarme la clave'}
            </button>
          ) : (
            <button type="button" onClick={ingresar} disabled={pending} className={`${btnPrimario} w-full`}>
              {pending ? 'Ingresando…' : 'Ingresar'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPaso(primeraVez ? 'ingreso' : 'primera-vez');
            }}
            className="w-full py-2 text-accent font-semibold"
          >
            {primeraVez ? 'Volver a ingresar' : 'Primera vez o te olvidaste la contraseña'}
          </button>
        </div>
      </div>
    );
  }

  // ── Contraseña definitiva (entró con la provisoria) ────────────────────
  if (paso === 'crear-clave') {
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-text mb-2">¡Hola {nombre}! Creá tu contraseña</h1>
        <p className="text-lg text-text-soft mb-6">La vas a usar acá y en el sitio de socios. Al menos 8 caracteres, con letras y números.</p>
        <div className="space-y-4">
          <input type="password" autoComplete="off" placeholder="Contraseña nueva" value={clave} onChange={(e) => setClave(e.target.value)} className={inputCls} />
          <input type="password" autoComplete="off" placeholder="Repetila" value={clave2} onChange={(e) => setClave2(e.target.value)} className={inputCls} />
          {errorBox}
          <button type="button" onClick={crearClave} disabled={pending} className={`${btnPrimario} w-full`}>
            {pending ? 'Guardando…' : 'Guardar y seguir'}
          </button>
        </div>
      </div>
    );
  }

  // ── Listo ──────────────────────────────────────────────────────────────
  if (paso === 'listo') {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="mb-4 text-7xl" aria-hidden>✅</div>
        <h1 className="font-display text-3xl font-bold text-text">¡Listo, {nombre}!</h1>
        <p className="mt-2 text-xl text-text-soft">Tu pedido quedó cargado. Acercate al mostrador para retirarlo.</p>
        <p className="mt-3 text-base font-semibold text-amber-tx">
          La reserva vale {VIGENCIA_RESERVA_HORAS} horas: si no la retirás en ese plazo, se cancela sola.
        </p>
        <button type="button" onClick={irAPortada} className={`${btnPrimario} mt-10`}>
          Terminar
        </button>
      </div>
    );
  }

  // ── Revisión ──────────────────────────────────────────────────────────
  if (paso === 'revision') {
    return (
      <div className="mx-auto max-w-3xl px-6 pt-8 pb-36">
        <h1 className="font-display text-3xl font-bold text-text">Revisá tu pedido</h1>
        <p className={`mb-6 font-semibold ${gramosGeneticas >= TOPE_GRAMOS_PEDIDO ? 'text-amber-tx' : 'text-text-soft'}`}>
          Llevás {gramosGeneticas} de {TOPE_GRAMOS_PEDIDO} g
        </p>
        <div className="rounded-2xl border border-line bg-surface divide-y divide-line">
          {lineas.map(({ art, cantidad }) => (
            <div key={art.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-40 flex-1">
                <p className="text-lg font-bold text-text">{art.nombre}</p>
                <p className="text-text-soft">{pesos(art.precio * cantidad)}</p>
              </div>
              {/* Cambiar la cantidad acá mismo, con las mismas reglas del catálogo. */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => restar(art)}
                  className="h-12 w-12 rounded-xl border-2 border-line-2 text-2xl font-bold"
                  aria-label={`Restar ${art.esGenetica ? PASO_GRAMOS : 1} ${art.esGenetica ? 'g' : 'u.'}`}
                >
                  −
                </button>
                <span className="w-16 text-center text-xl font-bold tabular-nums">
                  {cantidad} {art.esGenetica ? 'g' : 'u.'}
                </span>
                <button
                  type="button"
                  onClick={() => sumar(art)}
                  disabled={!puedeSumar(art)}
                  className="h-12 w-12 rounded-xl border-2 border-accent text-2xl font-bold text-accent disabled:opacity-40"
                  aria-label={`Sumar ${art.esGenetica ? PASO_GRAMOS : 1} ${art.esGenetica ? 'g' : 'u.'}`}
                >
                  +
                </button>
              </div>
              <button type="button" onClick={() => quitar(art.id)} className="rounded-xl border-2 border-line-2 px-4 py-2 font-semibold text-red">
                Quitar
              </button>
            </div>
          ))}
          {lineas.length === 0 && <p className="px-5 py-6 text-text-soft">No hay nada en el pedido.</p>}
        </div>
        <div className="mt-4">
          <label className="block text-sm font-semibold text-text-soft mb-1.5" htmlFor="nota">Comentario (opcional)</label>
          <textarea id="nota" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} />
        </div>
        <p className="mt-4 text-text-mute">El total es aproximado: se confirma y se cobra al retirar.</p>
        {error && <div className="mt-4">{errorBox}</div>}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur px-5 py-4">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button type="button" onClick={() => setPaso('catalogo')} className={btnSecundario}>
              Seguir eligiendo
            </button>
            <button type="button" onClick={confirmar} disabled={pending || lineas.length === 0} className={`${btnPrimario} flex-1`}>
              {pending ? 'Enviando…' : `Confirmar pedido · ${pesos(total)}`}
            </button>
          <p className="mt-2 text-center text-sm text-text-soft">La reserva vale {VIGENCIA_RESERVA_HORAS} horas para retirarla.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Catálogo ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 pb-36">
      {/* Encabezado fijo: siempre visible al bajar por el catálogo. */}
      <div className="sticky top-0 z-10 -mx-5 mb-5 border-b border-line bg-bg/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-text-soft">Hola, {nombre}</p>
            <h1 className="font-display text-3xl font-bold text-text leading-tight">Elegí tu pedido</h1>
            <p className={`font-semibold ${gramosGeneticas >= TOPE_GRAMOS_PEDIDO ? 'text-amber-tx' : 'text-text-soft'}`}>
              Llevás {gramosGeneticas} de {TOPE_GRAMOS_PEDIDO} g
              {gramosGeneticas >= TOPE_GRAMOS_PEDIDO ? ' · llegaste al tope' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-2xl border-2 border-line-2 bg-surface p-1">
              {(['geneticas', 'accesorios'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSeccion(s);
                    window.scrollTo({ top: 0 });
                  }}
                  className={`rounded-xl px-5 py-2.5 text-lg font-bold ${seccion === s ? 'bg-accent text-white' : 'text-text-soft'}`}
                >
                  {s === 'geneticas' ? 'Genéticas' : 'Accesorios'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPaso('revision');
              }}
              disabled={cantidadArticulos === 0}
              className="relative flex items-center gap-2 rounded-2xl border-2 border-accent bg-surface px-4 py-2.5 text-lg font-bold text-accent disabled:opacity-40"
              aria-label="Ver carrito"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9.5" cy="20" r="1.4" />
                <circle cx="17.5" cy="20" r="1.4" />
              </svg>
              Carrito
              {cantidadArticulos > 0 && (
                <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-sm text-white">
                  {cantidadArticulos}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibles.map((a) => {
          const cant = carrito[a.id] ?? 0;
          const unidad = a.esGenetica ? 'g' : 'u.';
          return (
            <div
              key={a.id}
              className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-surface ${cant > 0 ? 'border-accent' : 'border-line'} ${a.disponible ? '' : 'opacity-50'}`}
            >
              <div className="px-3 pt-3">
                <ImageCarousel images={a.imagenes} alt={a.nombre} esGenetica={a.esGenetica} />
              </div>
              <div className="flex flex-1 flex-col px-4 pb-4">
                <p className="text-lg font-bold text-text leading-tight">{a.nombre}</p>
                <p className="text-text-soft text-sm">
                  {a.tipo && a.esGenetica ? `${a.tipo} · ` : ''}
                  {pesos(a.precio)}
                  {a.esGenetica ? ' / g' : ''}
                </p>
                {!a.disponible ? (
                  <p className="mt-auto pt-3 font-semibold text-text-mute">Sin stock</p>
                ) : (
                  <div className="mt-auto pt-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => restar(a)}
                        disabled={cant <= 0}
                        className="h-14 w-14 rounded-xl border-2 border-line-2 text-3xl font-bold disabled:opacity-40"
                        aria-label={`Restar ${a.esGenetica ? PASO_GRAMOS : 1} ${unidad}`}
                      >
                        −
                      </button>
                      <span className="flex-1 text-center text-xl font-bold tabular-nums">
                        {cant} {unidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => sumar(a)}
                        disabled={!puedeSumar(a)}
                        className="h-14 w-14 rounded-xl border-2 border-accent text-3xl font-bold text-accent disabled:opacity-40"
                        aria-label={`Sumar ${a.esGenetica ? PASO_GRAMOS : 1} ${unidad}`}
                      >
                        +
                      </button>
                    </div>
                    {a.esGenetica && <p className="mt-1.5 text-center text-xs text-text-mute">De a {PASO_GRAMOS} g</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {visibles.length === 0 && <p className="text-text-soft">Por ahora no hay artículos disponibles en esta sección.</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(preguntaSalir())) irAPortada();
            }}
            className={btnSecundario}
            title="Sale y vuelve a la pantalla principal"
          >
            Salir
          </button>
          <button
            type="button"
            onClick={() => {
              const hayAlgo = Object.values(carrito).some((c) => c > 0);
              if (hayAlgo && !window.confirm('¿Vaciar todo lo que elegiste?')) return;
              setCarrito({});
              setError(null);
            }}
            disabled={cantidadArticulos === 0}
            className={`${btnSecundario} disabled:opacity-40`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPaso('revision');
            }}
            disabled={cantidadArticulos === 0}
            className={`${btnPrimario} flex-1`}
          >
            {cantidadArticulos === 0
              ? 'Elegí al menos un artículo'
              : `Ver pedido · ${cantidadArticulos} artículo${cantidadArticulos === 1 ? '' : 's'} · ${pesos(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
