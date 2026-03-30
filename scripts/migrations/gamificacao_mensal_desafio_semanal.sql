-- Gamificacao mensal com desafio semanal.
-- Objetivo: manter o desafio/progresso semanal e mover pontuacao geral/ranking para o mes corrente.

CREATE OR REPLACE FUNCTION public.gamificacao_mes_inicio(p_dia date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc('month', p_dia::timestamp)::date;
$$;

CREATE OR REPLACE FUNCTION public.gamificacao_pontos_ranking_mes(p_usuario_id uuid, p_mes date)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH limites AS (
    SELECT
      public.gamificacao_mes_inicio(p_mes) AS mes_inicio,
      (public.gamificacao_mes_inicio(p_mes) + interval '1 month')::date AS mes_fim
  ),
  actividade AS (
    SELECT COALESCE(sum(dr.pontos_total), 0)::int AS pontos
    FROM public.gamificacao_dia_resumo dr
    CROSS JOIN limites l
    WHERE dr.usuario_id = p_usuario_id
      AND dr.dia >= l.mes_inicio
      AND dr.dia < l.mes_fim
  ),
  bonus AS (
    SELECT COALESCE(sum(ds.bonus_pontos), 0)::int AS pontos
    FROM public.gamificacao_desafio_progresso dp
    JOIN public.gamificacao_desafio_semanal ds
      ON ds.semana_inicio = dp.semana_inicio
    CROSS JOIN limites l
    WHERE dp.usuario_id = p_usuario_id
      AND dp.bonus_aplicado = true
      AND dp.semana_inicio >= l.mes_inicio
      AND dp.semana_inicio < l.mes_fim
  )
  SELECT (a.pontos + b.pontos)::int
  FROM actividade a
  CROSS JOIN bonus b;
$$;

CREATE OR REPLACE FUNCTION public.rpc_gamificacao_resumo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_semana date;
  v_hoje date;
  v_mes date;
  v_mes_fim date;
  v_act_semana int;
  v_act_mes int;
  v_det_semana jsonb;
  v_dp record;
  v_des record;
  v_pos bigint;
  v_participantes bigint;
  v_total int;
  v_bonus_mes int;
  v_opt_in boolean;
BEGIN
  SELECT u.id, u.ranking_opt_in
  INTO v_uid, v_opt_in
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usuario_nao_encontrado');
  END IF;

  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_semana := public.gamificacao_semana_inicio(v_hoje);
  v_mes := public.gamificacao_mes_inicio(v_hoje);
  v_mes_fim := (v_mes + interval '1 month')::date;

  PERFORM public.gamificacao_recalc_usuario_dia(v_uid, v_hoje);

  -- Mantem detalhe semanal para o card de desafio.
  SELECT gps.pontos, COALESCE(gps.detalhe, '{}'::jsonb)
  INTO v_act_semana, v_det_semana
  FROM public.gamificacao_pontos_semana gps
  WHERE gps.usuario_id = v_uid AND gps.semana_inicio = v_semana;

  IF NOT FOUND THEN
    v_act_semana := 0;
    v_det_semana := '{}'::jsonb;
  END IF;

  -- Actividade geral passa a ser mensal.
  SELECT COALESCE(sum(dr.pontos_total), 0)::int
  INTO v_act_mes
  FROM public.gamificacao_dia_resumo dr
  WHERE dr.usuario_id = v_uid
    AND dr.dia >= v_mes
    AND dr.dia < v_mes_fim;

  SELECT COALESCE(sum(ds.bonus_pontos), 0)::int
  INTO v_bonus_mes
  FROM public.gamificacao_desafio_progresso dp
  JOIN public.gamificacao_desafio_semanal ds
    ON ds.semana_inicio = dp.semana_inicio
  WHERE dp.usuario_id = v_uid
    AND dp.bonus_aplicado = true
    AND dp.semana_inicio >= v_mes
    AND dp.semana_inicio < v_mes_fim;

  SELECT * INTO v_dp
  FROM public.gamificacao_desafio_progresso
  WHERE usuario_id = v_uid AND semana_inicio = v_semana;

  SELECT * INTO v_des
  FROM public.gamificacao_desafio_semanal
  WHERE semana_inicio = v_semana;

  v_total := COALESCE(v_act_mes, 0) + COALESCE(v_bonus_mes, 0);

  IF v_opt_in THEN
    SELECT COUNT(*) INTO v_participantes
    FROM public.usuarios u2
    WHERE u2.ranking_opt_in = true;

    SELECT COUNT(*) + 1 INTO v_pos
    FROM public.usuarios u2
    WHERE u2.ranking_opt_in = true
      AND public.gamificacao_pontos_ranking_mes(u2.id, v_mes) > v_total;
  ELSE
    v_participantes := 0;
    v_pos := 0;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'mes_inicio', v_mes,
    'semana_inicio', v_semana,
    'pontos_mes', v_total,
    'pontos_actividade_mes', COALESCE(v_act_mes, 0),
    'pontos_bonus_desafio_mes', COALESCE(v_bonus_mes, 0),
    -- Alias de compatibilidade (remover num ciclo futuro).
    'pontos_semana', v_total,
    'pontos_actividade', COALESCE(v_act_mes, 0),
    'pontos_bonus_desafio', COALESCE(v_bonus_mes, 0),
    'detalhe', v_det_semana,
    'ranking_opt_in', v_opt_in,
    'posicao_ranking', v_pos,
    'participantes_ranking', v_participantes,
    'desafio', jsonb_build_object(
      'titulo', COALESCE(v_des.titulo, 'Desafio da semana'),
      'min_dias_atividade', COALESCE(v_des.min_dias_atividade, 5),
      'min_treinos', COALESCE(v_des.min_treinos, 2),
      'min_dias_macros', COALESCE(v_des.min_dias_macros, 3),
      'bonus_pontos', COALESCE(v_des.bonus_pontos, 25),
      'progresso', CASE WHEN v_dp.usuario_id IS NULL THEN NULL ELSE jsonb_build_object(
        'dias_atividade', v_dp.dias_atividade,
        'treinos_semana', v_dp.treinos_semana,
        'dias_macros', v_dp.dias_macros,
        'completo', v_dp.completo
      ) END
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_gamificacao_leaderboard(p_limit integer DEFAULT 20)
RETURNS TABLE (
  posicao bigint,
  usuario_id uuid,
  display_label text,
  pontos integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT u.ranking_opt_in
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  ),
  mes AS (
    SELECT public.gamificacao_mes_inicio((now() AT TIME ZONE 'America/Sao_Paulo')::date) AS m
  ),
  ranked AS (
    SELECT
      u.id AS uid,
      public.gamificacao_pontos_ranking_mes(u.id, mes.m) AS pts
    FROM public.usuarios u
    CROSS JOIN mes
    WHERE u.ranking_opt_in = true
      AND (SELECT ranking_opt_in FROM me) = true
  )
  SELECT
    row_number() OVER (ORDER BY r.pts DESC, r.uid) AS posicao,
    r.uid AS usuario_id,
    COALESCE(
      NULLIF(trim(u.display_name), ''),
      NULLIF(split_part(trim(COALESCE(u.email, '')), '@', 1), ''),
      'Aluno'
    ) AS display_label,
    r.pts::integer AS pontos
  FROM ranked r
  JOIN public.usuarios u ON u.id = r.uid
  WHERE r.pts > 0
  ORDER BY r.pts DESC, r.uid
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

GRANT EXECUTE ON FUNCTION public.rpc_gamificacao_resumo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_gamificacao_leaderboard(integer) TO authenticated;
