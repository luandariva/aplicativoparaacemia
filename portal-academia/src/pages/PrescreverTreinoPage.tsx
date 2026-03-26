import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { usePortal } from '../portal/PortalContext'

type Exerc = {
  nome: string
  series: number
  repeticoes: number
  carga: number
  met: number
  video_url?: string | null
}

const CAT_OPTS = ['chest', 'upper', 'legs'] as const

function normalizeCat(c: string | null | undefined): (typeof CAT_OPTS)[number] {
  const s = String(c || '').toLowerCase()
  return CAT_OPTS.includes(s as (typeof CAT_OPTS)[number]) ? (s as (typeof CAT_OPTS)[number]) : 'chest'
}

function mapExerciciosFromPlano(raw: unknown): Exerc[] {
  const arr = Array.isArray(raw) ? raw : []
  const mapped = arr
    .map((ex: Record<string, unknown>) => ({
      nome: String(ex?.nome ?? '').trim(),
      series: Math.max(1, Number(ex?.series) || 1),
      repeticoes: Math.max(0, Number(ex?.repeticoes) || 0),
      carga: Math.max(0, Number(ex?.carga) || 0),
      met: Math.max(0, Number(ex?.met) || 0),
      video_url: (ex?.video_url as string | null | undefined) ?? null,
    }))
    .filter((e) => e.nome)
  return mapped.length > 0 ? mapped : [{ nome: '', series: 3, repeticoes: 10, carga: 0, met: 0 }]
}

type PrescreverTreinoPageProps = {
  /** Treino de catálogo da academia (sem aluno); disponível no app para alunos da unidade. */
  catalogo?: boolean
}

