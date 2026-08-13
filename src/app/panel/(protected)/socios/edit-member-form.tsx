'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useModalClose } from '@/components/modal-trigger';
import { updateMember } from './actions';

const inputCls = 'w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-soft mb-1';

type Member = {
  id: string;
  member_number: number | null;
  name: string;
  dni: string;
  birth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  zona: string | null;
  reprocann: string;
  reprocann_type: string | null;
  repr_num: string | null;
  repr_exp: string | null;
  doctor: string | null;
  matricula: string | null;
  modalidad: string | null;
  patologia: string | null;
  status: string;
};

export function EditMemberForm({ member }: { member: Member }) {
  const router = useRouter();
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await updateMember(member.id, formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>N° de socio</label>
        <input name="member_number" type="number" min="1" defaultValue={member.member_number ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Estado</label>
        <select name="status" defaultValue={member.status} className={inputCls}>
          <option value="draft">Borrador</option>
          <option value="pending">En evaluación</option>
          <option value="valid">Válido</option>
          <option value="rejected">Rechazado</option>
        </select>
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Nombre y apellido</label>
        <input name="name" required defaultValue={member.name} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>DNI</label>
        <input name="dni" required defaultValue={member.dni} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Fecha de nacimiento</label>
        <input name="birth" type="date" defaultValue={member.birth ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Teléfono</label>
        <input name="phone" defaultValue={member.phone ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input name="email" type="email" defaultValue={member.email ?? ''} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Domicilio</label>
        <input name="address" defaultValue={member.address ?? ''} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Zona</label>
        <input name="zona" defaultValue={member.zona ?? ''} className={inputCls} />
      </div>

      <div className="col-span-2 border-t border-line pt-3 mt-1">
        <p className="text-xs font-semibold text-text-mute uppercase mb-2">Salud / REPROCANN</p>
      </div>
      <div>
        <label className={labelCls}>Tipo</label>
        <select name="reprocann_type" defaultValue={member.reprocann_type ?? ''} className={inputCls}>
          <option value="">Sin especificar</option>
          <option value="autocultivador">Autocultivador</option>
          <option value="paciente">Paciente</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>REPROCANN</label>
        <select name="reprocann" defaultValue={member.reprocann} className={inputCls}>
          <option value="vigente">Vigente</option>
          <option value="tramite">En trámite</option>
          <option value="no">Sin REPROCANN</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Modalidad</label>
        <select name="modalidad" defaultValue={member.modalidad ?? ''} className={inputCls}>
          <option value="">Sin especificar</option>
          <option value="propio">Cultivo propio</option>
          <option value="solidario">Cultivo solidario</option>
          <option value="ong">ONG</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>N° de registro</label>
        <input name="repr_num" defaultValue={member.repr_num ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Vencimiento</label>
        <input name="repr_exp" type="date" defaultValue={member.repr_exp ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Médico tratante</label>
        <input name="doctor" defaultValue={member.doctor ?? ''} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Matrícula</label>
        <input name="matricula" defaultValue={member.matricula ?? ''} className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Patología</label>
        <input name="patologia" defaultValue={member.patologia ?? ''} className={inputCls} />
      </div>

      {error && <p className="col-span-2 text-red text-sm">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-lg bg-accent text-white font-semibold text-sm py-2 disabled:opacity-60 mt-2"
      >
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
