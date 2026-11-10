// Médico tratante del club (tenants.medico_por_defecto): se precarga en la
// segunda parte del alta y el socio lo reemplaza si tiene otro médico.
export type MedicoClub = {
  doctor?: string;
  matricula?: string;
  especialidad_institucion?: string;
  producto_prescripto?: string;
};

export const CAMPOS_MEDICO: { key: keyof MedicoClub; label: string; placeholder: string }[] = [
  { key: 'doctor', label: 'Médico tratante', placeholder: 'Nombre y apellido' },
  { key: 'matricula', label: 'Matrícula', placeholder: 'N° de matrícula' },
  { key: 'especialidad_institucion', label: 'Especialidad / Institución', placeholder: 'Médico / Clínica' },
  { key: 'producto_prescripto', label: 'Producto prescripto', placeholder: 'Flores' },
];

export function parseMedicoClub(v: unknown): MedicoClub {
  const out: MedicoClub = {};
  if (!v || typeof v !== 'object') return out;
  const o = v as Record<string, unknown>;
  for (const { key } of CAMPOS_MEDICO) {
    const x = o[key];
    if (typeof x === 'string' && x.trim()) out[key] = x.trim();
  }
  return out;
}
