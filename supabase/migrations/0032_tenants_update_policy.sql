-- Bug: el toggle de "Sitio público" en Configuración no tiraba error pero
-- tampoco cambiaba nada — `tenants` solo tenía policy de SELECT, nunca de
-- UPDATE, así que el `update` de setPublicSiteEnabled() afectaba 0 filas
-- en silencio (RLS lo filtraba). El chequeo de que sea admin ya lo hace
-- la Server Action; acá solo falta permitir el update dentro del propio
-- tenant, mismo patrón que el resto de las tablas.
create policy tenants_tenant_update on tenants for update
  using (id = current_tenant_id()) with check (id = current_tenant_id());
