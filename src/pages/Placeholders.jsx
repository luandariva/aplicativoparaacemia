import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { fetchGamificacaoLeaderboard, fetchGamificacaoResumo, fetchUsuarioBadges, setDisplayName, setRankingOptIn } from '../lib/gamificacao'
import { resolveUsuarioDb } from '../lib/usuarioDb'

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return fallback
}

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function Nutricao() {
  const { user } = useAuth()
  const [diaSelecionado, setDiaSelecionado] = useState(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return hoje
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metas, setMetas] = useState(null)
  const [refeicoes, setRefeicoes] = useState([])
  const [refeicaoSelecionada, setRefeicaoSelecionada] = useState(null)

  useEffect(() => {
    let alive = true

    async function carregarDieta() {
      if (!user?.id) {
        if (alive) {
          setLoading(false)
          setError('Usuario nao autenticado.')
        }
        return
      }

      setLoading(true)
      setError('')

      try {
        let usuarioRow = null

        const tentativasUsuario = [
          supabase.from('usuarios').select('*').eq('auth_user_id', user.id).limit(1).maybeSingle(),
          supabase.from('usuarios').select('*').eq('id', user.id).limit(1).maybeSingle(),
          supabase.from('usuarios').select('*').eq('email', user.email).limit(1).maybeSingle(),
        ]

        for (const req of tentativasUsuario) {
          const { data } = await req
          if (data) {
            usuarioRow = data
            break
          }
        }

        const usuarioId = pick(usuarioRow || {}, ['id', 'usuario_id'], user.id)

        const { data: metasData, error: metasErr } = await supabase
          .from('metas_macros')
          .select('*')
          .eq('usuario_id', usuarioId)
          .order('data_referencia', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (metasErr) throw metasErr

        const inicioDia = new Date(diaSelecionado)
        const fimDia = new Date(inicioDia)
        fimDia.setDate(fimDia.getDate() + 1)
        const { data: refeicoesData, error: refeicoesErr } = await supabase
          .from('refeicoes')
          .select('*')
          .eq('usuario_id', usuarioId)
          .gte('data_hora', inicioDia.toISOString())
          .lt('data_hora', fimDia.toISOString())
          .order('data_hora', { ascending: true })
        if (refeicoesErr) throw refeicoesErr

        if (alive) {
          setMetas(metasData || null)
          setRefeicoes(refeicoesData || [])
        }
      } catch (err) {
        if (alive) setError(err?.message || 'Falha ao carregar dados da dieta.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    carregarDieta()
    return () => { alive = false }
  }, [diaSelecionado, user?.email, user?.id])

  const { isHoje, podeAvancarDia } = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const d = new Date(diaSelecionado)
    d.setHours(0, 0, 0, 0)
    return {
      isHoje: d.getTime() === hoje.getTime(),
      podeAvancarDia: d.getTime() < hoje.getTime(),
    }
  }, [diaSelecionado])

  const diaSelecionadoLabel = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(diaSelecionado)
  }, [diaSelecionado])

  const navBtn = (disabled) => ({
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: disabled ? 'var(--text-dim)' : 'var(--green)',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    lineHeight: 1,
  })

  const resumo = useMemo(() => {
    const kcalMeta = toNum(pick(metas || {}, ['calorias_kcal', 'kcal_meta', 'meta_kcal', 'kcal_diaria', 'calorias_meta']))
    const proteinaMeta = toNum(pick(metas || {}, ['proteina_meta', 'meta_proteina', 'proteina_g']))
    const carboMeta = toNum(pick(metas || {}, ['carboidrato_meta', 'meta_carboidrato', 'carboidrato_g']))
    const gorduraMeta = toNum(pick(metas || {}, ['gordura_meta', 'meta_gordura', 'gordura_g']))

    const consumidoKcal = refeicoes.reduce((acc, r) => acc + toNum(pick(r, ['kcal', 'calorias', 'calorias_kcal'])), 0)
    const proteinaAtual = refeicoes.reduce((acc, r) => acc + toNum(pick(r, ['proteina_g', 'proteina', 'proteinas_g'])), 0)
    const carboAtual = refeicoes.reduce((acc, r) => acc + toNum(pick(r, ['carboidrato_g', 'carboidrato', 'carbo_g'])), 0)
    const gorduraAtual = refeicoes.reduce((acc, r) => acc + toNum(pick(r, ['gordura_g', 'gordura', 'lipideos_g'])), 0)

    return {
      kcalMeta,
      consumidoKcal,
      saldoKcal: Math.max(kcalMeta - consumidoKcal, 0),
      proteinaMeta,
      proteinaAtual,
      carboMeta,
      carboAtual,
      gorduraMeta,
      gorduraAtual,
    }
  }, [metas, refeicoes])

  const refeicoesUI = useMemo(() => {
    return refeicoes.map((r, index) => {
      const nome = pick(r, ['nome', 'refeicao', 'tipo_refeicao'], 'Refeicao')
      const kcal = toNum(pick(r, ['kcal', 'calorias', 'calorias_kcal']))
      const statusRaw = String(pick(r, ['status', 'situacao'], 'registrada')).toLowerCase()
      const status = statusRaw.includes('pend') ? 'Pendente' : 'Registrada'
      return {
        id: pick(r, ['id'], `${nome}-${index}`),
        nome,
        kcalNum: kcal,
        kcal: `${kcal} kcal`,
        status,
        horario: pick(r, ['data_hora', 'horario', 'created_at']),
        proteina: toNum(pick(r, ['proteina_g', 'proteina', 'proteinas_g'])),
        carboidrato: toNum(pick(r, ['carboidrato_g', 'carboidrato', 'carbo_g'])),
        gordura: toNum(pick(r, ['gordura_g', 'gordura', 'lipideos_g'])),
        observacoes: pick(r, ['observacoes', 'observacao', 'descricao'], ''),
        canOpen: true,
      }
    })
  }, [refeicoes])

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '16px',
      paddingTop: 'calc(var(--safe-top) + 12px)',
      paddingBottom: 'calc(86px + var(--safe-bottom))',
    }}>
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}>
          <button
            type="button"
            aria-label="Dia anterior"
            onClick={() => {
              setDiaSelecionado((prev) => {
                const next = new Date(prev)
                next.setDate(next.getDate() - 1)
                return next
              })
            }}
            style={navBtn(false)}
          >
            ←
          </button>
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            minWidth: 0,
          }}>
            <span style={{
              padding: '8px 14px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--green)',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>
              {diaSelecionadoLabel}
            </span>
          </div>
          <button
            type="button"
            aria-label="Proximo dia"
            disabled={!podeAvancarDia}
            onClick={() => {
              setDiaSelecionado((prev) => {
                const next = new Date(prev)
                next.setDate(next.getDate() + 1)
                return next
              })
            }}
            style={navBtn(!podeAvancarDia)}
          >
            →
          </button>
        </div>
      </div>

      {loading && (
        <div style={{
          borderRadius: 12, border: '1px solid var(--border)',
          background: 'var(--bg-card)', padding: 12, color: 'var(--text-muted)', fontSize: 13,
        }}>
          Carregando dados da dieta...
        </div>
      )}

      {!loading && error && (
        <div style={{
          borderRadius: 12, border: '1px solid var(--border)',
          background: 'var(--bg-card)', padding: 12, color: 'var(--red)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'linear-gradient(145deg, #13161b, #0a0c0f)',
        padding: 14,
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
          {isHoje ? 'Resumo de hoje' : 'Resumo do dia'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Meta kcal', value: resumo.kcalMeta ? `${resumo.kcalMeta}` : '--' },
            { label: 'Consumido', value: `${resumo.consumidoKcal}` },
            { label: 'Proteina', value: `${resumo.proteinaAtual}g` },
            { label: 'Saldo', value: `${resumo.saldoKcal} kcal` },
          ].map((item) => (
            <div key={item.label} style={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              padding: '10px 11px',
            }}>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        padding: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)' }}>Macros</h2>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Progresso</span>
        </div>
        {[
          { nome: 'Proteina', atual: resumo.proteinaAtual, meta: resumo.proteinaMeta, cor: 'var(--green)' },
          { nome: 'Carboidrato', atual: resumo.carboAtual, meta: resumo.carboMeta, cor: 'var(--blue)' },
          { nome: 'Gordura', atual: resumo.gorduraAtual, meta: resumo.gorduraMeta, cor: 'var(--amber)' },
        ].map((m) => {
          const pct = m.meta > 0 ? Math.min(100, Math.round((m.atual / m.meta) * 100)) : 0
          return (
            <div key={m.nome} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span>{m.nome}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {m.meta > 0 ? `${m.atual} / ${m.meta}g` : `${m.atual}g`}
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: m.cor, borderRadius: 999 }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        padding: 14,
      }}>
        <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', marginBottom: 10 }}>Refeicoes</h2>
        {(refeicoesUI.length > 0 ? refeicoesUI : [
          {
            id: 'empty',
            nome: isHoje ? 'Nenhuma refeicao registrada hoje' : 'Nenhuma refeicao registrada neste dia',
            kcal: '--',
            status: 'Pendente',
            canOpen: false,
          },
        ]).map((r, i, arr) => (
          <button
            key={r.id}
            type="button"
            onClick={() => r.canOpen && setRefeicaoSelecionada(r)}
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: r.canOpen ? 'pointer' : 'default',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div>
              <p style={{ fontSize: 14, color: 'var(--text)' }}>{r.nome}</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{r.kcal}</p>
            </div>
            <span style={{
              fontSize: 11,
              borderRadius: 999,
              padding: '6px 9px',
              background: r.status === 'Registrada' ? 'rgba(201,242,77,0.14)' : 'rgba(255,255,255,0.05)',
              color: r.status === 'Registrada' ? 'var(--green)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
              {r.status}
            </span>
          </button>
        ))}
      </div>

      {refeicaoSelecionada && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setRefeicaoSelecionada(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              borderRadius: 16,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              padding: 14,
              marginBottom: 'calc(74px + var(--safe-bottom))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)' }}>{refeicaoSelecionada.nome}</h3>
              <button
                type="button"
                onClick={() => setRefeicaoSelecionada(null)}
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Calorias', value: `${refeicaoSelecionada.kcalNum} kcal` },
                { label: 'Status', value: refeicaoSelecionada.status },
                { label: 'Proteina', value: `${refeicaoSelecionada.proteina}g` },
                { label: 'Carboidrato', value: `${refeicaoSelecionada.carboidrato}g` },
                { label: 'Gordura', value: `${refeicaoSelecionada.gordura}g` },
                { label: 'Horario', value: formatDateTime(refeicaoSelecionada.horario) },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '8px 9px',
                  }}
                >
                  <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.label}</p>
                  <p style={{ fontSize: 14, marginTop: 2 }}>{item.value}</p>
                </div>
              ))}
            </div>

            {refeicaoSelecionada.observacoes ? (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Observacoes</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {refeicaoSelecionada.observacoes}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export function Evolucao() {
  const { user } = useAuth()
  const [filtro, setFiltro] = useState('semanal')
  const [meuUsuarioId, setMeuUsuarioId] = useState(null)
  const [resumo, setResumo] = useState(null)
  const [resumoErr, setResumoErr] = useState('')
  const [board, setBoard] = useState([])
  const [boardErr, setBoardErr] = useState('')
  const [loading, setLoading] = useState(true)

  const opcoes = [
    { id: 'semanal', label: 'Semanal' },
    { id: 'mensal', label: 'Mensal' },
    { id: 'metas', label: 'Metas' },
  ]

  useEffect(() => {
    let alive = true
    async function load() {
      if (!user?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { usuarioId } = await resolveUsuarioDb(user)
      if (alive) setMeuUsuarioId(usuarioId)

      const r1 = await fetchGamificacaoResumo()
      if (alive) {
        if (r1.error || !r1.data?.ok) setResumoErr(r1.data?.error || r1.error || 'Resumo indisponivel.')
        else {
          setResumoErr('')
          setResumo(r1.data)
        }
      }

      const r2 = await fetchGamificacaoLeaderboard(25)
      if (alive) {
        if (r2.error) setBoardErr(r2.error)
        else {
          setBoardErr('')
          setBoard(r2.data || [])
        }
      }
      if (alive) setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [user?.id])

  const desafio = resumo?.desafio
  const prog = desafio?.progresso

  const dados = {
    semanal: {
      titulo: 'Semana actual (gamificacao)',
      kpi: [
        { label: 'Pontos (total)', valor: resumo?.ok ? String(resumo.pontos_semana) : '—' },
        { label: 'Só actividade', valor: resumo?.ok ? String(resumo.pontos_actividade ?? '—') : '—' },
        { label: 'Bonus desafio', valor: resumo?.ok ? String(resumo.pontos_bonus_desafio ?? 0) : '—' },
        {
          label: 'Ranking',
          valor: resumo?.ok && resumo.ranking_opt_in && resumo.posicao_ranking > 0
            ? `#${resumo.posicao_ranking}`
            : (resumo?.ranking_opt_in === false ? 'Off' : '—'),
        },
      ],
    },
    mensal: {
      titulo: 'Ultimos 30 dias',
      kpi: [
        { label: 'Treinos', valor: '—' },
        { label: 'Kcal medias', valor: '—' },
        { label: 'Proteina media', valor: '—' },
        { label: 'Aderencia', valor: '—' },
      ],
    },
    metas: {
      titulo: 'Progresso das metas',
      kpi: [
        { label: 'Desafio: dias activos', valor: prog ? `${prog.dias_atividade}/${desafio?.min_dias_atividade ?? '—'}` : '—' },
        { label: 'Desafio: treinos', valor: prog ? `${prog.treinos_semana}/${desafio?.min_treinos ?? '—'}` : '—' },
        { label: 'Desafio: macros', valor: prog ? `${prog.dias_macros}/${desafio?.min_dias_macros ?? '—'}` : '—' },
        { label: 'Completo', valor: prog?.completo ? 'Sim' : 'Nao' },
      ],
    },
  }

  const atual = dados[filtro]

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '16px',
      paddingTop: 'calc(var(--safe-top) + 12px)',
      paddingBottom: 'calc(86px + var(--safe-bottom))',
    }}>
      <div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Acompanhamento</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 900, color: 'var(--green)' }}>
          Evolucao
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {opcoes.map((op) => {
          const ativo = op.id === filtro
          return (
            <button
              key={op.id}
              type="button"
              onClick={() => setFiltro(op.id)}
              style={{
                whiteSpace: 'nowrap',
                borderRadius: 12,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                border: '1px solid var(--border)',
                background: ativo ? 'var(--green)' : 'var(--bg-card)',
                color: ativo ? '#111' : 'var(--text-muted)',
              }}
            >
              {op.label}
            </button>
          )
        })}
      </div>

      {(resumoErr || boardErr) && (
        <div style={{
          borderRadius: 12, border: '1px solid var(--border)', padding: 12, fontSize: 12,
          color: 'var(--text-muted)', background: 'var(--bg-card)',
        }}>
          {resumoErr && <p style={{ margin: 0 }}>Resumo: {resumoErr}</p>}
          {boardErr && <p style={{ margin: resumoErr ? '8px 0 0' : 0 }}>Ranking: {boardErr}</p>}
        </div>
      )}

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'linear-gradient(145deg, #13161b, #0a0c0f)',
        padding: 14,
      }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{atual.titulo}</p>
        {loading && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>A carregar…</p>
        )}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {atual.kpi.map((item) => (
              <div key={item.label} style={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                padding: '10px 11px',
              }}>
                <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{item.valor}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        padding: 14,
      }}>
        <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', marginBottom: 10 }}>Ranking</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Pontos da semana (actividade + bonus do desafio). Lista todos os alunos com ranking activo e pelo menos 1 ponto.
        </p>
        {!board.length && !boardErr && !loading && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Sem dados ou nenhum participante com pontos nesta semana.</p>
        )}
        {board.map((row) => {
          const souEu = meuUsuarioId && row.usuario_id === meuUsuarioId
          return (
            <div
              key={`${row.posicao}-${row.usuario_id}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                background: souEu ? 'rgba(201,242,77,0.08)' : 'transparent',
                marginLeft: souEu ? -6 : 0,
                marginRight: souEu ? -6 : 0,
                paddingLeft: souEu ? 6 : 0,
                paddingRight: souEu ? 6 : 0,
                borderRadius: souEu ? 8 : 0,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {row.posicao}. {row.display_label}
                {souEu ? ' (voce)' : ''}
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--green)' }}>
                {row.pontos} pts
              </span>
            </div>
          )
        })}
      </div>

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        padding: 14,
      }}>
        <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', marginBottom: 10 }}>Resumo rapido</h2>
        {[
          desafio && prog
            ? `Desafio: ${prog.dias_atividade}/${desafio.min_dias_atividade} dias com treino ou refeicao registada.`
            : 'Carregue o desafio semanal no Dashboard.',
          desafio && prog
            ? `Macros no alvo (${prog.dias_macros} dias): totais do dia entre 90% e 110% da meta de kcal e proteina (quando existirem).`
            : 'Registe refeições em Nutricao para pontuar consistencia e macros.',
          resumo?.ok && resumo.ranking_opt_in === false
            ? 'Ranking desactivado no perfil — active para ver a sua posicao.'
            : 'Cada treino concluido grava pontos ate 2 por dia (cap de treinos para pontos).',
        ].map((texto, i) => (
          <div key={i} style={{
            padding: '10px 0',
            borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
            color: 'var(--text-muted)',
            fontSize: 13,
            lineHeight: 1.45,
          }}>
            {texto}
          </div>
        ))}
      </div>
    </div>
  )
}

function iniciais(str) {
  const s = String(str || '').trim()
  if (!s) return '?'
  return s.slice(0, 1).toUpperCase()
}

export function Perfil() {
  const { user } = useAuth()
  const [row, setRow] = useState(null)
  const [usuarioId, setUsuarioId] = useState(null)
  const [badges, setBadges] = useState([])
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      if (!user?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { row: urow, usuarioId: uid } = await resolveUsuarioDb(user)
      if (!alive) return
      setRow(urow)
      setUsuarioId(uid)
      setNomeExibicao(pick(urow || {}, ['display_name'], '') || '')
      setOptIn(urow?.ranking_opt_in !== false)

      const br = await fetchUsuarioBadges(uid)
      if (alive && !br.error) setBadges(br.data || [])
      if (alive) setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [user?.id, user?.email])

  const nomeMostrado = nomeExibicao.trim() || user?.email?.split('@')[0] || 'Aluno'

  async function guardarNome() {
    setMsg('')
    const err = await setDisplayName(nomeExibicao)
    if (err) setMsg(err)
    else setMsg('Nome de exibicao guardado.')
  }

  async function alternarRanking() {
    const next = !optIn
    setOptIn(next)
    const err = await setRankingOptIn(next)
    if (err) {
      setOptIn(!next)
      setMsg(err)
    } else {
      setMsg(next ? 'Ranking activado.' : 'Ranking desactivado (privado).')
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '16px',
      paddingTop: 'calc(var(--safe-top) + 12px)',
      paddingBottom: 'calc(86px + var(--safe-bottom))',
    }}>
      <div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Conta</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 900, color: 'var(--green)' }}>
          Perfil
        </h1>
      </div>

      {msg && (
        <div style={{
          fontSize: 12, color: 'var(--text-muted)', borderRadius: 12, border: '1px solid var(--border)',
          padding: 10, background: 'var(--bg-card)',
        }}>
          {msg}
        </div>
      )}

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'linear-gradient(145deg, #13161b, #0a0c0f)',
        padding: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'var(--green)',
            color: '#111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 20,
          }}>
            {iniciais(nomeMostrado)}
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{nomeMostrado}</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {loading ? 'A carregar…' : (user?.email || '—')}
            </p>
          </div>
        </div>
      </div>

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        padding: 14,
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Nome no ranking</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={nomeExibicao}
            onChange={(e) => setNomeExibicao(e.target.value)}
            placeholder="Como aparece no ranking"
            style={{
              flex: 1, minWidth: 160, borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg-input)', color: 'var(--text)', padding: '10px 12px', fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={guardarNome}
            style={{
              borderRadius: 10, border: '1px solid var(--border)', background: 'var(--green)',
              color: '#111', padding: '10px 14px', fontSize: 12, fontWeight: 800,
            }}
          >
            Guardar
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aparecer no ranking</span>
          <button
            type="button"
            onClick={alternarRanking}
            style={{
              marginLeft: 'auto',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: optIn ? 'rgba(201,242,77,0.2)' : 'transparent',
              color: 'var(--green)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {optIn ? 'Activado' : 'Desactivado'}
          </button>
        </div>
      </div>

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        padding: 14,
      }}>
        <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', marginBottom: 10 }}>Conquistas</h2>
        {badges.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Ainda sem badges — treine e complete o desafio semanal.</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {badges.map((ub) => {
            const b = ub.badge
            return (
              <div
                key={ub.id}
                style={{
                  borderRadius: 12, border: '1px solid var(--border)', padding: 10,
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <p style={{ fontSize: 20, marginBottom: 4 }}>{b?.icone || '★'}</p>
                <p style={{ fontSize: 14, fontWeight: 700 }}>{b?.titulo || 'Badge'}</p>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{b?.descricao || ''}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        padding: 14,
      }}>
        {[
          { label: 'Usuario (app)', value: usuarioId || '—' },
        ].map((item, i) => (
          <div key={item.label} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: 'none',
            gap: 8,
          }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{item.label}</span>
            <span style={{ fontSize: 11, wordBreak: 'break-all', textAlign: 'right' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
