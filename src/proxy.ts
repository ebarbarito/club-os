import { NextResponse, type NextRequest } from 'next/server';
import { slugFromHost } from '@/lib/tenant/resolve';

export function proxy(request: NextRequest) {
  const slug = slugFromHost(request.headers.get('host'));

  if (!slug) {
    // Sin tenant resuelto: fuera del root domain o falta ?tenant en local.
    // TODO: página de marketing propia del producto (no de un club) en '/'.
    return NextResponse.next();
  }

  // Seteamos el header en la request (no en la response): así queda
  // disponible para headers() en Server Components río abajo, que es
  // donde layout.tsx/page.tsx lo leen.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-club-os-tenant-slug', slug);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
