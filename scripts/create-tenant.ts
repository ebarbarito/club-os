// Alta manual de un club nuevo (tenant) — decisión: sin UI de super-admin,
// vos corrés este script cada vez que sumás un cliente.
//
// Uso:
//   npm run tenant:create -- \
//     --slug greenlevel --name "Green Level Social Club" \
//     --primary "#1c5c41" --accent "#c9a14a" --dark "#0a261b" --bg "#f6f3ea" \
//     --logo "https://.../logo.png" \
//     --admin-email ana@club.com --admin-name "Ana Belmonte" --admin-password "cambiar123"
import { config } from 'dotenv';
import { createAdminClient } from '../src/lib/supabase/admin';

config({ path: '.env.local' });

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (!value) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Falta --${name}`);
  }
  return value;
}

async function main() {
  const slug = arg('slug');
  const name = arg('name');
  const logo_url = arg('logo', '');
  const theme = {
    primary: arg('primary', '#1c5c41'),
    accent: arg('accent', '#c9a14a'),
    dark: arg('dark', '#0a261b'),
    bg: arg('bg', '#f6f3ea'),
  };
  const adminEmail = arg('admin-email');
  const adminName = arg('admin-name');
  const adminPassword = arg('admin-password');

  const supabase = createAdminClient();

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ slug, name, logo_url: logo_url || null, theme })
    .select()
    .single();
  if (tenantError) throw tenantError;
  console.log(`Tenant creado: ${tenant.id} (${tenant.slug})`);

  const { data: userRes, error: userError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });
  if (userError) throw userError;

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userRes.user.id,
    tenant_id: tenant.id,
    name: adminName,
    role: 'admin',
  });
  if (profileError) throw profileError;

  console.log(`Usuario admin creado: ${adminEmail}`);
  console.log(`Club disponible en: https://${slug}.${process.env.CLUB_OS_ROOT_DOMAIN ?? 'tuclub.app'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
