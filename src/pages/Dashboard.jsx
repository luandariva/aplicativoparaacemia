import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { resolveUsuarioDb } from '../lib/usuarioDb'
import WeekCalendar from '../components/WeekCalendar'
import StreakWidget from '../components/StreakWidget'
import './Dashboard.css'

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizePesoKg(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function estimarKcalTreinoRealizado(treinoRealizado, pesoKg) {
  const kcalSalva = Number(treinoRealizado?.kcal_gastas)
  if (Number.isFinite(kcalSalva) && kcalSalva > 0) return kcalSalva
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return 0
  if (!Array.isArray(treinoRealizado?.exercicios)) return 0

  const total = treinoRealizado.exercicios.reduce((acc, ex) => {
    const met = Number(ex?.met) || 0
    if (met <= 0) return acc
    const duracaoMinRaw = Number(ex?.duracao_min)
    const series = Math.max(1, Number(ex?.series) || 1)
    const duracaoMin = Number.isFinite(duracaoMinRaw) && duracaoMinRaw > 0
      ? duracaoMinRaw
      : Math.max(1, Math.round(series * 2.5))
    const kcalEx = (met * 3.5 * pesoKg / 200) * duracaoMin
    return acc + kcalEx
  }, 0)

  return Number.isFinite(total) && total > 0 ? total : 0
}

function inicioEFimDoDia(baseDate = new Date()) {
  const inicio = new Date(baseDate)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  return { inicio, fim }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [treinoHoje, setTreinoHoje] = useState(null)
  const [treinoFoiConcluidoHoje, setTreinoFoiConcluidoHoje] = useState(false)
  const [treinosRealizadosHoje, setTreinosRealizadosHoje] = useState([])
  const [refeicoesHoje, setRefeicoesHoje] = useState([])

  useEffect(() => {
    let alive = true

    async function carregarResumoRapido() {
      if (!user?.id) {
        if (alive) {
          setErro('Usuario não autenticado.')
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setErro('')

      try {
        const { usuarioId, row } = await resolveUsuarioDb(user)
        if (!usuarioId) throw new Error('Usuario não encontrado.')
        const pesoUsuarioKg = normalizePesoKg(row?.peso_atual_kg)

        const { inicio, fim } = inicioEFimDoDia(selectedDate)
        const hojeIso = inicio.toISOString().slice(0, 10)

        const [treinoPlanoRes, treinoRealizadoRes, refeicoesRes] = await Promise.all([
          supabase
            .from('treinos_plano')
            .select('id, nome, categoria, exercicios, data_prevista')
            .eq('usuario_id', usuarioId)
            .eq('data_prevista', hojeIso)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('treinos_realizados')
            .select('id, nome, exercicios, concluido, data_hora, kcal_gastas')
            .eq('usuario_id', usuarioId)
            .gte('data_hora', inicio.toISOString())
            .lt('data_hora', fim.toISOString())
            .eq('concluido', true)
            .order('data_hora', { ascending: false }),
          supabase
            .from('refeicoes')
            .select('*')
            .eq('usuario_id', usuarioId)
            .gte('data_hora', inicio.toISOString())
            .lt('data_hora', fim.toISOString())
            .order('data_hora', { ascending: true }),
        ])

        if (treinoPlanoRes.error) throw treinoPlanoRes.error
        if (treinoRealizadoRes.error) throw treinoRealizadoRes.error
        if (refeicoesRes.error) throw refeicoesRes.error

        if (!alive) return
        const treinosConcluidosHoje = treinoRealizadoRes.data || []
        const treinoConcluidoHoje = treinosConcluidosHoje[0] || null
        const treinoPlanejadoHoje = treinoPlanoRes.data?.[0] || null
        setTreinoFoiConcluidoHoje(Boolean(treinoConcluidoHoje))
        setTreinosRealizadosHoje(
          treinosConcluidosHoje.map((t) => ({
            ...t,
            kcal_gastas_calc: estimarKcalTreinoRealizado(t, pesoUsuarioKg),
          })),
        )
        setTreinoHoje(treinoConcluidoHoje || treinoPlanejadoHoje || null)
        setRefeicoesHoje(refeicoesRes.data || [])
      } catch (err) {
        if (alive) setErro(err?.message || 'Falha ao carregar resumo do dia.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    carregarResumoRapido()
    return () => { alive = false }
  }, [user?.id, user?.email, selectedDate])

  const nomeSaudacao = useMemo(() => {
    const nomeEmail = String(user?.email || '').split('@')[0]
    return nomeEmail || 'Aluno'
  }, [user?.email])

  const resumoRefeicoes = useMemo(() => {
    const total = refeicoesHoje.length
    const pendentes = refeicoesHoje.filter((r) => String(r.status || '').toLowerCase().includes('pend')).length
    const kcal = refeicoesHoje.reduce((acc, r) => acc + toNum(r.kcal ?? r.calorias ?? r.calorias_kcal), 0)
    return { total, pendentes, kcal }
  }, [refeicoesHoje])

  const kcalTreinoDia = useMemo(() => {
    const total = treinosRealizadosHoje.reduce(
      (acc, t) => acc + toNum(t.kcal_gastas_calc ?? t.kcal_gastas),
      0,
    )
    return Math.max(0, Math.round(total))
  }, [treinosRealizadosHoje])

  const exerciciosTreinoHoje = Array.isArray(treinoHoje?.exercicios) ? treinoHoje.exercicios.length : 0

  return (
    <div className="dashboard-container">
      <div className="anim">
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Olá, {nomeSaudacao}</p>
      </div>

      <StreakWidget />

      <WeekCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {loading && (
        <div className="dash-loading anim">
          Carregando dados de treino e refeicoes...
        </div>
      )}

      {!loading && erro && (
        <div className="dash-warning anim">
          {erro}
        </div>
      )}

      {/* ─── Resumo Diário – Premium Card ─── */}
      {(() => {
        const KCAL_META = 2000
        const TREINO_KCAL_META = 500
        const kcalPct = Math.min(resumoRefeicoes.kcal / KCAL_META, 1)
        const treinoKcalPct = Math.min(kcalTreinoDia / TREINO_KCAL_META, 1)
        const balancoCalorico = resumoRefeicoes.kcal - KCAL_META
        const circumference = 2 * Math.PI * 28
        const kcalOffset = circumference * (1 - kcalPct)
        const treinoKcalOffset = circumference * (1 - treinoKcalPct)

        const treinoStatus = treinoFoiConcluidoHoje
          ? { label: 'Concluído', color: 'var(--lime)', bg: 'rgba(75,240,122,0.12)' }
          : treinoHoje
            ? { label: 'Pendente', color: 'var(--amber)', bg: 'rgba(240,168,75,0.12)' }
            : { label: 'Descanso', color: 'var(--text-3)', bg: 'var(--bg-3)' }

        return (
          <div className="resumo-card anim-2">
            <div className="resumo-card-glow" />

            <div className="resumo-header">
              <div className="resumo-title-wrapper">
                <div className="resumo-title-bar" />
                <h2 className="resumo-title">Resumo Diário</h2>
              </div>
              <span className="resumo-badge">Hoje</span>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div className="ring-card kcal" onClick={() => navigate('/nutricao')}>
                <div style={{ position: 'relative', width: 68, height: 68 }}>
                  <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="34" cy="34" r="28" fill="none" stroke="url(#kcalGrad)" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={kcalOffset} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                    <defs>
                      <linearGradient id="kcalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--amber)" />
                        <stop offset="100%" stopColor="var(--red)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>
                    {balancoCalorico > 0 ? '+' : ''}{balancoCalorico}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                    meta {KCAL_META} kcal
                  </div>
                </div>
                <span style={{ color: 'var(--amber)', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>Balanço calórico</span>
              </div>

              <div className="ring-card prot" onClick={() => navigate('/treino')}>
                <div style={{ position: 'relative', width: 68, height: 68 }}>
                  <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="34" cy="34" r="28" fill="none" stroke="url(#protGrad)" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={treinoKcalOffset} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                    <defs>
                      <linearGradient id="protGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--blue)" />
                        <stop offset="100%" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>{kcalTreinoDia}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 500, marginTop: 2 }}>kcal no dia</div>
                </div>
                <span style={{ color: 'var(--blue)', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>Gasto no treino</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div className="action-card cardio" onClick={() => navigate('/treino')}>
                <div className="action-icon cardio-bg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m14.4 14.4 5.6 5.6" /><path d="M22 14.8v3.4c0 .8-.5 1.5-1.2 1.7l-1.3.4c-.6.2-1.3-.2-1.5-.8L18 19" /><path d="M10.8 19.2l-5.6-5.6" /><path d="M2.8 5.6 2 4.2c-.2-.6.2-1.3.8-1.5l1.3-.4c.8-.2 1.5.3 1.7 1.1L6 4.6" /><path d="m13.8 13.8 2-2" /><path d="m10.2 10.2-2 2" /><path d="m6.6 6.6-2 2" /><path d="m17.4 17.4-2 2" /><path d="M13 13 5 5" /><path d="m19 19-8-8" /><path d="M7.4 7.4 6 6c-.8-.8-.8-2 0-2.8s2-.8 2.8 0l1.4 1.4" /><path d="m16.6 16.6 1.4 1.4c.8.8.8 2 0 2.8s-2 .8-2.8 0l-1.4-1.4" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Treino</span>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: treinoStatus.color, background: treinoStatus.bg, padding: '2px 8px', borderRadius: 8, width: 'fit-content', letterSpacing: 0.3 }}>{treinoStatus.label}</span>
                </div>
              </div>

              <div className="action-card meals" onClick={() => navigate('/nutricao')}>
                <div className="action-icon meals-bg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Refeições</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ color: 'var(--lime)', fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>{resumoRefeicoes.total}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 500 }}>registradas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Desafio da Semana ─── */}
      <div className="desafio-card anim-3">
        <div className="desafio-body">
          <div className="desafio-header">
            <div className="desafio-title-wrap">
              <span className="desafio-title-mark" />
              <h2 className="desafio-title">Desafio da Semana</h2>
            </div>
            <span className="tag tag-lime desafio-badge">Ativo</span>
          </div>

          <div className="desafio-main">
            <div className="desafio-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="17" cy="4" r="2" />
                <path d="M15.5 7.5 12 10l-3 2.5" />
                <path d="m7 16 3-3 2.5 1.5L16 11" />
                <path d="M3 20h2l3.5-7" />
                <path d="M18 13l3 7h-3" />
              </svg>
            </div>
            <div className="desafio-content">
              <span className="desafio-subtitle">Corrida ao ar livre</span>
              <p className="desafio-description">
                Complete uma corrida esta semana e registre sua atividade no treino.
              </p>
              <span className="desafio-deadline">Até domingo</span>
            </div>
          </div>

          <div className="desafio-stats">
            <div className="desafio-stat">
              <span className="stat-value">5 km</span>
              <span className="stat-label">Meta mínima</span>
            </div>
            <div className="desafio-stat">
              <span className="stat-value">+50 XP</span>
              <span className="stat-label">Recompensa</span>
            </div>
            <div className="desafio-stat">
              <span className="stat-value">12</span>
              <span className="stat-label">Participando</span>
            </div>
          </div>

          <button className="desafio-btn btn-primary" onClick={() => navigate('/treino')}>
            Aceitar desafio
          </button>
        </div>
      </div>
    </div>
  )
}
