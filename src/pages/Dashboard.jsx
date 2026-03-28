import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { resolveUsuarioDb } from '../lib/usuarioDb'
import WeekCalendar from '../components/WeekCalendar'
import StreakWidget from '../components/StreakWidget'

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
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
  const [refeicoesHoje, setRefeicoesHoje] = useState([])

  useEffect(() => {
    let alive = true

    async function carregarResumoRapido() {
      if (!user?.id) {
        if (alive) {
          setErro('Usuario nao autenticado.')
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setErro('')

      try {
        const { usuarioId } = await resolveUsuarioDb(user)
        if (!usuarioId) throw new Error('Usuario nao encontrado.')

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
            .select('id, nome, exercicios, concluido, data_hora')
            .eq('usuario_id', usuarioId)
            .gte('data_hora', inicio.toISOString())
            .lt('data_hora', fim.toISOString())
            .eq('concluido', true)
            .order('data_hora', { ascending: false })
            .limit(1),
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
        const treinoConcluidoHoje = treinoRealizadoRes.data?.[0] || null
        const treinoPlanejadoHoje = treinoPlanoRes.data?.[0] || null
        setTreinoFoiConcluidoHoje(Boolean(treinoConcluidoHoje))
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
    const proteinas = refeicoesHoje.reduce((acc, r) => acc + toNum(r.proteina_g ?? r.proteina ?? r.proteinas_g ?? 0), 0)
    return { total, pendentes, kcal, proteinas }
  }, [refeicoesHoje])

  const exerciciosTreinoHoje = Array.isArray(treinoHoje?.exercicios) ? treinoHoje.exercicios.length : 0

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
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ola, {nomeSaudacao}</p>
      </div>

      <StreakWidget />

      <WeekCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {loading && (
        <div style={{
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: 'var(--text-muted)',
          padding: 14,
          fontSize: 13,
        }}>
          Carregando dados de treino e refeicoes...
        </div>
      )}

      {!loading && erro && (
        <div style={{
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: '#ff7676',
          padding: 14,
          fontSize: 13,
        }}>
          {erro}
        </div>
      )}

      {/* ─── Resumo Diário – Premium Card ─── */}
      {(() => {
        const KCAL_META = 2000
        const PROT_META = 150
        const kcalPct = Math.min(resumoRefeicoes.kcal / KCAL_META, 1)
        const protPct = Math.min(resumoRefeicoes.proteinas / PROT_META, 1)
        const circumference = 2 * Math.PI * 28
        const kcalOffset = circumference * (1 - kcalPct)
        const protOffset = circumference * (1 - protPct)

        const treinoStatus = treinoFoiConcluidoHoje
          ? { label: 'Concluído', color: '#34d399', bg: 'rgba(52,211,153,0.12)' }
          : treinoHoje
            ? { label: 'Pendente', color: '#efb144', bg: 'rgba(239,177,68,0.12)' }
            : { label: 'Descanso', color: '#8a8f97', bg: 'rgba(138,143,151,0.1)' }

        return (
          <div style={{
            borderRadius: 28,
            background: 'linear-gradient(145deg, rgba(15,16,18,0.95), rgba(23,25,29,0.85))',
            padding: 24,
            boxShadow: '0 12px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            animation: 'floatIn .5s ease-out',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative glow blob */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 120, height: 120,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,242,77,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 4, height: 22, borderRadius: 4,
                  background: 'linear-gradient(to bottom, var(--green), var(--green-dim))',
                }} />
                <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: -0.3 }}>
                  Resumo Diário
                </h2>
              </div>
              <span style={{
                background: 'rgba(201,242,77,0.1)',
                color: 'var(--green)',
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                border: '1px solid rgba(201,242,77,0.15)',
              }}>Hoje</span>
            </div>

            {/* ── Anel de Calorias + Proteínas ── */}
            <div style={{
              display: 'flex', gap: 16, marginBottom: 16,
            }}>
              {/* Calorias ring */}
              <div
                onClick={() => navigate('/nutricao')}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.025)',
                  borderRadius: 22,
                  padding: '20px 16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  border: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  animation: 'floatIn .5s ease-out .05s both',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(255,145,77,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ position: 'relative', width: 68, height: 68 }}>
                  <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="34" cy="34" r="28" fill="none"
                      stroke="url(#kcalGrad)" strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={kcalOffset}
                      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                    />
                    <defs>
                      <linearGradient id="kcalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ff914d" />
                        <stop offset="100%" stopColor="#ff5e5e" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff914d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>
                    {resumoRefeicoes.kcal}
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                    / {KCAL_META} kcal
                  </div>
                </div>
                <span style={{ color: '#ff914d', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>Calorias</span>
              </div>

              {/* Proteínas ring */}
              <div
                onClick={() => navigate('/nutricao')}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.025)',
                  borderRadius: 22,
                  padding: '20px 16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  border: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  animation: 'floatIn .5s ease-out .1s both',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(95,157,255,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ position: 'relative', width: 68, height: 68 }}>
                  <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="34" cy="34" r="28" fill="none"
                      stroke="url(#protGrad)" strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={protOffset}
                      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                    />
                    <defs>
                      <linearGradient id="protGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#5f9dff" />
                        <stop offset="100%" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f9dff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>
                    {resumoRefeicoes.proteinas}g
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                    / {PROT_META}g meta
                  </div>
                </div>
                <span style={{ color: '#5f9dff', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>Proteínas</span>
              </div>
            </div>

            {/* ── Treino + Refeições row ── */}
            <div style={{ display: 'flex', gap: 12 }}>
              {/* Treino card */}
              <div
                onClick={() => navigate('/treino')}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.025)',
                  borderRadius: 18,
                  padding: '16px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  border: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  animation: 'floatIn .5s ease-out .15s both',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(52,211,153,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m14.4 14.4 5.6 5.6" /><path d="M22 14.8v3.4c0 .8-.5 1.5-1.2 1.7l-1.3.4c-.6.2-1.3-.2-1.5-.8L18 19" /><path d="M10.8 19.2l-5.6-5.6" /><path d="M2.8 5.6 2 4.2c-.2-.6.2-1.3.8-1.5l1.3-.4c.8-.2 1.5.3 1.7 1.1L6 4.6" /><path d="m13.8 13.8 2-2" /><path d="m10.2 10.2-2 2" /><path d="m6.6 6.6-2 2" /><path d="m17.4 17.4-2 2" /><path d="M13 13 5 5" /><path d="m19 19-8-8" /><path d="M7.4 7.4 6 6c-.8-.8-.8-2 0-2.8s2-.8 2.8 0l1.4 1.4" /><path d="m16.6 16.6 1.4 1.4c.8.8.8 2 0 2.8s-2 .8-2.8 0l-1.4-1.4" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Treino</span>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 11, fontWeight: 700,
                    color: treinoStatus.color,
                    background: treinoStatus.bg,
                    padding: '2px 8px',
                    borderRadius: 8,
                    width: 'fit-content',
                    letterSpacing: 0.3,
                  }}>{treinoStatus.label}</span>
                </div>
              </div>

              {/* Refeições card */}
              <div
                onClick={() => navigate('/nutricao')}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.025)',
                  borderRadius: 18,
                  padding: '16px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  border: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  animation: 'floatIn .5s ease-out .2s both',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(201,242,77,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(201,242,77,0.15), rgba(201,242,77,0.05))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Refeições</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ color: 'var(--green)', fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>
                      {resumoRefeicoes.total}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 500 }}>registradas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
