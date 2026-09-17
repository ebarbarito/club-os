-- Cuenta corriente de sueldos.
-- Un "sueldo" se crea automáticamente al hacer el primer pago del mes
-- (ya sea el sueldo completo, un adelanto parcial, o cualquier pago al empleado).
-- Cada pago registra: egreso en caja (ledger) + entrada en employee_salary_payments.
-- El saldo pendiente = salary_amount - sum(payments).
begin;

create table employee_salaries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  periodo date not null,          -- primer día del mes, ej. 2026-09-01
  amount numeric not null,        -- importe del sueldo para este período
  paid_amount numeric not null default 0,
  paid_at timestamptz,            -- se llena cuando paid_amount >= amount
  note text,
  created_at timestamptz not null default now(),
  unique (tenant_id, employee_id, periodo)
);

create index employee_salaries_emp_idx on employee_salaries (tenant_id, employee_id);
create index employee_salaries_periodo_idx on employee_salaries (tenant_id, periodo);

alter table employee_salaries enable row level security;
create policy employee_salaries_tenant on employee_salaries for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create table employee_salary_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  salary_id uuid not null references employee_salaries(id) on delete cascade,
  amount numeric not null check (amount > 0),
  description text not null default 'Pago',   -- 'Sueldo', 'Adelanto', etc.
  ledger_id uuid references ledger(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create index employee_salary_payments_salary_idx on employee_salary_payments (salary_id);

alter table employee_salary_payments enable row level security;
create policy employee_salary_payments_tenant on employee_salary_payments for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Registra un pago de sueldo o adelanto.
-- Si no existe un registro de sueldo para el mes en curso, lo crea con el
-- importe base del empleado (que se puede sobreescribir via p_salary_amount).
-- p_payments = [{account_id, amount, exchange_rate}]
create function pagar_sueldo(
  p_employee_id uuid,
  p_amount      numeric,
  p_description text,
  p_payments    jsonb,
  p_salary_amount numeric default null   -- null = usar employee.salary
) returns void
language plpgsql as $$
declare
  v_tenant      uuid := current_tenant_id();
  v_employee    employees;
  v_periodo     date := date_trunc('month', now())::date;
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

  select id into v_shift_id from caja_shifts
   where tenant_id = v_tenant and kind = 'diaria' and closed_at is null
   limit 1;

  -- Crear o recuperar el sueldo del mes
  insert into employee_salaries (tenant_id, employee_id, periodo, amount)
    values (v_tenant, p_employee_id, v_periodo, coalesce(p_salary_amount, v_employee.salary))
    on conflict (tenant_id, employee_id, periodo) do nothing;

  select * into v_salary from employee_salaries
   where tenant_id = v_tenant and employee_id = p_employee_id and periodo = v_periodo;

  -- Validar que no exceda el saldo pendiente
  if v_salary.paid_amount + p_amount > v_salary.amount + 0.005 then
    raise exception 'El pago (%) excede el saldo pendiente del sueldo (%)',
      p_amount, v_salary.amount - v_salary.paid_amount;
  end if;

  -- Registrar egreso en ledger por cada cuenta de pago
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

  -- Registro en employee_salary_payments (solo una entrada por transacción)
  insert into employee_salary_payments (tenant_id, salary_id, amount, description, ledger_id, created_by)
    values (v_tenant, v_salary.id, p_amount, p_description, v_ledger_id, auth.uid());

  -- Actualizar saldo del sueldo
  update employee_salaries
     set paid_amount = paid_amount + p_amount,
         paid_at = case
           when paid_amount + p_amount >= amount - 0.005 then now()
           else paid_at
         end
   where id = v_salary.id;
end;
$$;

commit;
