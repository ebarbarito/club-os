'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/badge';
import { ModalTrigger } from '@/components/modal-trigger';
import { MEMBER_STATUS } from '@/lib/status-meta';
import { fmtDate } from '@/lib/format';
import { EditMemberForm } from './edit-member-form';
import { DeleteMemberForm } from './delete-member-form';

const REPROCANN_LABEL: Record<string, string> = { vigente: 'Vigente', tramite: 'En trámite', no: 'Sin REPROCANN' };
const REPROCANN_TYPE_LABEL: Record<string, string> = { autocultivador: 'Autocultivador', paciente: 'Paciente' };

function reprocannCell(reprocann: string, type: string | null): string {
  const status = REPROCANN_LABEL[reprocann] ?? reprocann;
  if (!type) return status;
  return `${REPROCANN_TYPE_LABEL[type] ?? type} · ${status}`;
}

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
  nacionalidad: string | null;
  estado_civil: string | null;
  cuil_cuit: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  categoria_socio: string | null;
  reprocann: string;
  reprocann_type: string | null;
  repr_num: string | null;
  repr_exp: string | null;
  doctor: string | null;
  especialidad_institucion: string | null;
  matricula: string | null;
  modalidad: string | null;
  patologia: string | null;
  producto_prescripto: string | null;
  dosis_mensual: number | null;
  dosis_unidad: string | null;
  alta_date: string;
  status: string;
  servicio_pactado_tipo: string | null;
  servicio_pactado_cantidad: number | null;
  cuota_social: number | null;
  factura_automatica: boolean;
  cuota_social_bonificada: boolean;
};

export function SociosTable({ members }: { members: Member[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q) || String(m.member_number ?? '').includes(q));
  }, [members, query]);

  return (
    <div>
      <div className="mb-3 max-w-xs">
        <input
          type="text"
          placeholder="Buscar por número o nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-line-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Código</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Nombre</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">DNI</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Domicilio</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">REPROCANN</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Alta</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Estado</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-line hover:bg-surface-2">
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{m.member_number ?? '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/panel/socios/${m.id}`} className="font-medium text-text hover:text-accent">
                    {m.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{m.dni}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft max-w-[220px] truncate" title={m.address ?? m.zona ?? ''}>
                  {m.address ?? m.zona ?? '—'}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{reprocannCell(m.reprocann, m.reprocann_type)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-text-soft">{fmtDate(m.alta_date)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Badge label={MEMBER_STATUS[m.status as keyof typeof MEMBER_STATUS].label} color={MEMBER_STATUS[m.status as keyof typeof MEMBER_STATUS].color} />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <div className="flex gap-2 justify-end">
                    <ModalTrigger
                      label="Editar"
                      className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-accent hover:text-accent"
                      title={`Editar socio · ${m.name}`}
                      size="xl"
                    >
                      <EditMemberForm member={m} />
                    </ModalTrigger>
                    <ModalTrigger
                      label="Eliminar"
                      className="rounded-lg border border-line-2 text-xs font-semibold px-3 py-1.5 hover:border-red hover:text-red"
                      title="Eliminar socio"
                    >
                      <DeleteMemberForm memberId={m.id} memberName={m.name} />
                    </ModalTrigger>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-text-mute">
                  Sin socios en esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