export function PrescreverTreinoPage({ catalogo: modoCatalogo = false }: PrescreverTreinoPageProps) {
  const nav = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const { portalCall, member } = usePortal()

  const usuarioId = useMemo(() => params.usuarioId ?? '', [params.usuarioId])
  const duplicarDe = useMemo(() => searchParams.get('duplicarDe')?.trim() ?? '', [searchParams])

  const [nome, setNome] = useState('')
  const [dataPrevista, setDataPrevista] = useState(() => new Date().toISOString().slice(0, 10))
  const [categoria, setCategoria] = useState<'chest' | 'upper' | 'legs'>('chest')
  const [exercicios, setExercicios] = useState<Exerc[]>([
    { nome: '', series: 3, repeticoes: 10, carga: 0, met: 0 },
  ])

  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dupLoading, setDupLoading] = useState(Boolean(duplicarDe))
  const [dupAviso, setDupAviso] = useState<string | null>(null)

  const podePrescrever = member?.papel === 'personal'

  useEffect(() => {
    if (!duplicarDe) {
      setDupLoading(false)
      return
    }
    if (!modoCatalogo && !usuarioId) {
      setDupLoading(false)
      return
    }

    let mounted = true
    setDupAviso(null)
    setDupLoading(true)

    ;(async () => {
      try {
        if (modoCatalogo) {
          const d = await portalCall<{
            treino: {
              nome: string
              data_prevista: string
              categoria: string | null
              exercicios?: unknown
            } | null
          }>('portal_treinos_catalogo', { treino_id: duplicarDe })
          const plan = d.treino
          if (!mounted) return
          if (!plan) {
            setDupAviso('Plano para duplicar não encontrado.')
            return
          }
          const baseNome = String(plan.nome || 'Treino').trim()
          setNome(baseNome ? `${baseNome} (cópia)` : 'Treino (cópia)')
          setDataPrevista(new Date().toISOString().slice(0, 10))
          setCategoria(normalizeCat(plan.categoria))
          setExercicios(mapExerciciosFromPlano(plan.exercicios))
        } else {
          const d = await portalCall<{
            planos: Array<{
              id: string
              nome: string
              data_prevista: string
              categoria: string | null
              exercicios?: unknown
            }>
          }>('portal_aluno_detail', { usuario_id: usuarioId })
          const plan = (d.planos ?? []).find((p) => p.id === duplicarDe)
          if (!mounted) return
          if (!plan) {
            setDupAviso('Plano para duplicar não encontrado.')
            return
          }
          const baseNome = String(plan.nome || 'Treino').trim()
          setNome(baseNome ? `${baseNome} (cópia)` : 'Treino (cópia)')
          setDataPrevista(new Date().toISOString().slice(0, 10))
          setCategoria(normalizeCat(plan.categoria))
          setExercicios(mapExerciciosFromPlano(plan.exercicios))
        }
      } catch {
        if (mounted) setDupAviso('Não foi possível carregar o plano para duplicar.')
      } finally {
        if (mounted) setDupLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [duplicarDe, usuarioId, portalCall, modoCatalogo])

  if (member && member.papel !== 'personal') {
    return (
      <Navigate to={modoCatalogo ? '/treinos-academia' : usuarioId ? `/alunos/${usuarioId}` : '/alunos'} replace />
    )
  }

  if (!modoCatalogo && !usuarioId) {
    return <Navigate to="/alunos" replace />
  }

  function updateEx(i: number, patch: Partial<Exerc>) {
    setExercicios((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  function adicionarEx() {
    setExercicios((prev) => [...prev, { nome: '', series: 3, repeticoes: 10, carga: 0, met: 0 }])
  }

  function removerEx(i: number) {
    setExercicios((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!podePrescrever) {
      setErro('Apenas personal pode prescrever treinos.')
      return
    }
    if (!modoCatalogo && !usuarioId) {
      setErro('usuario_id inválido')
      return
    }
    if (!nome.trim()) {
      setErro('Preencha o nome do treino.')
      return
    }
    if (exercicios.length === 0 || exercicios.some((x) => !x.nome.trim())) {
      setErro('Cada exercício precisa de nome.')
      return
    }

    setSaving(true)
    try {
      await portalCall('portal_prescrever_treino', {
        catalogo: modoCatalogo,
        ...(modoCatalogo ? {} : { usuario_id: usuarioId }),
        nome: nome.trim(),
        data_prevista: dataPrevista,
        categoria,
        exercicios: exercicios.map((x) => ({
          nome: x.nome.trim(),
          series: Math.max(1, Number(x.series) || 1),
          repeticoes: Math.max(0, Number(x.repeticoes) || 0),
          carga: Math.max(0, Number(x.carga) || 0),
          met: Number(x.met) || 0,
          video_url: x.video_url ?? null,
        })),
      })

      nav(modoCatalogo ? '/treinos-academia' : `/alunos/${usuarioId}`)
    } catch (err: any) {
      setErro(err?.message || 'Erro ao prescrever treino')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link to={modoCatalogo ? '/treinos-academia' : `/alunos/${usuarioId}`} style={{ color: '#9ca3af' }}>
          {modoCatalogo ? '← Treinos da academia' : '← Voltar ao aluno'}
        </Link>
        <h1 style={{ margin: '10px 0 0', fontSize: 24, fontWeight: 900 }}>
          {modoCatalogo ? 'Novo treino da academia' : 'Prescrever treino'}
        </h1>
        {modoCatalogo && (
          <p className="portalPageDesc" style={{ marginTop: 8, maxWidth: 520 }}>
            Fica visível no app para qualquer aluno ativo desta academia.
          </p>
        )}
        {duplicarDe && dupLoading && (
          <p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: 14 }}>A carregar modelo do plano…</p>
        )}
        {dupAviso && (
          <p style={{ margin: '8px 0 0', color: '#fcd34d', fontSize: 14 }}>{dupAviso}</p>
        )}
      </div>

      <div className="portalCard">
        <form onSubmit={(e) => void onSubmit(e)}>
          <div className="portalFormRow twoCols">
            <div>
              <label style={{ display: 'block', textAlign: 'left' }}>Nome do treino</label>
              <input
                className="portalInput"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                style={{ marginTop: 8 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', textAlign: 'left' }}>Data prevista</label>
              <input
                className="portalInput"
                type="date"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
                required
                style={{ marginTop: 8 }}
              />
            </div>
          </div>

          <div className="portalFormRow" style={{ marginTop: 10 }}>
            <div>
              <label style={{ display: 'block', textAlign: 'left' }}>Categoria</label>
              <select
                className="portalSelect"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as any)}
                style={{ marginTop: 8 }}
              >
                <option value="chest">Peito</option>
                <option value="upper">Membros superiores</option>
                <option value="legs">Pernas</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Exercícios</h2>
              <button type="button" className="portalBtn portalBtnGhost" onClick={() => adicionarEx()}>
                + Adicionar
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              {exercicios.map((ex, i) => (
                <div key={i} className="portalCard" style={{ background: '#0d0f14' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#9ca3af', fontSize: 12 }}>#{i + 1}</div>
                    {exercicios.length > 1 && (
                      <button type="button" className="portalBtn portalBtnGhost" onClick={() => removerEx(i)}>
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="portalFormRow twoCols" style={{ marginTop: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', textAlign: 'left' }}>Nome</label>
                      <input
                        className="portalInput"
                        value={ex.nome}
                        onChange={(e) => updateEx(i, { nome: e.target.value })}
                        required
                        style={{ marginTop: 8 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', textAlign: 'left' }}>Séries</label>
                      <input
                        className="portalInput"
                        type="number"
                        min={1}
                        value={ex.series}
                        onChange={(e) => updateEx(i, { series: Number(e.target.value) })}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', textAlign: 'left' }}>Repetições</label>
                      <input
                        className="portalInput"
                        type="number"
                        min={0}
                        value={ex.repeticoes}
                        onChange={(e) => updateEx(i, { repeticoes: Number(e.target.value) })}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', textAlign: 'left' }}>Carga</label>
                      <input
                        className="portalInput"
                        type="number"
                        min={0}
                        value={ex.carga}
                        onChange={(e) => updateEx(i, { carga: Number(e.target.value) })}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', textAlign: 'left' }}>MET</label>
                      <input
                        className="portalInput"
                        type="number"
                        step={0.1}
                        min={0}
                        value={ex.met}
                        onChange={(e) => updateEx(i, { met: Number(e.target.value) })}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {erro && <p style={{ marginTop: 14, color: '#fca5a5' }}>{erro}</p>}

          <button
            type="submit"
            className="portalBtn portalBtnPrimary"
            style={{ marginTop: 16, width: '100%', padding: '12px 16px' }}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Gravar treino'}
          </button>
        </form>
      </div>
    </div>
  )
}

