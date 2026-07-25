-- profiles_self era demasiado restrictiva: bloqueaba ver el nombre de un
-- compañero de equipo en joins normales (ej. "quién registró esta dispensa",
-- pantalla Usuarios). Un club es un equipo chico — está bien que se vean
-- entre sí dentro del mismo tenant.
drop policy profiles_self on profiles;

create policy profiles_tenant_read on profiles
  for select using (tenant_id = current_tenant_id());
