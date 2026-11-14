import tls from 'node:tls';
import { randomBytes } from 'node:crypto';

// Envío de mails del club, sin dependencias externas. Se usa el primero
// que esté configurado en las variables de entorno (Vercel):
//
//   Resend:  RESEND_API_KEY + MAIL_FROM (ej. no-responder@gl.miclub.site)
//   Gmail:   GMAIL_USER + GMAIL_APP_PASSWORD (contraseña de aplicación de
//            la cuenta, con verificación en dos pasos activada)
//
// Si no hay ninguno, devuelve un error claro y no manda nada.

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Nombre que ve el socio como remitente ("Green Level Social Club").
  fromName: string;
};

export function mailConfigurado(): 'resend' | 'gmail' | null {
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return 'resend';
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  return null;
}

export async function enviarMail(mail: Mail): Promise<{ error?: string }> {
  const via = mailConfigurado();
  if (!via) return { error: 'El envío de mails todavía no está configurado (faltan los datos en Vercel).' };
  try {
    if (via === 'resend') return await porResend(mail);
    return await porGmail(mail);
  } catch (e) {
    console.error('[mail] error al enviar', e);
    return { error: 'No se pudo enviar el mail. Probá de nuevo en unos minutos.' };
  }
}

async function porResend(mail: Mail): Promise<{ error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${mail.fromName} <${process.env.MAIL_FROM}>`,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  if (!res.ok) {
    console.error('[mail] resend', res.status, await res.text().catch(() => ''));
    return { error: 'No se pudo enviar el mail. Probá de nuevo en unos minutos.' };
  }
  return {};
}

// ── Gmail por SMTP (smtp.gmail.com:465, TLS directo) ───────────────────────

function b64(s: string) {
  return Buffer.from(s, 'utf8').toString('base64');
}

function encabezado(s: string) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}

function cuerpoB64(s: string) {
  return b64(s).replace(/.{1,76}/g, '$&\r\n');
}

function armarMensaje(mail: Mail, from: string) {
  const limite = `club-${randomBytes(12).toString('hex')}`;
  const dominio = from.split('@')[1] ?? 'localhost';
  return [
    `From: ${encabezado(mail.fromName)} <${from}>`,
    `To: <${mail.to}>`,
    `Subject: ${encabezado(mail.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${dominio}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    '',
    `--${limite}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    cuerpoB64(mail.text),
    `--${limite}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    cuerpoB64(mail.html),
    `--${limite}--`,
    '',
  ].join('\r\n');
}

async function porGmail(mail: Mail): Promise<{ error?: string }> {
  const user = process.env.GMAIL_USER!;
  const pass = process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, '');
  if (/[\r\n<>]/.test(mail.to)) return { error: 'Dirección de mail inválida' };

  const host = 'smtp.gmail.com';
  const socket = tls.connect({ host, port: 465, servername: host });
  socket.setEncoding('utf8');
  socket.setTimeout(20_000);

  let pendiente = '';
  const esperando: ((linea: string) => void)[] = [];
  const lineas: string[] = [];
  socket.on('data', (chunk: string) => {
    pendiente += chunk;
    let i;
    while ((i = pendiente.indexOf('\r\n')) >= 0) {
      const linea = pendiente.slice(0, i);
      pendiente = pendiente.slice(i + 2);
      const w = esperando.shift();
      if (w) w(linea);
      else lineas.push(linea);
    }
  });
  const fallo = new Promise<never>((_, reject) => {
    socket.on('error', reject);
    socket.on('timeout', () => reject(new Error('SMTP: tiempo de espera agotado')));
    socket.on('close', () => reject(new Error('SMTP: conexión cerrada')));
  });
  fallo.catch(() => {});

  function linea(): Promise<string> {
    const l = lineas.shift();
    if (l !== undefined) return Promise.resolve(l);
    return Promise.race([new Promise<string>((r) => esperando.push(r)), fallo]);
  }
  // Respuesta completa (las multilínea vienen como "250-..." hasta "250 ...").
  async function respuesta(esperado: number) {
    let l = await linea();
    const texto = [l];
    while (/^\d{3}-/.test(l)) {
      l = await linea();
      texto.push(l);
    }
    const codigo = Number(l.slice(0, 3));
    if (codigo !== esperado) throw new Error(`SMTP: se esperaba ${esperado} y llegó ${texto.join(' | ')}`);
  }
  async function comando(cmd: string, esperado: number) {
    socket.write(cmd + '\r\n');
    await respuesta(esperado);
  }

  try {
    await respuesta(220);
    await comando('EHLO club-os', 250);
    await comando(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}`, 235);
    await comando(`MAIL FROM:<${user}>`, 250);
    await comando(`RCPT TO:<${mail.to}>`, 250);
    await comando('DATA', 354);
    const datos = armarMensaje(mail, user).replace(/^\./gm, '..');
    socket.write(datos + '\r\n.\r\n');
    await respuesta(250);
    socket.write('QUIT\r\n');
    return {};
  } finally {
    socket.end();
  }
}
