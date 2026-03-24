import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchGamificacaoLeaderboard, fetchGamificacaoResumo, fetchUsuarioBadges, setDisplayName, setRankingOptIn } from '../lib/gamificacao'
import { resolveUsuarioDb } from '../lib/usuarioDb'
import { useAuth } from '../hooks/useAuth'

function Pill({ children, ativo, onClick, cor }) {
  return (
    <button
      onClick={onClick}
      style={{
        whiteSpace: 'nowrap', borderRadius: 12, padding: '8px 14px',
        fontSize: 12, fontWeight: 700, border: `1px solid ${ativo ? 'transparent' : 'var(--border)'}`,
        background: ativo ? (cor || 'var(--green)') : 'var(--bg-card)',
        color: ativo ? '#111' : 'var(--text-muted)',
        transition: 'all .2s',
      }}
    >
      {children}
    </button>
  )
}

function BadgeCard({ ub }) {
  const b = ub?.badge
  const data = ub?.concedido_em
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(ub.concedido_em))
    : null
  return (
    <div style={{
      borderRadius: 14, border: '1px solid rgba(201,242,77,0.25)',
      background: 'linear-gradient(145deg, rgba(201,242,77,0.07), rgba(201,242,77,0.02))',
      padding: 14, display: 'flex', flexDirection: 'column', gap: 6,
      animation: 'checkPop .35s ease',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(201,242,77,0.15)', border: '1px solid rgba(201,242,77,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>
        {b?.icone || '★'}
      </div>
      <p style={{ fontSize: 14, fontWeight: 700 }}>{b?.titulo || 'Conquista'}</p>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>{b?.descricao || ''}</p>
      {data && <p style={{ fontSize: 10, color: 'rgba(201,242,77,0.5)' }}>Obtido em {data}</p>}
    </div>
  )
}

function BadgeLocked({ slug }) {
  const INFO = {
    primeiro_treino: { icone: '🏋️', titulo: 'Primeiro treino', descricao: 'Conclua seu primeiro treino no app.' },
    desafio_semana: { icone: '🏆', titulo: 'Campeão da semana', descricao: 'Complete o desafio semanal (atividade, treinos e macros).' },
  }
  const b = INFO[slug] || { icone: '🔒', titulo: slug, descricao: 'Conquista ainda não obtida.' }
  return (
    <div style={{
      borderRadius: 14, border: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.02)',
      padding: 14, display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.5,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>
        {b.icone}
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>{b.titulo}</p>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>{b.descricao}</p>
      <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>Ainda não obtido</p>
    </div>
  )
}

const TABS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'badges', label: 'Conquistas' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'config', label: 'Config.' },
]

const ALL_BADGE_SLUGS = ['primeiro_treino', 'desafio_semana']

export default function Conquistas({ onVoltar, embeddedInPerfil }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('resumo')
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState(null)
  const [badges, setBadges] = useState([])
  const [board, setBoard] = useState([])
  const [meuUsuarioId, setMeuUsuarioId] = useState(null)
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [msg, setMsg] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!user?.id) { setLoading(false); return }
      setLoading(true)
      const { row, usuarioId } = await resolveUsuarioDb(user)
      if (alive) {
        setMeuUsuarioId(usuarioId)
        setNomeExibicao(row?.display_name || '')
        setOptIn(row?.ranking_opt_in !== false)
      }
      const [r1, r2, r3] = await Promise.all([
        fetchGamificacaoResumo(),
        fetchUsuarioBadges(usuarioId),
        fetchGamificacaoLeaderboard(30),
      ])
      if (alive) {
        if (r1.data?.ok) setResumo(r1.data)
        if (!r2.error) setBadges(r2.data || [])
        if (!r3.error) setBoard(r3.data || [])
        setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [user?.id])

  const badgeSlugsObtidos = new Set(badges.map(ub => ub.badge?.slug).filter(Boolean))
  const desafio = resumo?.desafio
  const prog = desafio?.progresso

  const pontosAtividade = resumo?.pontos_actividade || 0
  const pontosBonus = resumo?.pontos_bonus_desafio || 0
  const pontosTotal = resumo?.pontos_semana || 0
  const detalhe = resumo?.detalhe && typeof resumo.detalhe === 'object' ? resumo.detalhe : null
  const diasComResumo = detalhe?.dias_com_resumo

  async function salvarConfig() {
    setSalvando(true)
    setMsg('')
    const [r1, r2] = await Promise.all([
      setDisplayName(nomeExibicao),
      setRankingOptIn(optIn),
    ])
    setSalvando(false)
    if (r1 || r2) setMsg('Erro ao salvar. Tente novamente.')
    else setMsg('Configurações salvas!')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: embeddedInPerfil ? undefined : '100dvh',
      paddingTop: embeddedInPerfil ? 0 : 'calc(var(--safe-top) + 12px)',
      paddingBottom: embeddedInPerfil ? 0 : 'calc(86px + var(--safe-bottom))',
    }}>
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {!embeddedInPerfil && (
          <button
            type="button"
            onClick={() => (onVoltar ? onVoltar() : navigate('/'))}
            style={{
              width: 34, height: 34, borderRadius: 10, background: 'var(--bg-card)',
              border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 14,
            }}
          >
            ←
          </button>
        )}
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Gamificação</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, color: 'var(--green)', lineHeight: 1 }}>
            Conquistas
          </h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <Pill key={t.id} ativo={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Pill>
        ))}
      </div>

      <div style={{
        flex: embeddedInPerfil ? 'none' : 1,
        overflowY: embeddedInPerfil ? 'visible' : 'auto',
        minHeight: embeddedInPerfil ? undefined : 0,
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          </div>
        )}

        {!loading && tab === 'resumo' && (
          <>
            <div style={{
              borderRadius: 16, border: '1px solid var(--border)',
              background: 'linear-gradient(145deg, #13161b, #0a0c0f)', padding: 16,
            }}>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Pontos da semana
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Atividade', value: pontosAtividade, cor: 'var(--green)' },
                  { label: 'Bônus desafio', value: pontosBonus > 0 ? `+${pontosBonus}` : '—', cor: '#efb144' },
                  { label: 'Total', value: pontosTotal, cor: 'var(--green)' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 8px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{item.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: item.cor }}>{item.value}</p>
                  </div>
                ))}
              </div>
              {typeof diasComResumo === 'number' && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 12, lineHeight: 1.45 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Dias com registro nesta semana:</span>{' '}
                  <span style={{ fontWeight: 800, color: 'var(--green)' }}>{diasComResumo}</span>
                  {' '}de 7 · os pontos de atividade vêm dos dias em que há refeição ou treino registrado, macros no alvo e treinos concluídos (ver regras abaixo).
                </p>
              )}
            </div>

            <div style={{
              borderRadius: 16, border: `1px solid ${prog?.completo ? 'rgba(201,242,77,0.35)' : 'var(--border)'}`,
              background: prog?.completo ? 'rgba(201,242,77,0.06)' : 'var(--bg-card)', padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: prog?.completo ? 'var(--green)' : 'var(--text)' }}>
                  {prog?.completo ? '🏆 Desafio concluído!' : (desafio?.titulo || 'Desafio da semana')}
                </p>
                {!prog?.completo && desafio && (
                  <span style={{ fontSize: 11, background: 'rgba(239,177,68,0.15)', color: '#efb144', borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}>
                    +{desafio.bonus_pontos} pts
                  </span>
                )}
              </div>
              {prog && !prog.completo && desafio && (
                <>
                  {[
                    { label: 'Dias ativos', atual: prog.dias_atividade, meta: desafio.min_dias_atividade, cor: 'var(--blue)' },
                    { label: 'Treinos na semana', atual: prog.treinos_semana, meta: desafio.min_treinos, cor: 'var(--amber)' },
                    { label: 'Dias com macros no alvo', atual: prog.dias_macros, meta: desafio.min_dias_macros, cor: '#a78bfa' },
                  ].map(bar => {
                    const pct = bar.meta > 0 ? Math.min(100, Math.round((bar.atual / bar.meta) * 100)) : 0
                    const ok = bar.atual >= bar.meta
                    return (
                      <div key={bar.label} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: ok ? 'var(--green)' : 'var(--text-muted)' }}>{ok ? '✓ ' : ''}{bar.label}</span>
                          <span style={{ color: 'var(--text-dim)' }}>{bar.atual}/{bar.meta}</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: ok ? 'var(--green)' : bar.cor, borderRadius: 999, transition: 'width .5s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            <div style={{
              borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 14,
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Como ganhar pontos</p>
              {[
                { acao: 'Registrar refeição ou treino', pts: '+10 pts/dia' },
                { acao: 'Macros no alvo (±10%)', pts: '+15 pts/dia' },
                { acao: 'Treino concluído', pts: '+20 pts (máx 2/dia)' },
                { acao: 'Completar desafio semanal', pts: '+25 pts bônus' },
              ].map((item, i, arr) => (
                <div key={item.acao} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '9px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.acao}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{item.pts}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && tab === 'badges' && (
          <>
            {badges.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: 'rgba(201,242,77,0.75)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 800 }}>
                  Conquistas obtidas ({badges.length})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {badges.map(ub => <BadgeCard key={ub.id} ub={ub} />)}
                </div>
              </div>
            )}

            {ALL_BADGE_SLUGS.filter(s => !badgeSlugsObtidos.has(s)).length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: badges.length > 0 ? 4 : 0 }}>
                  Bloqueadas
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {ALL_BADGE_SLUGS
                    .filter(s => !badgeSlugsObtidos.has(s))
                    .map(slug => <BadgeLocked key={slug} slug={slug} />)}
                </div>
              </div>
            )}

            {badges.length === 0 && ALL_BADGE_SLUGS.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🏅</p>
                <p>Complete treinos e desafios para desbloquear conquistas.</p>
              </div>
            )}
          </>
        )}

        {!loading && tab === 'ranking' && (
          <>
            {!resumo?.ranking_opt_in ? (
              <div style={{
                borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)',
                padding: 16, textAlign: 'center',
              }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>👻</p>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Você está no modo privado.</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Ative o ranking na aba Config. para aparecer na lista.</p>
                <button onClick={() => setTab('config')} style={{
                  background: 'var(--green)', color: '#111', borderRadius: 10,
                  fontWeight: 800, padding: '10px 18px', fontSize: 13,
                }}>
                  Ir para Config.
                </button>
              </div>
            ) : (
              <>
                {resumo?.posicao_ranking > 0 && (
                  <div style={{
                    borderRadius: 14, border: '1px solid rgba(201,242,77,0.35)',
                    background: 'rgba(201,242,77,0.07)', padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ fontSize: 28 }}>
                      {resumo.posicao_ranking === 1 ? '🥇' : resumo.posicao_ranking === 2 ? '🥈' : resumo.posicao_ranking === 3 ? '🥉' : '🏅'}
                    </span>
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sua posição esta semana</p>
                      <p style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--green)' }}>
                        #{resumo.posicao_ranking}
                        {resumo.participantes_ranking > 1 && (
                          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 400 }}> de {resumo.participantes_ranking}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>
                  {board.length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                      Nenhum participante com pontos esta semana.
                    </div>
                  )}
                  {board.map((row, i) => {
                    const souEu = meuUsuarioId && row.usuario_id === meuUsuarioId
                    const medalha = row.posicao === 1 ? '🥇' : row.posicao === 2 ? '🥈' : row.posicao === 3 ? '🥉' : null
                    return (
                      <div key={`${row.posicao}-${row.usuario_id}`} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                        borderBottom: i < board.length - 1 ? '1px solid var(--border)' : 'none',
                        background: souEu ? 'rgba(201,242,77,0.07)' : 'transparent',
                      }}>
                        <span style={{ fontSize: 15, minWidth: 24, color: 'var(--text-dim)', fontWeight: 700 }}>
                          {medalha || `${row.posicao}.`}
                        </span>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: souEu ? 'rgba(201,242,77,0.2)' : 'rgba(255,255,255,0.06)',
                          border: souEu ? '1px solid rgba(201,242,77,0.4)' : '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 800, color: souEu ? 'var(--green)' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}>
                          {row.display_label?.slice(0, 1)?.toUpperCase() || '?'}
                        </div>
                        <p style={{ flex: 1, fontSize: 13, color: souEu ? 'var(--green)' : 'var(--text)', fontWeight: souEu ? 700 : 400 }}>
                          {row.display_label}{souEu ? ' (você)' : ''}
                        </p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>{row.pontos} pts</p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {!loading && tab === 'config' && (
          <>
            <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Nome de exibição</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
                Como seu nome aparece no ranking público.
              </p>
              <input
                value={nomeExibicao}
                onChange={e => setNomeExibicao(e.target.value)}
                placeholder="Nome exibido no ranking..."
                maxLength={50}
                style={{
                  width: '100%', height: 44, borderRadius: 10, padding: '0 12px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  fontSize: 14, color: 'var(--text)',
                }}
              />
            </div>

            <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>Ranking público</p>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {optIn ? 'Público: seus pontos entram no leaderboard.' : 'Privado: você não aparece no ranking.'}
                  </p>
                </div>
                <button
                  onClick={() => setOptIn(v => !v)}
                  style={{
                    width: 48, height: 26, borderRadius: 13, position: 'relative',
                    background: optIn ? 'var(--green)' : 'rgba(255,255,255,0.1)',
                    border: 'none', transition: 'background .2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: optIn ? 24 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: optIn ? '#111' : 'var(--text-dim)',
                    transition: 'left .2s',
                  }} />
                </button>
              </div>
            </div>

            {msg && (
              <p style={{ fontSize: 13, color: msg.includes('Erro') ? '#ff7676' : 'var(--green)', fontWeight: 700, textAlign: 'center' }}>
                {msg}
              </p>
            )}

            <button
              onClick={salvarConfig}
              disabled={salvando}
              style={{
                width: '100%', padding: 15, borderRadius: 14, background: 'var(--green)',
                color: '#111', fontWeight: 800, fontSize: 14,
                opacity: salvando ? 0.7 : 1,
              }}
            >
              {salvando ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
