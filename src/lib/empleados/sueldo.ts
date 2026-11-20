// Cuenta de sueldo de un empleado, mes a mes.
// Todo lo que se le paga (desde Empleados → Pagar o desde Caja con
// "Sueldo X") queda en caja con su employee_id: eso es lo retirado.
// Si en un mes retira más que el sueldo pactado, el excedente queda "a
// cuenta" del mes siguiente y se descuenta de ese sueldo. Como tope, puede
// adelantar hasta un sueldo completo del mes siguiente.

const ZONA = 'America/Argentina/Buenos_Aires';

export type Retiro = { fecha: string; monto: number };

export type MesSueldo = {
  periodo: string; // 'YYYY-MM'
  sueldo: number;
  arrastre: number; // retirado el mes anterior a cuenta de este
  retirado: number; // retirado en este mes
  consumido: number; // arrastre + retirado
  disponible: number; // lo que falta cobrar del sueldo de este mes
  aCuentaProximo: number; // excedente que pasa al mes siguiente
};

export type EstadoSueldo = {
  meses: MesSueldo[]; // del más viejo al actual
  actual: MesSueldo;
  /** Máximo que puede retirar ahora (lo pendiente + hasta un sueldo a cuenta). */
  maximo: number;
};

// 'YYYY-MM' de una fecha, en hora argentina.
export function periodoDe(fecha: string | Date): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit' }).formatToParts(d);
  const y = p.find((x) => x.type === 'year')?.value ?? '1970';
  const m = p.find((x) => x.type === 'month')?.value ?? '01';
  return `${y}-${m}`;
}

export function periodoSiguiente(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function nombreMes(periodo: string, conAnio = false): string {
  const [y, m] = periodo.split('-').map(Number);
  return `${MESES[m - 1] ?? periodo}${conAnio ? ` ${y}` : ''}`;
}

export function calcularSueldo(
  retiros: Retiro[],
  sueldoDe: (periodo: string) => number,
  hoy: Date = new Date(),
): EstadoSueldo {
  const porMes = new Map<string, number>();
  for (const r of retiros) {
    const p = periodoDe(r.fecha);
    porMes.set(p, (porMes.get(p) ?? 0) + r.monto);
  }
  const actualP = periodoDe(hoy);
  const primero = [...porMes.keys(), actualP].sort()[0];

  const meses: MesSueldo[] = [];
  let arrastre = 0;
  for (let p = primero; p <= actualP; p = periodoSiguiente(p)) {
    const sueldo = sueldoDe(p);
    const retirado = porMes.get(p) ?? 0;
    const consumido = arrastre + retirado;
    const mes: MesSueldo = {
      periodo: p,
      sueldo,
      arrastre,
      retirado,
      consumido,
      disponible: Math.max(0, sueldo - consumido),
      aCuentaProximo: Math.max(0, consumido - sueldo),
    };
    meses.push(mes);
    arrastre = mes.aCuentaProximo;
  }
  const actual = meses[meses.length - 1];
  const sueldoProximo = sueldoDe(periodoSiguiente(actual.periodo));
  const maximo = Math.max(0, actual.disponible + Math.max(0, sueldoProximo - actual.aCuentaProximo));
  return { meses, actual, maximo };
}
