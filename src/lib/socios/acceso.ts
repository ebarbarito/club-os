import { createAdminClient } from '@/lib/supabase/admin';
import { enviarMail } from '@/lib/mail';
import { MAX_ENVIOS_DIA, PROVISORIA_MINUTOS, generarClaveProvisoria, hashClave } from './clave';

type Admin = ReturnType<typeof createAdminClient>;

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function mailValido(email: string | null | undefined): email is string {
  return !!email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

function hoyAR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

// Genera una clave provisoria para el socio y se la manda a su mail.
// La usa el sitio ("Recibir mi clave") y el panel ("Enviar acceso por mail").
// porAdmin: el panel no tiene tope diario (sí la espera de un minuto).
export async function emitirClaveProvisoria(
  admin: Admin,
  datos: {
    tenant: { id: string; name: string };
    member: { id: string; name: string | null; email: string };
    baseUrl: string;
    porAdmin?: boolean;
  },
): Promise<{ error?: string }> {
  const { tenant, member, baseUrl } = datos;
  const { data: acceso } = await admin
    .from('member_accesos')
    .select('clave_temp_enviada_at, envios_fecha, envios_dia')
    .eq('member_id', member.id)
    .maybeSingle();

  if (acceso?.clave_temp_enviada_at && Date.now() - new Date(acceso.clave_temp_enviada_at).getTime() < 60_000) {
    return { error: 'Ya se envió una clave hace menos de un minuto. Esperá un momento y revisá el correo.' };
  }
  const hoy = hoyAR();
  const enviosHoy = acceso?.envios_fecha === hoy ? acceso.envios_dia : 0;
  if (!datos.porAdmin && enviosHoy >= MAX_ENVIOS_DIA) {
    return { error: 'Se pidieron demasiadas claves hoy. Probá mañana o escribinos.' };
  }

  const clave = generarClaveProvisoria();
  const ahora = new Date();
  const { error } = await admin.from('member_accesos').upsert(
    {
      member_id: member.id,
      tenant_id: tenant.id,
      clave_temp_hash: await hashClave(clave),
      clave_temp_expira: new Date(ahora.getTime() + PROVISORIA_MINUTOS * 60_000).toISOString(),
      clave_temp_enviada_at: ahora.toISOString(),
      envios_fecha: hoy,
      envios_dia: enviosHoy + 1,
      updated_at: ahora.toISOString(),
    },
    { onConflict: 'member_id' },
  );
  if (error) return { error: error.message };

  const link = `${baseUrl}/socios/ingresar`;
  const nombre = (member.name ?? '').trim().split(/\s+/)[0] ?? '';
  const saludo = nombre ? `¡Hola ${nombre}!` : '¡Hola!';
  const claveLinda = `${clave.slice(0, 4)}-${clave.slice(4)}`;

  return enviarMail({
    to: member.email.trim(),
    fromName: tenant.name,
    subject: `Tu clave para ingresar a ${tenant.name}`,
    text: [
      saludo,
      '',
      `Esta es tu clave provisoria para ingresar al sitio de socios de ${tenant.name}:`,
      '',
      `    ${claveLinda}`,
      '',
      `Ingresá en ${link} con tu DNI y esta clave. Vence en ${PROVISORIA_MINUTOS} minutos y sirve una sola vez:`,
      'al entrar vas a crear tu contraseña definitiva.',
      '',
      'Si no la pediste vos, ignorá este mail.',
    ].join('\n'),
    html: `<!doctype html><html><body style="margin:0;background:#f4f1e8;font-family:Arial,Helvetica,sans-serif;color:#1f2a24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0f3d2a;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:bold">${esc(tenant.name)}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px;font-size:16px">${esc(saludo)}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Esta es tu clave provisoria para ingresar al sitio de socios:</p>
<p style="margin:0 0 16px;text-align:center"><span style="display:inline-block;font-family:'Courier New',monospace;font-size:28px;letter-spacing:4px;font-weight:bold;background:#f4f1e8;border-radius:8px;padding:12px 20px">${claveLinda}</span></p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Ingresá con tu <b>DNI</b> y esta clave. Vence en <b>${PROVISORIA_MINUTOS} minutos</b> y sirve una sola vez: al entrar vas a crear tu contraseña definitiva.</p>
<p style="margin:0 0 20px;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:#0f3d2a;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:8px;padding:12px 24px">Ingresar</a></p>
<p style="margin:0;font-size:13px;color:#6b746e">Si no la pediste vos, ignorá este mail.</p>
</td></tr></table></td></tr></table></body></html>`,
  });
}
