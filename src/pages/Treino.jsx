import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { fetchGamificacaoResumo } from '../lib/gamificacao'

const CATEGORIAS = [
  { id: 'all', label: 'Todos os treinos' },
  { id: 'chest', label: 'Peito' },
  { id: 'upper', label: 'Membros superiores' },
  { id: 'legs', label: 'Pernas' },
]

const THUMB_PERSONALIZADO = 'https://images.unsplash.com/photo-1517964603305-11c0f6f66012?auto=format&fit=crop&w=900&q=60'

/** Capas por tipo de treino (Unsplash) */
const THUMB_POR_CATEGORIA = {
  chest: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=60',
  upper: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=60',
  legs: 'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?auto=format&fit=crop&w=900&q=60',
}

const CATEGORIA_SLUGS = new Set(['chest', 'upper', 'legs'])

function normalizeCategoriaSlug(value) {
  if (value == null || typeof value !== 'string') return ''
  const v = value.trim().toLowerCase()
  return CATEGORIA_SLUGS.has(v) ? v : ''
}

/** Fallback quando a coluna categoria no banco estiver vazia */
function inferCategoriaFromNome(nome) {
  const n = String(nome || '').toLowerCase()
  if (n.includes('peito') || n.includes('tricep') || n.includes('trícep')) return 'chest'
  if (n.includes('perna') || n.includes('agach') || n.includes('leg press') || n.includes('panturrilh') || n.includes('extensora') || n.includes('coxa')) return 'legs'
  if (n.includes('costa') || n.includes('bicep') || n.includes('bícep') || n.includes('puxada') || n.includes('remada') || n.includes('ombro')) return 'upper'
  return ''
}

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return fallback
}

function isPlanoUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

function mapPlanoRowToTreino(row, options = {}) {
  const { personalizado: personalizadoOpt, categoria: categoriaOpt } = options
  const personalizado = personalizadoOpt !== undefined
    ? personalizadoOpt
    : Boolean(row.criado_pelo_aluno)
  const categoriaSlug =
    normalizeCategoriaSlug(row.categoria) ||
    (categoriaOpt !== undefined ? normalizeCategoriaSlug(categoriaOpt) : '') ||
    inferCategoriaFromNome(row.nome)
  const raw = row.exercicios
  const list = Array.isArray(raw) ? raw : []
  const exercicios = list.map((ex, idx) => ({
    id: ex.id != null ? String(ex.id) : `${row.id}-ex-${idx + 1}`,
    nome: String(ex.nome || ''),
    series: Math.max(1, Number(ex.series) || 1),
    repeticoes: Math.max(0, Number(ex.repeticoes) || 0),
    carga: Math.max(0, Number(ex.carga) || 0),
    met: Number(ex.met) || 0,
    video_url: ex.video_url ?? null,
  }))
  return {
    id: row.id,
    nome: row.nome || 'Treino',
    categoria: categoriaSlug,
    thumb: THUMB_POR_CATEGORIA[categoriaSlug] || THUMB_PERSONALIZADO,
    personal: personalizado ? 'Treino personalizado' : 'Plano',
    exercicios,
    fromDb: true,
    personalizado,
  }
}

function treinoIcone(categoria) {
  if (categoria === 'chest') return '💪'
  if (categoria === 'upper') return '🏋️'
  if (categoria === 'legs') return '🦵'
  return '🔥'
}

function labelCategoria(categoria) {
  if (categoria === 'chest') return 'Peito'
  if (categoria === 'upper') return 'Membros superiores'
  if (categoria === 'legs') return 'Pernas'
  return 'Treino'
}

function resetExercicios(exercicios) {
  return exercicios.map(ex => ({ ...ex, concluido: false, series_feitas: [] }))
}

