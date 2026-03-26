import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePortal } from '../portal/PortalContext'

function pick(obj: Record<string, unknown> | null | undefined, keys: string[], fallback: string | null = null) {
  if (!obj) return fallback
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null) return String(v)
  }
  return fallback
}

function pickNum(obj: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!obj) return 0
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null) {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

type Detail = {
  usuario: {
    id: string
    email?: string
    display_name?: string | null
    ranking_opt_in?: boolean
  } | null
  planos: Array<{
    id: string
    nome: string
    data_prevista: string
    categoria: string | null
    criado_pelo_aluno: boolean
    exercicios?: unknown
  }>
  realizados: Array<{
    id: string
    nome: string
    data_hora: string
    duracao_min: number | null
    concluido: boolean | null
  }>
  gamificacao?: {
    semana_inicio: string | null
    pontos_semana: number
    detalhe: unknown
    desafio: unknown
  } | null
  metas_macros?: Record<string, unknown> | null
  refeicoes_recentes?: Array<Record<string, unknown>>
}

export function AlunoDetailPage() {
  const { usuarioId } = useParams()
  const { portalCall, member } = usePortal()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [data, setData] = useState<Detail | null>(null)

  const canPrescrever = member?.papel === 'personal'

  const usuarioIdSafe = useMemo(() => usuarioId ?? '', [usuarioId])

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        setErro(null)
        setLoading(true)
        const d = await portalCall<Detail>('portal_aluno_detail', {
          usuario_id: usuarioIdSafe,
        })
        if (mounted) setData(d)
      } catch (err: any) {
        if (mounted) setErro(err?.message || 'Erro ao carregar detalhes')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [portalCall, usuarioIdSafe])

  if (loading) {
    return (
      <div className="portalCard">
        <p style={{ margin: 0, color: '#9ca3af' }}>Carregando…</p>
      </div>
    )
  }

  if (erro || !data?.usuario) {
    return (
      <div className="portalCard">
        <p style={{ margin: 0, color: '#fca5a5' }}>{erro ?? 'Aluno não encontrado.'}</p>
        <div style={{ marginTop: 14 }}>
          <Link to="/alunos">Voltar</Link>
        </div>
      </div>
    )
  }

  const u = data.usuario
  const pontos = data.gamificacao?.pontos_semana ?? 0
  const semana = data.gamificacao?.semana_inicio ?? null

  const meta = data.metas_macros ?? null
  const kcalMeta = pickNum(meta, ['calorias_kcal', 'kcal_meta', 'meta_kcal', 'kcal_diaria', 'calorias_meta'])
  const protMeta = pickNum(meta, ['proteina_meta', 'meta_proteina', 'proteina_g'])
  const refeicoes = data.refeicoes_recentes ?? []
  const somaKcal = refeicoes.reduce(
    (acc, r) => acc + pickNum(r, ['kcal', 'calorias', 'calorias_kcal']),
    0,
  )
  const somaProt = refeicoes.reduce(
    (acc, r) => acc + pickNum(r, ['proteina_g', 'proteina', 'proteinas_g']),
    0,
  )

  return (
    <div className="portalCard">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Link to="/alunos" style={{ color: '#93c5fd' }}>
            ← Alunos
          </Link>
          <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 900 }}>
            {u.display_name || u.email || 'Aluno'}
          </h1>
          <p style={{ margin: '6px 0 0', color: '#9ca3af' }}>{u.email}</p>
          <p style={{ margin: '10px 0 0', color: '#9ca3af', fontSize: 14 }}>
            Ranking opt-in: {u.ranking_opt_in ? 'sim' : 'não'}
          </p>
        </div>

        {canPrescrever && (
          <Link
            to={`/alunos/${u.id}/prescrever`}
            className="portalBtn portalBtnPrimary"
            style={{ alignSelf: 'flex-start', padding: '10px 16px' }}
          >
            Prescrever treino
          </Link>
        )}
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <div className="portalCard" style={{ padding: 16 }}>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Pontos (semana)</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: '#34d399', marginTop: 6 }}>
            {pontos}
          </div>
          <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 6 }}>
            {semana ? `Semana iniciada em ${semana}` : 'Sem dados'}
          </div>
        </div>

        <div className="portalCard" style={{ padding: 16 }}>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Treinos recentes</div>
          <div style={{ color: '#e5e7eb', marginTop: 6, fontSize: 14 }}>
            {data.realizados?.length ?? 0} realizados
          </div>
        </div>

        <div className="portalCard" style={{ padding: 16 }}>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Alimentação (90 dias)</div>
          <div style={{ color: '#e5e7eb', marginTop: 6, fontSize: 14 }}>
            {refeicoes.length} refeições registadas · {Math.round(somaKcal)} kcal ·{' '}
            {Math.round(somaProt)} g proteína (soma do período)
          </div>
          {meta ? (
            <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>
              Meta atual: {kcalMeta > 0 ? `${Math.round(kcalMeta)} kcal/dia` : '—'}
              {protMeta > 0 ? ` · ${Math.round(protMeta)} g proteína/dia` : ''}
            </div>
          ) : (
            <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Sem meta em metas_macros.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Refeições recentes</h2>
        <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: 14 }}>
          Últimos 90 dias (tabelas refeicoes e metas_macros no resumo acima).
        </p>
        <table className="portalTable" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Refeição</th>
              <th>kcal</th>
              <th>P (g)</th>
            </tr>
          </thead>
          <tbody>
            {refeicoes.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: '#9ca3af' }}>
                  Nenhuma refeição neste período.
                </td>
              </tr>
            ) : (
              refeicoes.slice(0, 20).map((r, i) => {
                const id = pick(r, ['id'], `r-${i}`)
                const nome = pick(r, ['descricao', 'nome', 'refeicao', 'tipo_refeicao'], 'Refeição')
                const dh = pick(r, ['data_hora', 'horario', 'created_at'], null)
                const kcal = pickNum(r, ['kcal', 'calorias', 'calorias_kcal'])
                const p = pickNum(r, ['proteina_g', 'proteina', 'proteinas_g'])
                return (
                  <tr key={id}>
                    <td style={{ color: '#9ca3af' }}>
                      {dh ? new Date(dh).toLocaleString() : '—'}
                    </td>
                    <td>{nome}</td>
                    <td style={{ color: '#9ca3af' }}>{kcal ? Math.round(kcal) : '—'}</td>
                    <td style={{ color: '#9ca3af' }}>{p ? Math.round(p) : '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Planos de treino</h2>
        <table className="portalTable" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Treino</th>
              <th>Data</th>
              <th>Origem</th>
              {canPrescrever ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {data.planos.length === 0 ? (
              <tr>
                <td colSpan={canPrescrever ? 4 : 3} style={{ color: '#9ca3af' }}>
                  Nenhum plano.
                </td>
              </tr>
            ) : (
              data.planos.slice(0, 12).map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td style={{ color: '#9ca3af' }}>{p.data_prevista}</td>
                  <td style={{ color: '#9ca3af' }}>
                    {p.criado_pelo_aluno ? 'Aluno' : 'Prescrito'}
                  </td>
                  {canPrescrever ? (
                    <td>
                      <Link
                        to={`/alunos/${u.id}/prescrever?duplicarDe=${encodeURIComponent(p.id)}`}
                        style={{ color: '#93c5fd', fontSize: 14 }}
                      >
                        Duplicar
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Treinos realizados</h2>
        <table className="portalTable" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Treino</th>
              <th>Quando</th>
              <th>Duração</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.realizados.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: '#9ca3af' }}>
                  Nenhum registo.
                </td>
              </tr>
            ) : (
              data.realizados.slice(0, 15).map((r) => (
                <tr key={r.id}>
                  <td>{r.nome}</td>
                  <td style={{ color: '#9ca3af' }}>
                    {new Date(r.data_hora).toLocaleString()}
                  </td>
                  <td style={{ color: '#9ca3af' }}>{r.duracao_min ?? '—'} min</td>
                  <td style={{ color: '#9ca3af' }}>{r.concluido ? 'concluído' : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

