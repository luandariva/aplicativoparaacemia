import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchGamificacaoResumo } from '../lib/gamificacao'

const SPRING = 'cubic-bezier(.34,1.56,.64,1)'

function RingProgress({ pct, size = 60, stroke = 5, color = 'var(--green)', children }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: `stroke-dashoffset .65s ${SPRING}` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}

function DesafioBar({ label, atual, meta, cor, completo }) {
  const pct = completo ? 100 : (meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0)
  const ok = completo || atual >= meta
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: ok ? 'var(--green)' : 'var(--text-muted)' }}>
          {ok ? '✓ ' : ''}{label}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>{completo ? `${meta}/${meta}` : `${atual}/${meta}`}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: ok ? 'var(--green)' : cor, borderRadius: 999,
          transition: `width .55s ${SPRING}`,
        }} />
      </div>
    </div>
  )
}

/**
 * Widget do Dashboard: pontos da semana (anel), desafio semanal (3 barras) e posição no ranking.
 * Dados via `rpc_gamificacao_resumo`.
 */
export default function GamifWidget({ onVerConquistas }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!user?.id) {
      setLoading(false)
      setData(null)
      return () => { alive = false }
    }
    setLoading(true)
    fetchGamificacaoResumo().then(({ data: d }) => {
      if (!alive) return
      if (d?.ok) setData(d)
      else setData(null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [user?.id])

  if (!user?.id) return null

  if (loading) {
    return (
      <div style={{
        borderRadius: 16, border: '1px solid var(--border)',
        background: 'var(--bg-card)', padding: 14, minHeight: 80,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: 16, height: 16, border: '2px solid var(--border)',
          borderTopColor: 'var(--green)', borderRadius: '50%',
          animation: 'spin .7s linear infinite',
        }} />
      </div>
    )
  }

  if (!data) return null

  const desafio = data.desafio
  const prog = desafio?.progresso
  const pontos = data.pontos_semana || 0
  const bonus = data.pontos_bonus_desafio || 0
  const maxSemana = 7 * (10 + 15 + 40) + (desafio?.bonus_pontos || 25)
  const pctSemana = Math.min(100, Math.round((pontos / maxSemana) * 100))
  const desafioOk = prog?.completo

  return (
    <div style={{
      borderRadius: 16, border: '1px solid var(--border)',
      background: 'linear-gradient(145deg, #13161b, #0a0c0f)',
      padding: 14, animation: 'floatIn .4s ease .08s both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pontos da semana
        </p>
        <button
          type="button"
          onClick={onVerConquistas}
          style={{
            fontSize: 11, color: 'var(--green)', fontWeight: 700, background: 'none',
            border: '1px solid rgba(201,242,77,0.3)', borderRadius: 8, padding: '4px 10px',
          }}
        >
          Perfil →
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <RingProgress pct={pctSemana} size={64} stroke={5}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>{pontos}</p>
            <p style={{ fontSize: 9, color: 'var(--text-dim)' }}>pts</p>
          </div>
        </RingProgress>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
              <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>Atividade</p>
              <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--green)' }}>
                {data.pontos_actividade ?? 0}
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
              <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>Bônus desafio</p>
              <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color: bonus > 0 ? '#efb144' : 'var(--text-dim)' }}>
                {bonus > 0 ? `+${bonus}` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {desafio && prog && (
        <div style={{
          background: desafioOk ? 'rgba(201,242,77,0.07)' : 'rgba(255,255,255,0.03)',
          borderRadius: 12, padding: '10px 12px',
          border: `1px solid ${desafioOk ? 'rgba(201,242,77,0.3)' : 'var(--border)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: desafioOk ? 'var(--green)' : 'var(--text-muted)' }}>
              {desafioOk ? '🏆 Desafio concluído!' : desafio.titulo}
            </p>
            {!desafioOk && (
              <span style={{
                fontSize: 10, background: 'rgba(239,177,68,0.15)', color: '#efb144',
                borderRadius: 6, padding: '3px 8px', fontWeight: 700,
              }}>
                +{desafio.bonus_pontos} pts
              </span>
            )}
          </div>
          <DesafioBar label="Dias ativos" atual={prog.dias_atividade} meta={desafio.min_dias_atividade} cor="var(--blue)" completo={desafioOk} />
          <DesafioBar label="Treinos" atual={prog.treinos_semana} meta={desafio.min_treinos} cor="var(--amber)" completo={desafioOk} />
          <DesafioBar label="Macros no alvo" atual={prog.dias_macros} meta={desafio.min_dias_macros} cor="#a78bfa" completo={desafioOk} />
        </div>
      )}

      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px',
      }}>
        <span style={{ fontSize: 18 }}>{data.ranking_opt_in ? '🏅' : '👻'}</span>
        {data.ranking_opt_in && data.posicao_ranking > 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Ranking da semana:{' '}
            <span style={{ color: 'var(--green)', fontWeight: 800 }}>#{data.posicao_ranking}</span>
            {data.participantes_ranking > 1 && (
              <span style={{ color: 'var(--text-dim)' }}> de {data.participantes_ranking}</span>
            )}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Ranking privado — ative em <span style={{ color: 'var(--green)', fontWeight: 700 }}>Perfil</span> (aba Config.).
          </p>
        )}
      </div>
    </div>
  )
}
