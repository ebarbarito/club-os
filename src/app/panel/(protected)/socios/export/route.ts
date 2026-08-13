import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

const HEADERS = [
  'Código',
  'Nombre y apellido',
  'DNI',
  'Teléfono',
  'Email',
  'Domicilio',
  'Zona',
  'Fecha nacimiento',
  'Fecha alta',
  'REPROCANN',
  'Tipo REPROCANN',
  'N° registro REPROCANN',
  'Vencimiento REPROCANN',
  'Médico',
  'Matrícula',
  'Modalidad',
  'Patología',
  'Estado',
];

const REPROCANN_LABEL: Record<string, string> = { vigente: 'Vigente', tramite: 'En trámite', no: 'Sin REPROCANN' };
const REPROCANN_TYPE_LABEL: Record<string, string> = { autocultivador: 'Autocultivador', paciente: 'Paciente' };
const STATUS_LABEL: Record<string, string> = { draft: 'Borrador', pending: 'En evaluación', valid: 'Válido', rejected: 'Rechazado' };

function csvCell(value: string | number | null): string {
  const s = value == null ? '' : String(value);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) return new NextResponse('No autenticado', { status: 401 });

  const supabase = await createClient();
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .is('deleted_at', null)
    .order('member_number', { ascending: true, nullsFirst: false });

  const rows = (members ?? []).map((m) =>
    [
      m.member_number,
      m.name,
      m.dni,
      m.phone,
      m.email,
      m.address,
      m.zona,
      m.birth,
      m.alta_date?.slice(0, 10) ?? null,
      REPROCANN_LABEL[m.reprocann] ?? m.reprocann,
      m.reprocann_type ? (REPROCANN_TYPE_LABEL[m.reprocann_type] ?? m.reprocann_type) : null,
      m.repr_num,
      m.repr_exp,
      m.doctor,
      m.matricula,
      m.modalidad,
      m.patologia,
      STATUS_LABEL[m.status] ?? m.status,
    ]
      .map(csvCell)
      .join(';'),
  );

  const csv = '﻿' + [HEADERS.join(';'), ...rows].join('\n');
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="socios-${date}.csv"`,
    },
  });
}
