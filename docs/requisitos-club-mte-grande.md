# Requisitos — Club Mte Grande

Transcripción versionada del documento de requerimientos que fue guiando la
migración del sistema legacy a Club OS. Se actualiza cada vez que llega una
ronda nueva de cambios; cada ronda queda con su fecha como en el original,
para poder rastrear qué se pidió cuándo.

## Estado de implementación

| Ronda | Estado |
|---|---|
| Spec original (Dispensa, Cta Cte, Caja) | ✅ Implementado |
| Modificaciones (19/8/26) | ✅ Implementado (Fase 1: Dispensa/Cta Cte + bug fix · Fase 2: Stock + Caja diaria/general) |
| Modificaciones (25/08/2026) | ✅ Implementado (Fase A: recibo único · Fase B: dólares + "dejar para la siguiente" en el cierre · Fase C: envío general→diaria) |
| Modificaciones (26/08) | ✅ Implementado (sesión que se cortaba sola, bug de dólares en Caja general, arqueo unificado + confirmación de impresión, roles por usuario) |

---

## Módulo Dispensa (spec original)

- Falta la opción de poder borrar una dispensa. Idealmente dejando un registro para poder ver lo que se borró.
- Botón de registrar dispensa: abre ventana donde se busca el socio ya sea por n° de socio, por DNI, por apellido.
- Encabezado con información del socio, luego grilla de dispensa: Artículo/descripción responden a una lista pre-cargada. Cantidad debe permitir decimales. Precio responde a la lista pre-cargada pero permite modificarla.
- Forma de pago abre otra ventana. Monedas de pago: efectivo / US$ / MP GL / Bco Provincia / Banco Santander / Bco Galicia. Cotización editable.
- Confirmar: confirma la dispensa, lo abonado y lo que va a cta cte. Volver: vuelve a la ventana anterior. Salir: no guarda registro.
- Si el total abonado no alcanza el importe, la diferencia pasa a cta cte.

## Cuenta Corriente (spec original)

- Nueva solapa en el menú principal. Buscar socio por apellido/n° socio, muestra su cta cte.
- Grilla de comprobantes adeudados: fecha / n° de dispensa / importe total / importe adeudado (en rojo).
- Cobro: parcial o total. Composición de saldos → libro mayor auxiliar (pendiente para una segunda etapa).
- Forma de pago similar a la de dispensa, sin "saldo cta cte", con grilla del total de cobros.
- Botón Visualizar: se saca. Doble click en n° de dispensa: detalle completo sin poder modificar. Salir: sin modificación.

## Módulo Caja (spec original)

- Unificar botón ingreso/egreso en "Movimientos": Categoría (ingreso/egreso), Concepto (pre-cargado: alquiler, ferretería, eventos, almacén, otros + completar), Monto, Medio (como la forma de pago de dispensa).
- En un privado, poder llevar la contabilidad de las distintas cuentas habilitadas.

---

## Modificaciones (19/8/26)

**Registrar dispensa:**
- Primer tab posiciona en socio. Búsqueda de socio navegable con tab y flechas. Segundo tab (tras elegir socio) va a artículos.
- Si la suma de la forma de pago = 0, el importe total pasa a cta cte.
- Desaparece "total sugerido" de la vista. "Total dispensa" pasa a la izquierda; en su lugar, "total cobrado" + "saldo" en rojo (lo que queda en cta cte).
- Bug: "Dispensas registradas" no estaba cargando nada.

**Cuenta Corriente:**
- Los cobros (en cta cte y al momento de la dispensa) se numeran "rec01", "rec02"... arrancando en 1.
- Al ver una dispensa: botón de imprimir.
- Numerar dispensas desde 1; si se elimina/anula, no reutilizar el número.
- Nombre del socio a la derecha de la fecha.
- Al ver el comprobante, los pagos registrados deben indicar fecha de cada uno + botón imprimir.

**Módulo Stock:**
- Separar en dos solapas: "Stock dispensa" (la actual) y "Stock general" (abastece a dispensa, solo visible admin). Registrar dispensa toma stock de "stock dispensa".
- Stock dispensa: solo disponible en esta sala. Sacar % del total, valor total, gestionar genéticas en catálogo, ajustar stock. Verde si dispensa=0 pero general>0; rojo si ambas en 0.
- Stock general: disponible sala dispensa / disponible sala general / total / envíos / movimientos / ajustar. Sacar % del total, mínimo, precio/gr, valor total.
- Envíos: mueven de general a dispensa, clasificados Muestra (resta general, no suma dispensa) o Dispensa (resta general, suma dispensa). Movimientos: historial por fecha de envíos + ajustes.

**Módulo Caja:**
- Dos solapas: Caja diaria / Caja general (solo admin).
- Caja diaria: sacar mp gl/total/etc, solo Apertura y Efectivo en caja. Concepto = n° de rec + n° de dispensa cobrada. Agregar columna socio (n°/apellido). Sacar categoría y cuenta. Agregar columnas Efectivo/Dólares/Cuentas/Total (dólares en cantidad, no conversión). Sacar historial de cierres (va a Caja general).
- Al cerrar: el importe contado es el último movimiento de la caja cerrada y la apertura de la siguiente. No permitir egresos en efectivo que dejen saldo negativo (piso en 0).
- Caja general: apertura = último arqueo de esta caja. Efectivo separado diaria/general + suma (ídem dólares). Columnas fecha/concepto/efectivo/dólares/mp gl/bco provincia/etc. Concepto = cajas diarias cerradas (click abre resumen + imprimir). Historial de cierres propio, clickeable, imprimible.

---

## Modificaciones 25/08/2026

**Recibo único por operación:**
- Los pagos (dispensa, cobros de cta cte, movimientos de caja) tienen que quedar asentados en Caja en **un solo recibo**, aunque se hayan pagado con formas de pago distintas — todo en un mismo renglón.

**Caja diaria — cierre (arqueo):**
- Conteo de efectivo por denominación + un casillero de dólares (los dólares no van por denominación, solo el total). Discriminar sub-total pesos / sub-total dólares.
- Debajo de las denominaciones: dos casilleros (pesos y dólares) para dejar efectivo para la caja siguiente. Esa acción queda como el **último movimiento de la caja que se cierra** y el **primer movimiento de la siguiente**.
- Sacar de la vista el saldo de apertura (ya no hace falta) — solo mostrar Efectivo en caja.
- Permitir imprimir.

**Caja general:**
- El casillero de dólares muestra la cantidad de dólares, no la conversión a pesos.
- Movimientos: nuevo concepto **"Envío a caja diaria"** — genera un egreso en caja general y un ingreso en caja diaria.
- Ambas cajas deben llevar parciales y subtotales de pesos y dólares por separado.

---

## Modificaciones 26/08

**Caja diaria:**
- A veces se cierra sola la pestaña (bug reportado — causa raíz: el middleware no persistía el refresh de sesión de Supabase en las cookies).
- El arqueo debe poder imprimirse una vez que se acepta el cierre, con una pregunta "¿Desea imprimir el arqueo?".

**Caja general:**
- Copiar el mismo formato de arqueo que Caja diaria.
- Bug: los montos en dólares traen mal — muestra la cantidad convertida a pesos (100 USD a cotización 1530 aparecía como "153.000 dólares") en vez de la cantidad de dólares.

**Roles:**
- Limitar accesos según el usuario. Administradores: acceso total. Dispensador: Dispensa, Cta Cte, Catálogo, Stock (solo stock dispensa), Caja (solo caja diaria).
