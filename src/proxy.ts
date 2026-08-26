import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { slugFromHost } from '@/lib/tenant/resolve';

export async function proxy(request: NextRequest) {
  const slug = slugFromHost(request.headers.get('host'));

  const requestHeaders = new Headers(request.headers);
  if (slug) {
    // Sin slug: fuera del root domain, o el dominio raiz mismo (landing
    // de producto) — no hay tenant que header-inyectar.
    requestHeaders.set('x-club-os-tenant-slug', slug);
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Refresca el token de sesion y lo persiste en las cookies del browser.
  // Sin esto, un Server Component puede refrescarlo en memoria para SU
  // propia respuesta (createClient() en src/lib/supabase/server.ts no
  // puede escribir cookies fuera de una Server Action), pero el browser
  // nunca se entera del token nuevo — tarde o temprano la sesion vieja
  // vence y el usuario aparece afuera sin aviso, como si "se cerrara
  // sola" la pantalla en la que estaba.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
