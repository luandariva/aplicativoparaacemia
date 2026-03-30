import { supabase } from './supabase'

function postgrestErrorMessage(error) {
  if (!error) return ''
  const bits = [error.message, error.details, error.hint].filter(Boolean)
  const msg = bits.join(' — ')
  if (error.code) return `${msg} (${error.code})`
  return msg
}

/** Primeiro dia do mês seguinte (exclusivo), para filtros `dia < mesFim`. */
function gamificacaoMesFimExclusive(mesInicio) {
  if (!mesInicio || typeof mesInicio !== 'string') return null
  const [y, m] = mesInicio.split('-').map(Number)
  if (!y || !m) return null
  const nm = m === 12 ? 1 : m + 1
  const ny = m === 12 ? y + 1 : y
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

/**
 * Lista movimentações do mês (pontos por dia + bônus de desafios concluídos),
 * ordenadas da mais recente para a mais antiga.
 */
export async function fetchGamificacaoMovimentacoesMes(usuarioId, mesInicio) {
  if (!usuarioId || !mesInicio) return { error: null, data: [] }
  const mesFim = gamificacaoMesFimExclusive(mesInicio)
  if (!mesFim) return { error: null, data: [] }

  const [drRes, dpRes] = await Promise.all([
    supabase
      .from('gamificacao_dia_resumo')
      .select('dia, pontos_consistencia, pontos_macros, pontos_treino, pontos_total, treinos_no_dia')
      .eq('usuario_id', usuarioId)
      .gte('dia', mesInicio)
      .lt('dia', mesFim)
      .gt('pontos_total', 0)
      .order('dia', { ascending: false }),
    supabase
      .from('gamificacao_desafio_progresso')
      .select('semana_inicio, gamificacao_desafio_semanal ( bonus_pontos, titulo )')
      .eq('usuario_id', usuarioId)
      .eq('bonus_aplicado', true)
      .gte('semana_inicio', mesInicio)
      .lt('semana_inicio', mesFim)
      .order('semana_inicio', { ascending: false }),
  ])

  if (drRes.error) return { error: postgrestErrorMessage(drRes.error), data: null }
  if (dpRes.error) return { error: postgrestErrorMessage(dpRes.error), data: null }

  const rows = drRes.data || []
  const items = []

  for (const row of rows) {
    const dia = row.dia
    let ord = 0
    if (row.pontos_consistencia > 0) {
      items.push({
        tipo: 'registro',
        data: dia,
        dataOrdem: dia,
        titulo: 'Registro diário',
        pontos: row.pontos_consistencia,
        ordemNoDia: ord++,
      })
    }
    if (row.pontos_macros > 0) {
      items.push({
        tipo: 'macros',
        data: dia,
        dataOrdem: dia,
        titulo: 'Macros no alvo',
        pontos: row.pontos_macros,
        ordemNoDia: ord++,
      })
    }
    const nTreinosLinhas = Math.min(Number(row.treinos_no_dia) || 0, 2)
    for (let t = 0; t < nTreinosLinhas; t++) {
      items.push({
        tipo: 'treino',
        data: dia,
        dataOrdem: dia,
        titulo: 'Treino concluído',
        pontos: 20,
        ordemNoDia: ord++,
      })
    }
  }

  const progRows = dpRes.data || []
  for (const pr of progRows) {
    const ds = Array.isArray(pr.gamificacao_desafio_semanal)
      ? pr.gamificacao_desafio_semanal[0]
      : pr.gamificacao_desafio_semanal
    const bonus = ds?.bonus_pontos ?? 0
    if (bonus <= 0) continue
    const tituloDes = (ds?.titulo && String(ds.titulo).trim()) || 'Desafio da semana'
    const sem = pr.semana_inicio
    items.push({
      tipo: 'bonus',
      data: sem,
      dataOrdem: sem,
      titulo: `Desafio semanal: ${tituloDes}`,
      pontos: bonus,
      ordemNoDia: 9,
    })
  }

  items.sort((a, b) => {
    const c = String(b.dataOrdem).localeCompare(String(a.dataOrdem))
    if (c !== 0) return c
    return (a.ordemNoDia ?? 0) - (b.ordemNoDia ?? 0)
  })

  return { error: null, data: items }
}

export async function fetchGamificacaoResumo() {
  const { data, error } = await supabase.rpc('rpc_gamificacao_resumo', {})
  if (error) return { error: postgrestErrorMessage(error), data: null }
  return { error: null, data }
}

export async function fetchGamificacaoLeaderboard(limit = 20) {
  const { data, error } = await supabase.rpc('rpc_gamificacao_leaderboard', { p_limit: limit })
  if (error) return { error: postgrestErrorMessage(error), data: null }
  return { error: null, data: data || [] }
}

export async function setRankingOptIn(optIn) {
  const { error } = await supabase.rpc('rpc_gamificacao_set_ranking_opt_in', { p_opt_in: optIn })
  return { error: postgrestErrorMessage(error) || null }
}

export async function setDisplayName(name) {
  const { error } = await supabase.rpc('rpc_gamificacao_set_display_name', { p_name: name || '' })
  return { error: postgrestErrorMessage(error) || null }
}

export async function fetchUsuarioBadges(usuarioId) {
  if (!usuarioId) return { error: null, data: [] }
  const { data: rows, error } = await supabase
    .from('gamificacao_usuario_badges')
    .select('id, badge_id, semana_inicio, concedido_em')
    .eq('usuario_id', usuarioId)
    .order('concedido_em', { ascending: false })
    .limit(50)
  if (error) return { error: error.message, data: null }
  const list = rows || []
  const ids = [...new Set(list.map((r) => r.badge_id).filter(Boolean))]
  if (ids.length === 0) return { error: null, data: normalizedBadgeRows(list, {}) }
  const { data: badges, error: bErr } = await supabase
    .from('gamificacao_badges')
    .select('id, slug, titulo, descricao, icone')
    .in('id', ids)
  if (bErr) return { error: bErr.message, data: null }
  const byId = Object.fromEntries((badges || []).map((b) => [b.id, b]))
  return { error: null, data: normalizedBadgeRows(list, byId) }
}

function normalizedBadgeRows(list, byId) {
  return list.map((r) => ({
    id: r.id,
    semana_inicio: r.semana_inicio,
    concedido_em: r.concedido_em,
    badge: byId[r.badge_id] || null,
  }))
}
