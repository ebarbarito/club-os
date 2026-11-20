-- Sueldos: una vez cobrado el sueldo del mes, el empleado puede retirar a
-- cuenta del mes siguiente. pagar_sueldo ya no rechaza pagos que superan
-- el sueldo del mes: el tope (lo pendiente + hasta un sueldo a cuenta) lo
-- controla la aplicación, que además descuenta el excedente del mes
-- siguiente. Misma firma que antes.

create or replace function pagar_sueldo(
  p_employee_id uuid,
  p_amount      numeric,
  p_description text,
  p_payments    jsonb,
  p_salary_amount numeric default null
) returns void
language plpgsql as $$
declare
  v_tenant      uuid := current_tenant_id();
  v_employee    employees;
  v_periodo     date := date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_salary      employee_salaries;
  v_shift_id    uuid;
  v_ledger_id   uuid;
  v_pay         jsonb;
  v_rate        numeric;
  v_amount_local numeric;
begin
  select * into v_employee from employees where id = p_employee_id and tenant_id = v_tenant;
  if v_employee is null then
    raise exception 'Empleado no encontrado';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select id into v_shift_id from caja_shifts
   where tenant_id = v_tenant and kind = 'diaria' and closed_at is null
   limit 1;

  insert into employee_salaries (tenant_id, employee_id, periodo, amount)
    values (v_tenant, p_employee_id, v_periodo, coalesce(p_salary_amount, v_employee.salary))
    on conflict (tenant_id, employee_id, periodo) do nothing;

  select * into v_salary from employee_salaries
   where tenant_id = v_tenant and employee_id = p_employee_id and periodo = v_periodo;

  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_rate := coalesce((v_pay->>'exchange_rate')::numeric, 1);
    v_amount_local := (v_pay->>'amount')::numeric * v_rate;

    insert into ledger (tenant_id, shift_id, type, category, concept, amount, exchange_rate, amount_local, account_id, employee_id)
      values (
        v_tenant, v_shift_id, 'egreso', 'Sueldos',
        p_description || ' — ' || v_employee.name || ' ' || v_employee.last_name,
        (v_pay->>'amount')::numeric, v_rate, v_amount_local,
        (v_pay->>'account_id')::uuid, p_employee_id
      )
      returning id into v_ledger_id;
  end loop;

  insert into employee_salary_payments (tenant_id, salary_id, amount, description, ledger_id, created_by)
    values (v_tenant, v_salary.id, p_amount, p_description, v_ledger_id, auth.uid());

  update employee_salaries
     set paid_amount = paid_amount + p_amount,
         paid_at = case
           when paid_amount + p_amount >= amount - 0.005 then coalesce(paid_at, now())
           else paid_at
         end
   where id = v_salary.id;
end;
$$;