function novoExercicioBuilder() {
  return {
    id: `bex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nome: '',
    series: '3',
    repeticoes: '12',
    carga: '',
  }
}

function SerieButton({ numero, feita, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: '50%',
      background: feita ? 'var(--green)' : 'var(--bg-input)',
      border: `1px solid ${feita ? 'transparent' : 'var(--border)'}`,
      color: feita ? '#121212' : 'var(--text-muted)',
      fontSize: 13, fontWeight: 700, display: 'flex',
      alignItems: 'center', justifyContent: 'center', transition: 'all .2s',
    }}>
      {feita ? '✓' : numero}
    </button>
  )
}

function ExercicioCard({ ex, index, onToggleSerie, onToggleConcluido, expandido, onExpand }) {
  const totalFeitas = ex.series_feitas.length
  const progresso = ex.series > 0 ? (totalFeitas / ex.series) * 100 : 0

  return (
    <div style={{
      background: ex.concluido ? 'rgba(201,242,77,0.09)' : 'var(--bg-card)',
      border: `1px solid ${ex.concluido ? 'var(--border-strong)' : 'var(--border)'}`,
      borderRadius: 16, overflow: 'hidden', transition: 'all .25s',
      flexShrink: 0,
      animation: `fadeUp .3s ease ${index * 0.06}s both`,
    }}>
      <button
        onClick={() => onExpand(ex.id)}
        style={{
          width: '100%', background: 'none', color: 'inherit', border: 'none',
          padding: 14, display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: ex.concluido ? 'var(--green)' : 'var(--bg-input)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: ex.concluido ? '#111' : 'var(--text-muted)', fontWeight: 700,
        }}>
          {ex.concluido ? '✓' : index + 1}
        </div>
        <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
            color: ex.concluido ? 'var(--text-muted)' : 'var(--text)',
            textDecoration: ex.concluido ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {ex.nome}
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {ex.series}x{ex.repeticoes > 0 ? ex.repeticoes : 'falha'} {ex.carga > 0 ? `• ${ex.carga}kg` : ''} • {totalFeitas}/{ex.series}
          </p>
        </div>
        <span style={{ color: 'var(--text-dim)' }}>{expandido ? '▴' : '▾'}</span>
      </button>

      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', margin: '0 14px' }}>
        <div style={{ height: '100%', width: `${progresso}%`, background: 'var(--green)', transition: 'width .3s ease' }} />
      </div>

      {expandido && (
        <div style={{ padding: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>Series</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {Array.from({ length: ex.series }).map((_, i) => (
              <SerieButton
                key={i}
                numero={i + 1}
                feita={ex.series_feitas.includes(i)}
                onClick={() => onToggleSerie(ex.id, i)}
              />
            ))}
          </div>
          <button
            onClick={() => onToggleConcluido(ex.id)}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, fontWeight: 700,
              background: ex.concluido ? 'var(--bg-input)' : 'var(--green)',
              color: ex.concluido ? 'var(--text-muted)' : '#111',
              border: `1px solid ${ex.concluido ? 'var(--border)' : 'transparent'}`,
            }}
          >
            {ex.concluido ? 'Desmarcar' : 'Marcar como feito'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Treino() {
  const { user } = useAuth()
  const [usuarioDbId, setUsuarioDbId] = useState(null)
  const [treinosPlano, setTreinosPlano] = useState([])
  const [listaLoading, setListaLoading] = useState(true)
  const [listaError, setListaError] = useState('')
  const [treinoSelecionadoId, setTreinoSelecionadoId] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('all')
  const [filtroPersonal, setFiltroPersonal] = useState('todos')
  const [busca, setBusca] = useState('')
  const [treino, setTreino] = useState({ id: null, nome: '', categoria: '', personal: '', thumb: '', exercicios: [] })
  const [builderNome, setBuilderNome] = useState('')
  const [builderCategoria, setBuilderCategoria] = useState('chest')
  const [builderExercicios, setBuilderExercicios] = useState([novoExercicioBuilder()])
  const [builderMensagem, setBuilderMensagem] = useState({ tipo: '', texto: '' })
  const [builderExpandido, setBuilderExpandido] = useState(false)
  const [builderSalvando, setBuilderSalvando] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [concluindo, setConcluindo] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [gamifToast, setGamifToast] = useState(null)
  const scrollRef = useRef(null)
  const todosTreinos = treinosPlano
  const personais = ['todos', ...Array.from(new Set(todosTreinos.map((t) => t.personal)))]

  useEffect(() => {
    let alive = true

    async function carregarTreinos() {
      if (!user?.id) {
        if (alive) {
          setListaLoading(false)
          setListaError('Usuario nao autenticado.')
        }
        return
      }

      setListaLoading(true)
      setListaError('')

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
        if (alive) setUsuarioDbId(usuarioId)

        const { data: planos, error: planosErr } = await supabase
          .from('treinos_plano')
          .select('id, nome, personal_id, data_prevista, exercicios, criado_pelo_aluno, categoria, created_at')
          .eq('usuario_id', usuarioId)
          .order('data_prevista', { ascending: true })
          .order('created_at', { ascending: false })

        if (planosErr) throw planosErr

        if (alive) {
          const lista = (planos || []).map((row) => mapPlanoRowToTreino(row))
          setTreinosPlano(lista)
        }
      } catch (err) {
        if (alive) setListaError(err?.message || 'Falha ao carregar treinos.')
      } finally {
        if (alive) setListaLoading(false)
      }
    }

    carregarTreinos()
    return () => { alive = false }
  }, [user?.email, user?.id])

  useEffect(() => {
    if (!gamifToast) return
    const t = setTimeout(() => setGamifToast(null), 6000)
    return () => clearTimeout(t)
  }, [gamifToast])

  const treinosFiltrados = todosTreinos.filter((t) => {
    const termo = busca.trim().toLowerCase()
    const passouBusca = !termo ||
      t.nome.toLowerCase().includes(termo) ||
      labelCategoria(t.categoria).toLowerCase().includes(termo) ||
      t.personal.toLowerCase().includes(termo) ||
      t.exercicios.some((ex) => ex.nome.toLowerCase().includes(termo))
    const passouCategoria = filtroCategoria === 'all' || !t.categoria || t.categoria === filtroCategoria
    const passouPersonal = filtroPersonal === 'todos' || t.personal === filtroPersonal
    return passouBusca && passouCategoria && passouPersonal
  })

  const totalExercicios = treino.exercicios.length
  const concluidos = treino.exercicios.filter(e => e.concluido).length
  const progresso = totalExercicios > 0 ? (concluidos / totalExercicios) * 100 : 0
  const builderValido = Boolean(
    builderNome.trim() &&
    builderExercicios.length > 0 &&
    builderExercicios.every((ex) => {
      const series = Number(ex.series)
      return ex.nome.trim() && Number.isFinite(series) && series > 0
    })
  )

  function atualizarExercicioBuilder(exId, campo, valor) {
    setBuilderExercicios((prev) => prev.map((ex) => (ex.id === exId ? { ...ex, [campo]: valor } : ex)))
  }

  function adicionarExercicioBuilder() {
    setBuilderExercicios((prev) => [...prev, novoExercicioBuilder()])
  }

  function removerExercicioBuilder(exId) {
    setBuilderExercicios((prev) => (prev.length > 1 ? prev.filter((ex) => ex.id !== exId) : prev))
  }

  async function salvarTreinoPersonalizado() {
    if (!builderValido) {
      setBuilderMensagem({ tipo: 'erro', texto: 'Preencha nome do treino e os exercicios obrigatorios.' })
      return
    }
    if (!user?.id) {
      setBuilderMensagem({ tipo: 'erro', texto: 'Faca login para salvar o treino.' })
      return
    }
    if (!usuarioDbId) {
      setBuilderMensagem({ tipo: 'erro', texto: 'Perfil de usuario nao encontrado. Tente novamente.' })
      return
    }

    const exerciciosPayload = builderExercicios.map((ex, index) => ({
      id: `ex-${index + 1}`,
      nome: ex.nome.trim(),
      series: Math.max(1, Number(ex.series) || 1),
      repeticoes: Math.max(0, Number(ex.repeticoes) || 0),
      carga: Math.max(0, Number(ex.carga) || 0),
      met: 0,
      video_url: null,
    }))

    setBuilderSalvando(true)
    setBuilderMensagem({ tipo: '', texto: '' })

    try {
      const hoje = new Date()
      const dataPrevista = hoje.toISOString().slice(0, 10)

      const { data: row, error } = await supabase
        .from('treinos_plano')
        .insert({
          usuario_id: usuarioDbId,
          nome: builderNome.trim(),
          personal_id: null,
          data_prevista: dataPrevista,
          exercicios: exerciciosPayload,
          criado_pelo_aluno: true,
          categoria: builderCategoria,
        })
        .select('id, nome, personal_id, data_prevista, exercicios, criado_pelo_aluno, categoria, created_at')
        .single()

      if (error) throw error

      const novo = mapPlanoRowToTreino(row)
      setTreinosPlano((prev) => [novo, ...prev])

      setBuilderNome('')
      setBuilderCategoria('chest')
      setBuilderExercicios([novoExercicioBuilder()])
      setBuilderMensagem({ tipo: 'sucesso', texto: 'Treino salvo na sua conta.' })
    } catch (err) {
      setBuilderMensagem({
        tipo: 'erro',
        texto: err?.message || 'Nao foi possivel salvar o treino.',
      })
    } finally {
      setBuilderSalvando(false)
    }
  }

  function selecionarTreino(t) {
    setTreinoSelecionadoId(t.id)
    setConcluido(false)
    setExpandido(null)
    setTreino({
      id: t.id,
      nome: t.nome,
      categoria: t.categoria,
      personal: t.personal,
      thumb: t.thumb,
      exercicios: resetExercicios(t.exercicios),
    })
  }

  function toggleSerie(exId, serieIdx) {
    setTreino(prev => ({
      ...prev,
      exercicios: prev.exercicios.map((ex) => {
        if (ex.id !== exId) return ex
        const jaFeita = ex.series_feitas.includes(serieIdx)
        const novas = jaFeita ? ex.series_feitas.filter(i => i !== serieIdx) : [...ex.series_feitas, serieIdx]
        return { ...ex, series_feitas: novas, concluido: novas.length >= ex.series }
      })
    }))
  }

  function toggleConcluido(exId) {
    setTreino(prev => ({
      ...prev,
      exercicios: prev.exercicios.map((ex) => {
        if (ex.id !== exId) return ex
        const novo = !ex.concluido
        return { ...ex, concluido: novo, series_feitas: novo ? Array.from({ length: ex.series }, (_, i) => i) : [] }
      })
    }))
  }

  async function finalizarTreino() {
    if (!usuarioDbId || !user?.id) {
      setConcluido(true)
      return
    }

    setConcluindo(true)

    const exerciciosResumo = treino.exercicios.map((ex) => ({
      nome: ex.nome,
      series_feitas: ex.series_feitas.length,
      met: ex.met || 0,
      duracao_min: Math.max(1, Math.round(Number(ex.series) * 2.5)),
    }))
    const duracaoTotalMin = exerciciosResumo.reduce((acc, e) => acc + e.duracao_min, 0)

    try {
      const planoId = isPlanoUuid(treino.id) ? treino.id : null
      const { error: insertErr } = await supabase.from('treinos_realizados').insert({
        usuario_id: usuarioDbId,
        plano_id: planoId,
        nome: treino.nome,
        exercicios: exerciciosResumo,
        duracao_min: duracaoTotalMin,
        kcal_gastas: null,
        concluido: true,
      })
      if (insertErr) throw insertErr

      const gRes = await fetchGamificacaoResumo()
      if (gRes.data?.ok) {
        const r = gRes.data
        const rank =
          r.ranking_opt_in && r.posicao_ranking > 0
            ? ` · Ranking #${r.posicao_ranking}`
            : ''
        setGamifToast(`Pontos da semana: ${r.pontos_semana}${rank}`)
      }

      const hook = import.meta.env.VITE_N8N_WEBHOOK_TREINO
      if (hook) {
        await fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_id: usuarioDbId,
            exercicios: exerciciosResumo,
            duracao_total_min: duracaoTotalMin,
          }),
        })
      }
    } catch {
      /* sessao concluida na UI mesmo se gravacao falhar */
    }

    setConcluido(true)
    setConcluindo(false)
  }

  if (!treinoSelecionadoId) {
    return (
      <div style={{
        minHeight: '100dvh', padding: '16px', paddingTop: 'calc(var(--safe-top) + 12px)',
        paddingBottom: 'calc(86px + var(--safe-bottom))', display: 'flex',
        flexDirection: 'column', gap: 12, overflowY: 'auto',
      }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 900 }}>Treinos</h1>

        {listaLoading && (
          <div style={{
            borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: 'var(--text-muted)', padding: 14, fontSize: 13,
          }}>
            Carregando treinos...
          </div>
        )}

        {!listaLoading && listaError && (
          <div style={{
            borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: '#ff7676', padding: 14, fontSize: 13,
          }}>
            {listaError}
          </div>
        )}

        <div style={{
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <button
            onClick={() => setBuilderExpandido((prev) => !prev)}
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            Treino personalizado
            <span style={{ color: 'var(--text-muted)' }}>{builderExpandido ? '▴' : '▾'}</span>
          </button>

          {builderExpandido && (
            <>
              <input
                value={builderNome}
                onChange={(e) => setBuilderNome(e.target.value)}
                placeholder="Nome do treino"
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 10,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  padding: '0 10px',
                }}
              />

              <select
                value={builderCategoria}
                onChange={(e) => setBuilderCategoria(e.target.value)}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 10,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  padding: '0 10px',
                  color: 'var(--text)',
                }}
              >
                {CATEGORIAS.filter((cat) => cat.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {builderExercicios.map((exercicio, index) => (
                  <div
                    key={exercicio.id}
                    style={{
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      padding: 10,
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)' }}>Exercicio {index + 1}</p>
                      <button
                        onClick={() => removerExercicioBuilder(exercicio.id)}
                        disabled={builderExercicios.length === 1}
                        style={{
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-muted)',
                          fontSize: 12,
                          padding: '4px 8px',
                        }}
                      >
                        Remover
                      </button>
                    </div>

                    <input
                      value={exercicio.nome}
                      onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'nome', e.target.value)}
                      placeholder="Nome do exercicio"
                      style={{
                        width: '100%',
                        height: 38,
                        borderRadius: 10,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        padding: '0 10px',
                      }}
                    />

                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                      <input
                        value={exercicio.series}
                        onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'series', e.target.value)}
                        placeholder="Series"
                        inputMode="numeric"
                        style={{
                          width: '100%',
                          height: 38,
                          borderRadius: 10,
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          padding: '0 10px',
                        }}
                      />
                      <input
                        value={exercicio.repeticoes}
                        onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'repeticoes', e.target.value)}
                        placeholder="Reps"
                        inputMode="numeric"
                        style={{
                          width: '100%',
                          height: 38,
                          borderRadius: 10,
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          padding: '0 10px',
                        }}
                      />
                      <input
                        value={exercicio.carga}
                        onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'carga', e.target.value)}
                        placeholder="Carga kg"
                        inputMode="numeric"
                        style={{
                          width: '100%',
                          height: 38,
                          borderRadius: 10,
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          padding: '0 10px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={adicionarExercicioBuilder}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    fontWeight: 700,
                    padding: '10px 12px',
                  }}
                >
                  + Adicionar exercicio
                </button>
                <button
                  type="button"
                  onClick={salvarTreinoPersonalizado}
                  disabled={!builderValido || builderSalvando}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    border: '1px solid transparent',
                    background: builderValido && !builderSalvando ? 'var(--green)' : 'var(--bg-input)',
                    color: builderValido && !builderSalvando ? '#111' : 'var(--text-muted)',
                    fontWeight: 800,
                    padding: '10px 12px',
                  }}
                >
                  {builderSalvando ? 'Salvando...' : 'Salvar treino'}
                </button>
              </div>

              {builderMensagem.texto && (
                <p style={{
                  fontSize: 12,
                  color: builderMensagem.tipo === 'erro' ? '#ff7676' : 'var(--green)',
                  fontWeight: 700,
                }}>
                  {builderMensagem.texto}
                </p>
              )}
            </>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar treino..."
            style={{
              width: '100%', height: 44, borderRadius: 12, background: 'var(--bg-input)',
              border: '1px solid var(--border)', padding: '0 44px 0 12px', fontSize: 14,
            }}
          />
          <span style={{ position: 'absolute', right: 14, top: 12, color: 'var(--green)' }}>⌕</span>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {CATEGORIAS.map((cat) => {
            const ativo = cat.id === filtroCategoria
            return (
              <button
                key={cat.id}
                onClick={() => setFiltroCategoria(cat.id)}
                style={{
                  whiteSpace: 'nowrap', borderRadius: 12, padding: '8px 12px',
                  fontSize: 12, fontWeight: 700, border: '1px solid var(--border)',
                  background: ativo ? 'var(--green)' : 'var(--bg-card)',
                  color: ativo ? '#111' : 'var(--text-muted)',
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {personais.map((personal) => {
            const ativo = personal === filtroPersonal
            return (
              <button
                key={personal}
                onClick={() => setFiltroPersonal(personal)}
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
                {personal === 'todos' ? 'Todos os personais' : personal}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!listaLoading && treinosFiltrados.map((t, i) => (
            <button
              key={t.id}
              onClick={() => selecionarTreino(t)}
              style={{
                textAlign: 'left', borderRadius: 16, border: '1px solid var(--border)',
                background: 'var(--bg-card)', overflow: 'hidden', animation: `floatIn .25s ease ${i * 0.05}s both`,
                color: 'var(--text)',
              }}
            >
              <div style={{
                minHeight: 145,
                backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.72), rgba(0,0,0,0.25)), url(${t.thumb})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                padding: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, background: 'rgba(0,0,0,0.42)',
                    border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 20,
                  }}>
                    {treinoIcone(t.categoria)}
                  </div>
                  <span style={{
                    padding: '6px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.14)', fontSize: 11, fontWeight: 700,
                    color: '#f5f7fa',
                  }}>
                    {labelCategoria(t.categoria)}
                  </span>
                  <span style={{
                    padding: '6px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.14)', fontSize: 11, fontWeight: 700,
                    color: '#f5f7fa',
                  }}>
                    {t.exercicios.length} exercicios
                  </span>
                  {t.personalizado && (
                    <span style={{
                      padding: '6px 10px', borderRadius: 999, background: 'rgba(201,242,77,0.2)',
                      border: '1px solid rgba(201,242,77,0.35)', fontSize: 11, fontWeight: 700,
                      color: '#f5f7fa',
                    }}>
                      Personalizado
                    </span>
                  )}
                </div>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', background: 'var(--green)',
                  color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                }}>
                  ▶
                </div>
              </div>
            </button>
          ))}

          {!listaLoading && treinosFiltrados.length === 0 && (
            <div style={{
              borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text-dim)', textAlign: 'center', padding: 18,
            }}>
              Nenhum treino encontrado para os filtros selecionados.
            </div>
          )}
        </div>
      </div>
    )
  }

  if (concluido) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', padding: 28, textAlign: 'center',
      }}>
        <div style={{
          width: 84, height: 84, borderRadius: '50%', background: 'var(--green)',
          color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, marginBottom: 16, boxShadow: 'var(--shadow-glow)',
        }}>
          ✓
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 8 }}>Treino concluido!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: gamifToast ? 10 : 20 }}>
          Saldo atualizado e envio para WhatsApp em andamento.
        </p>
        {gamifToast && (
          <p style={{
            color: 'var(--green)', fontWeight: 700, fontSize: 14, marginBottom: 20,
            maxWidth: 320, lineHeight: 1.4,
          }}>
            {gamifToast}
          </p>
        )}
        <button
          onClick={() => { setConcluido(false); setTreinoSelecionadoId(null) }}
          style={{
            background: 'var(--green)', color: '#111', borderRadius: 12,
            fontWeight: 800, padding: '12px 18px',
          }}
        >
          Voltar para catalogo
        </button>
      </div>
    )
  }

  return (
    <div style={{
      height: '100dvh', minHeight: 0, display: 'flex', flexDirection: 'column',
      paddingTop: 'var(--safe-top)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <div style={{
          borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', minHeight: 150,
          backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.7), rgba(0,0,0,0.25)), url(${treino.thumb || THUMB_PERSONALIZADO})`,
          backgroundSize: 'cover', backgroundPosition: 'center', padding: 12, display: 'flex',
          flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setTreinoSelecionadoId(null)}
              style={{
                width: 30, height: 30, borderRadius: 8, background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
              }}
            >
              ←
            </button>
            <span style={{
              padding: '6px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.2)', fontSize: 11, fontWeight: 700,
            }}>
              {concluidos}/{totalExercicios} feitos
            </span>
          </div>
          <div>
            <p style={{ fontSize: 28 }}>{treinoIcone(treino.categoria)}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Personal: {treino.personal}</p>
          </div>
        </div>

        <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progresso}%`, background: 'var(--green)', transition: 'width .4s ease' }} />
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px',
          paddingBottom: 'calc(88px + var(--safe-bottom))', display: 'flex',
          flexDirection: 'column', gap: 10,
        }}
      >
        {treino.exercicios.map((ex, i) => (
          <ExercicioCard
            key={ex.id}
            ex={ex}
            index={i}
            expandido={expandido === ex.id}
            onExpand={(id) => setExpandido((prev) => prev === id ? null : id)}
            onToggleSerie={toggleSerie}
            onToggleConcluido={toggleConcluido}
          />
        ))}

        {totalExercicios > 0 && (
          <button
            onClick={finalizarTreino}
            disabled={concluindo || concluidos !== totalExercicios}
            style={{
              width: '100%',
              padding: 16,
              borderRadius: 14,
              background: concluidos === totalExercicios ? 'var(--green)' : 'var(--bg-input)',
              color: concluidos === totalExercicios ? '#111' : 'var(--text-muted)',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              marginTop: 4,
              border: `1px solid ${concluidos === totalExercicios ? 'transparent' : 'var(--border)'}`,
            }}
          >
            {concluindo
              ? 'Enviando para WhatsApp...'
              : concluidos === totalExercicios
                ? 'Finalizar treino'
                : 'Conclua todos os exercicios para finalizar'}
          </button>
        )}
      </div>
    </div>
  )
}
