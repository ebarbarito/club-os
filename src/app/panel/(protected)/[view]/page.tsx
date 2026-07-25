import { notFound, redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES, TITLES, isViewId } from '@/lib/roles';

export default async function ViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!isViewId(view)) notFound();

  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');

  const role = ROLES[profile.role];
  if (!role.nav.includes(view)) redirect(`/panel/${role.home}`);

  const [title, subtitle] = TITLES[view];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text">{title}</h1>
      <p className="text-text-soft mb-6">{subtitle}</p>
      <div className="rounded-xl border border-dashed border-line-2 p-10 text-center text-text-mute">
        Pantalla en construcción.
      </div>
    </div>
  );
}
