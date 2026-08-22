-- Datos de demo para el tenant "test" (Test Club) — catalogo, stock,
-- salas y socios. No es una migracion de esquema; es carga de datos
-- puntual para que la cuenta de demo tenga contenido para mostrar.
do $$
declare
  v_tenant uuid := '9204df5e-a559-40bc-8bac-17f0e3893852';
  v_efectivo uuid := '85b035a0-7163-41ea-9c8d-0102c7d839d0';
  v_transferencia uuid := 'a4be04c6-5bd8-42a7-9e53-68314dfcb665';
  v_mpgl uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_a1 uuid; v_a2 uuid;
begin
  -- Una tercera cuenta para que el split de pagos se vea completo.
  insert into payment_accounts (tenant_id, name, currency, exchange_rate, is_cash)
    values (v_tenant, 'MP', 'ARS', 1, false)
    returning id into v_mpgl;

  -- Catalogo
  insert into strains (tenant_id, code, name, item_type, type, thc, cbd, cross_info, composition, aroma, effects, notes, price_per_gram, status)
    values (v_tenant, 'G001', 'Blue Dream', 'genetica', 'Híbrida', 19, 1, 'Blueberry x Haze', 'Sativa dominante', 'Frutos del bosque, dulce', 'Relajante · Creativo · Eufórico', 'Muy pedida, buena entrada para nuevos socios', 11000, 'activa')
    returning id into v_s1;
  insert into strains (tenant_id, code, name, item_type, type, thc, cbd, cross_info, composition, aroma, effects, notes, price_per_gram, status)
    values (v_tenant, 'G002', 'OG Kush', 'genetica', 'Indica', 22, 0.5, 'Chemdawg x Hindu Kush x Lemon Thai', 'Indica dominante', 'Terroso, pino, cítrico', 'Relajante · Analgésico · Sedante', 'Ideal para la noche', 12500, 'activa')
    returning id into v_s2;
  insert into strains (tenant_id, code, name, item_type, type, thc, cbd, cross_info, composition, aroma, effects, notes, price_per_gram, status)
    values (v_tenant, 'G003', 'Green Crack', 'genetica', 'Sativa', 20, 0.3, 'Skunk #1 x Afghani', 'Sativa dominante', 'Cítrico, mango', 'Energizante · Enfocado · Social', 'Buena para el día', 12000, 'activa')
    returning id into v_s3;
  insert into strains (tenant_id, code, name, item_type, price_per_gram, status)
    values (v_tenant, 'A001', 'Papel de armar', 'accesorio', 500, 'activa')
    returning id into v_a1;
  insert into strains (tenant_id, code, name, item_type, price_per_gram, status)
    values (v_tenant, 'A002', 'Encendedor', 'accesorio', 1500, 'activa')
    returning id into v_a2;

  insert into stock (tenant_id, strain_id, grams, min_grams) values
    (v_tenant, v_s1, 85, 30),
    (v_tenant, v_s2, 60, 30),
    (v_tenant, v_s3, 40, 30),
    (v_tenant, v_a1, 120, 20),
    (v_tenant, v_a2, 45, 10);

  insert into stock_general (tenant_id, strain_id, grams) values
    (v_tenant, v_s1, 200),
    (v_tenant, v_s2, 150),
    (v_tenant, v_s3, 100),
    (v_tenant, v_a1, 300),
    (v_tenant, v_a2, 100);

  -- Salas
  insert into salas (tenant_id, name, etapa, etapa_dias, capacity, temp_min, temp_max, hum_min, hum_max, responsable, cosecha_estimada)
    values (v_tenant, 'Vegetativo A', 'vegetativo', 18, 40, 22, 26, 55, 68, 'Equipo de cultivo', current_date + 45);
  insert into salas (tenant_id, name, etapa, etapa_dias, capacity, temp_min, temp_max, hum_min, hum_max, responsable, cosecha_estimada)
    values (v_tenant, 'Floración 1', 'floracion', 34, 30, 20, 25, 45, 55, 'Equipo de cultivo', current_date + 20);
  insert into salas (tenant_id, name, etapa, etapa_dias, capacity, temp_min, temp_max, hum_min, hum_max, responsable, cosecha_estimada)
    values (v_tenant, 'Secado', 'secado', 6, 20, 18, 21, 50, 60, 'Equipo de cultivo', current_date + 3);

  -- Socios (numeracion automatica via trigger)
  insert into members (tenant_id, name, dni, phone, email, address, reprocann, reprocann_type, status, alta_date) values
    (v_tenant, 'Martina Gómez', '34112233', '1155501122', 'martina.gomez@example.com', 'San Martín 450, CABA', 'vigente', 'autocultivador', 'valid', now() - interval '210 days'),
    (v_tenant, 'Lucas Fernández', '35223344', '1155502233', 'lucas.fernandez@example.com', 'Rivadavia 1200, CABA', 'vigente', 'autocultivador', 'valid', now() - interval '195 days'),
    (v_tenant, 'Sofía Ramírez', '36334455', '1155503344', 'sofia.ramirez@example.com', 'Corrientes 3300, CABA', 'tramite', 'paciente', 'valid', now() - interval '180 days'),
    (v_tenant, 'Tomás Ibáñez', '37445566', '1155504455', 'tomas.ibanez@example.com', 'Belgrano 900, CABA', 'vigente', 'autocultivador', 'valid', now() - interval '150 days'),
    (v_tenant, 'Julieta Torres', '38556677', '1155505566', 'julieta.torres@example.com', 'Scalabrini Ortiz 250, CABA', 'vigente', 'autocultivador', 'valid', now() - interval '120 days'),
    (v_tenant, 'Nicolás Herrera', '39667788', '1155506677', 'nicolas.herrera@example.com', 'Directorio 800, CABA', 'no', 'autocultivador', 'draft', now() - interval '90 days'),
    (v_tenant, 'Agustina López', '40778899', '1155507788', 'agustina.lopez@example.com', 'Warnes 60, CABA', 'vigente', 'paciente', 'valid', now() - interval '60 days'),
    (v_tenant, 'Franco Medina', '41889900', '1155508899', 'franco.medina@example.com', 'Boedo 1400, CABA', 'tramite', 'autocultivador', 'pending', now() - interval '10 days');
end $$;
