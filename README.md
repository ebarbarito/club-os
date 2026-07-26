# Club OS

SaaS multi-tenant: sitio público + panel de gestión para clubes (socios,
dispensa, stock, salas/cultivo, sensores, caja/balance). Arquitectura y
decisiones en [ARCHITECTURE.md](./ARCHITECTURE.md). Referencia de diseño:
`design_handoff_club_os` (fuera de este repo).

Repo hermano: [`Sensores`](../Sensores) — firmware IoT + InfluxDB Cloud
(mismo bucket, tag `club_id` por tenant).

## Setup

1. Crear proyecto en [Supabase](https://supabase.com/dashboard), copiar
   `.env.example` a `.env.local` y completar las keys.
2. Correr `supabase/migrations/0001_init.sql` en el SQL Editor del proyecto
   (o vía `supabase db push` si usás la CLI).
3. Dar de alta el primer club:
   ```bash
   npm run tenant:create -- \
     --slug greenlevel --name "Green Level Social Club" \
     --admin-email ana@club.com --admin-name "Ana Belmonte" --admin-password "cambiar123"
   ```
4. En local, como no hay subdominios reales, seteá en `.env.local`:
   ```
   CLUB_OS_DEFAULT_TENANT=greenlevel
   ```
5. `npm run dev` → [http://localhost:3000](http://localhost:3000)

## Deploy

Vercel, proyecto `club-os` (linkeado al repo de GitHub — cada push a `main`
dispara un deploy). Producción: https://club-os-omega.vercel.app

Mientras no haya un dominio propio con DNS wildcard, el deploy sirve un
solo club (`CLUB_OS_DEFAULT_TENANT=greenlevel`) en esa URL default. Cuando
se compre un dominio: configurar wildcard `*.tuclub.app` en el proyecto de
Vercel, setear `CLUB_OS_ROOT_DOMAIN` y sacar `CLUB_OS_DEFAULT_TENANT` (o
dejarlo como fallback para el propio dominio raíz sin subdominio).

Env vars ya cargadas en Vercel (production/preview/development) — ver
`.env.example` para la lista. Redeploy manual: `npx vercel --prod`.
