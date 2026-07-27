import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';
import { ModalTrigger } from '@/components/modal-trigger';
import { CreateUserForm } from './create-user-form';
import { DeleteUserButton } from './delete-user-button';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  dispensador: 'Dispensador/a',
  cultivo: 'Cultivo',
};

export default async function UsuariosPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  if (profile.role !== 'admin') redirect(`/panel/${ROLES[profile.role].home}`);

  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('id, name, role').order('name');

  // getUserById en vez de listUsers(): listUsers() pagina de a 50 usuarios
  // de TODO el proyecto (todos los tenants juntos) — con más clubes/usuarios
  // rompería en silencio para tenants que caigan fuera de la primera página.
  const admin = createAdminClient();
  const emailEntries = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      return [p.id, data.user?.email] as const;
    }),
  );
  const emailById = new Map(emailEntries);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Usuarios</h1>
          <p className="text-text-soft">Cuentas del equipo</p>
        </div>
        <ModalTrigger label="+ Nuevo usuario" title="Nuevo usuario">
          <CreateUserForm />
        </ModalTrigger>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-soft text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Perfil</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-medium text-text">{p.name}</td>
                <td className="px-4 py-2.5 text-text-soft">{emailById.get(p.id) ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-soft">{ROLE_LABEL[p.role]}</td>
                <td className="px-4 py-2.5 text-right">
                  {p.id !== profile.userId && <DeleteUserButton userId={p.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
