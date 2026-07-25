import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { ROLES } from '@/lib/roles';

export default async function AppIndex() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/panel/login');
  redirect(`/panel/${ROLES[profile.role].home}`);
}
