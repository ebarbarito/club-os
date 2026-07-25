# Arquitectura — Club OS

Producto SaaS multi-tenant: cada club (cliente) tiene su sitio público +
panel de gestión (Club OS), con tema/logo propios. Referencia de diseño y
modelo de negocio: `design_handoff_club_os` (fuera de este repo).

## Decisiones (resueltas vía /grill-me)

| Área | Decisión | Motivo |
|---|---|---|
| Alcance | Multi-tenant (varios clubes) | Producto vendible a más de un club, no solo uso propio |
| Alta de tenant | Manual, script `npm run tenant:create` con `service_role` | Pocos clubes al inicio; UI de super-admin no rinde todavía |
| Dominio | Subdominio `{slug}.tuclub.app` (wildcard) | Cero fricción de DNS al dar de alta un club nuevo |
| DB de negocio | Postgres compartida (Supabase) + `tenant_id` en cada tabla + RLS | Evita migraciones/conexiones ×N de una DB por tenant |
| Backend services | Supabase (Postgres + Auth + Storage) | Auth multi-tenant y storage con RLS ya integrados, un solo proveedor |
| Framework | Next.js (App Router) en Vercel, repo separado de `Sensores` | Sensores es IoT genérico; Club OS es el producto de negocio — solo se integran vía API/Influx |
| Sensores (series temporales) | Siguen en InfluxDB Cloud (repo `Sensores`), mismo bucket + tag `club_id` además de `sensor` | Consistente con Postgres compartido+RLS: un solo proxy, filtro por tenant en la query Flux |
| Pagos | Ninguna pasarela por ahora, registro manual (efectivo/transferencia) | Cannabis social clubs en zona gris legal en Argentina — muchas pasarelas lo restringen en sus TyC |
| Tema por club | Paleta configurable (primary/accent/dark/bg) + logo, no temas predefinidos múltiples | Es lo pedido; reusa los design tokens ya definidos en el handoff |
| Styling | Tailwind v4, tokens CSS por tenant inyectados en runtime | Acelera recrear las ~10 pantallas del handoff sin perder theming dinámico |
| Orden de build | Fundaciones (tenant/auth/DB/theming) → Club OS (panel) → sitio público | Sin tenant/auth/RLS resueltas, cualquier pantalla necesita retoque después |

## Cómo fluye una request

```
{slug}.tuclub.app
      │
      ▼
middleware.ts ── resuelve slug del host → header x-club-os-tenant-slug
      │
      ▼
layout.tsx (Server Component) ── getTenantBySlug(slug) [lectura pública, sin auth]
      │                           inyecta TenantThemeStyle (colores) + logo
      ▼
Server Components / Route Handlers ── createClient() de src/lib/supabase/server.ts
      │                                usa el JWT del usuario logueado
      ▼
Postgres (Supabase) ── RLS: current_tenant_id() = profiles.tenant_id del usuario
                        (ver supabase/migrations/0001_init.sql)
```

Para sensores en vivo: el panel Club OS consulta un proxy Influx (mismo
patrón que `Sensores/frontend/medidor-th/api/influx/[...path].ts`), agregando
el filtro `club_id` a la query Flux según el tenant actual — no se abre el
token de Influx al cliente.

## Aislamiento multi-tenant

- Cada tabla de negocio tiene `tenant_id` + policy RLS `for all` que exige
  `tenant_id = current_tenant_id()`.
- `current_tenant_id()` resuelve el tenant leyendo `profiles` por
  `auth.uid()` — un usuario nunca puede ver ni mutar filas de otro club.
- La tabla `tenants` es de lectura pública (branding: slug/name/logo/theme)
  porque el sitio público de cada club debe poder mostrarse sin login.
- RLS acá aísla **tenants entre sí**, no permisos por **rol** dentro de un
  mismo club (admin/dispensador/cultivo) — eso se controla en la app
  (middleware + `profiles.role`), no a nivel de fila.

## Estructura

```
src/
  middleware.ts              resuelve subdominio → tenant
  lib/
    tenant/                  resolve.ts, get-tenant.ts, theme.tsx, types.ts
    supabase/                client.ts (browser), server.ts (SSR/RLS), admin.ts (service_role, scripts)
  app/                       Next.js App Router
supabase/
  migrations/0001_init.sql   schema completo + RLS
scripts/
  create-tenant.ts           alta manual de club (tenant + primer admin)
```

## Pendiente / próximos pasos

1. Crear proyecto Supabase real, correr `supabase/migrations/0001_init.sql`,
   completar `.env.local` (ver `.env.example`).
2. Dar de alta el primer tenant real (Green Level) con `npm run tenant:create`.
3. Login (Supabase Auth) + selector de perfil según `profiles.role`.
4. Pantallas de Club OS (Resumen, Dispensa, Socios, Stock, Salas, Sensores,
   Caja, Balance, Usuarios) — ver detalle de cada una en el handoff.
5. Proxy Influx multi-tenant (adaptar `api/influx` de `Sensores`, agregar
   filtro `club_id`).
6. Recién después: sitio público (catálogo, reserva, alta de socio).
