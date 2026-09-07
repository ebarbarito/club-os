'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { createMember } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

export function CreateMemberForm() {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData, submitAs: 'draft' | 'pending') {
    startTransition(async () => {
      const res = await createMember(formData, submitAs);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form
      action={(fd) => submit(fd, 'pending')}
      className="grid grid-cols-2 gap-3"
    >
      <div className="col-span-2">
        <label className={labelCls}>Nombre y apellido</label>
        <input name="name" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>DNI</label>
        <input name="dni" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Fecha de nacimiento</label>
        <input name="birth" type="date" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Teléfono</label>
        <input name="phone" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input name="email" type="email" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Nacionalidad</label>
        <input name="nacionalidad" defaultValue="Argentina" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Estado civil</label>
        <input name="estado_civil" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>CUIL/CUIT</label>
        <input name="cuil_cuit" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Domicilio</label>
        <input name="address" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Localidad</label>
        <input name="localidad" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Provincia</label>
        <input name="provincia" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Código postal</label>
        <input name="codigo_postal" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Zona</label>
        <input name="zona" className={inputCls} />
      </div>

      <div className="col-span-2 border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-mute uppercase mb-2">Categoría de socio</p>
      </div>
      <div className="col-span-2">
        <select name="categoria_socio" className={inputCls} defaultValue="">
          <option value="">Sin especificar</option>
          <option value="activo">Socio Activo</option>
          <option value="autocultivador">Socio Autocultivador</option>
          <option value="adherente_menor">Socio Adherente — Menor de edad</option>
          <option value="adherente">Socio Adherente</option>
        </select>
      </div>

      <div className="col-span-2 border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-mute uppercase mb-2">Salud / REPROCANN</p>
      </div>
      <div>
        <label className={labelCls}>REPROCANN</label>
        <select name="reprocann" className={inputCls} defaultValue="no">
          <option value="vigente">Vigente</option>
          <option value="tramite">En trámite</option>
          <option value="no">Sin REPROCANN</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Modalidad</label>
        <select name="modalidad" className={inputCls} defaultValue="propio">
          <option value="propio">Cultivo propio</option>
          <option value="solidario">Cultivo solidario</option>
          <option value="ong">ONG</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>N° de registro</label>
        <input name="repr_num" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Vencimiento</label>
        <input name="repr_exp" type="date" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Médico tratante</label>
        <input name="doctor" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Especialidad / Institución</label>
        <input name="especialidad_institucion" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Matrícula</label>
        <input name="matricula" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Patología</label>
        <input name="patologia" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Producto prescripto</label>
        <input name="producto_prescripto" className={inputCls} />
      </div>
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <div>
          <label className={labelCls}>Dosis mensual indicada</label>
          <input name="dosis_mensual" type="number" min="0" step="0.01" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Unidad</label>
          <select name="dosis_unidad" className={inputCls} defaultValue="g">
            <option value="g">g</option>
            <option value="ml">ml</option>
          </select>
        </div>
      </div>

      <div className="col-span-2 border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-mute uppercase mb-2">Servicio pactado</p>
      </div>
      <div>
        <label className={labelCls}>Tipo</label>
        <select name="servicio_pactado_tipo" className={inputCls} defaultValue="Gramos">
          <option value="Gramos">Gramos</option>
          <option value="Aceites">Aceites</option>
          <option value="M2 cultivo">M² de cultivo</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Cantidad</label>
        <input name="servicio_pactado_cantidad" type="number" min="0" step="0.01" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Cuota social</label>
        <input name="cuota_social" type="number" min="0" step="1" className={inputCls} />
      </div>
      <label className="col-span-2 flex items-center gap-2 text-sm text-text-soft">
        <input type="checkbox" name="factura_automatica" />
        Emitir factura automática — genera el cargo el 1° de cada mes (Cta Cte → Cuota social)
      </label>

      {error && <p className="col-span-2 text-red text-sm">{error}</p>}

      <div className="col-span-2 flex gap-2 mt-2">
        <button
          type="button"
          disabled={pending}
          onClick={(e) => submit(new FormData(e.currentTarget.form!), 'draft')}
          className="flex-1 rounded-lg border border-line-2 text-text font-semibold text-sm py-2 disabled:opacity-60"
        >
          Guardar borrador
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60"
        >
          {pending ? 'Enviando…' : 'Enviar alta'}
        </button>
      </div>
    </form>
  );
}
