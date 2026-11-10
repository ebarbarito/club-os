-- Anular una carga de manicura cargada por error (mientras el lote sigue en
-- secado). La carga no se borra: queda marcada como anulada, con quién, cuándo
-- y por qué. Se descuenta del stock general lo que había sumado y de los
-- totales del lote.

alter table lote_manicuras add column if not exists anulada_at timestamptz;
alter table lote_manicuras add column if not exists anulada_by uuid references profiles(id);
alter table lote_manicuras add column if not exists anulada_motivo text;

create or replace function lote_manicura_anular(p_id uuid, p_motivo text)
returns void
language plpgsql as $$
declare
  v_man lote_manicuras;
  v_lote lotes;
  v_strain text;
  v_disp numeric;
begin
  if nullif(trim(p_motivo), '') is null then raise exception 'Indicá el motivo de la anulación'; end if;
  select * into v_man from lote_manicuras where id = p_id for update;
  if v_man.id is null then raise exception 'Carga inexistente'; end if;
  if v_man.anulada_at is not null then raise exception 'Esta carga ya está anulada'; end if;
  select * into v_lote from lotes where id = v_man.lote_id;
  if v_lote.estado <> 'secado' then
    raise exception 'El lote % ya se cerró: la carga no se puede anular desde acá', v_lote.codigo;
  end if;
  select name into v_strain from strains where id = v_man.strain_id;

  if v_man.peso_seco > 0 then
    select grams into v_disp from stock_general where tenant_id = v_man.tenant_id and strain_id = v_man.strain_id for update;
    if coalesce(v_disp, 0) < v_man.peso_seco then
      raise exception 'En stock general de % quedan % g y la carga sumó % g (ya se envió a dispensa). Ajustá el stock antes de anular.',
        v_strain, coalesce(v_disp, 0), v_man.peso_seco;
    end if;
    perform adjust_stock_general(
      v_man.strain_id, 'remove', v_man.peso_seco,
      'Anulación manicura lote ' || v_lote.codigo || ' · ' || to_char(v_man.fecha, 'DD/MM') || ' · ' || trim(p_motivo)
    );
  end if;

  update lote_pesajes
    set peso_seco = greatest(0, coalesce(peso_seco, 0) - v_man.peso_seco),
        peso_trim = case when v_man.peso_trim is null then peso_trim
                         else nullif(greatest(0, coalesce(peso_trim, 0) - v_man.peso_trim), 0) end
    where lote_id = v_man.lote_id and strain_id = v_man.strain_id;

  update lote_manicuras
    set anulada_at = now(), anulada_by = auth.uid(), anulada_motivo = trim(p_motivo)
    where id = p_id;

  insert into cultivo_movimientos (tenant_id, tipo, sala_origen_id, lote_id, strain_id, plantas, gramos, nota)
    values (
      v_man.tenant_id, 'ajuste', v_lote.sala_id, v_man.lote_id, v_man.strain_id, v_man.plantas, -v_man.peso_seco,
      'Anulada la manicura del ' || to_char(v_man.fecha, 'DD/MM') || ' · ' || trim(p_motivo)
    );
end;
$$;
