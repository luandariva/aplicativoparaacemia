import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { usePortal } from '../portal/PortalContext'

type Dashboard = {
  alunosAtivos: number
  totalAlunos: number
  treinosSemana: number
  pontosSemanaAgregados?: number
  proximosTreinos: Array<{
    id: string
    nome: string
    data_prevista: string
    usuario_id: string
  }>
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const p = Math.min(100, Math.max(0, percent))
  const offset = c * (1 - p / 100)

  return (
    <svg className="portalRing" viewBox="0 0 120 120" aria-hidden>
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="#2a2a2a"
        strokeWidth="10"
      />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="#c9f24d"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
      />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconUsersBig() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconEnvelope() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m22 6-10 7L2 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

export function DashboardPage() {
  const { portalCall, member } = usePortal()
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [data, setData] = useState<Dashboard | null>(null)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        setErro(null)
        setLoading(true)
        const d = await portalCall<Dashboard>('portal_dashboard', {})
        if (mounted) setData(d)
      } catch (err: any) {
        if (mounted) setErro(err?.message || 'Erro ao carregar dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [portalCall])

  const engagementPct = useMemo(() => {
    if (!data?.totalAlunos) return 0
    return Math.round((data.alunosAtivos / Math.max(1, data.totalAlunos)) * 100)
  }, [data])

  if (!member) return null

  const academiaInicial = (member.academia?.nome?.[0] ?? 'A').toUpperCase()

  return (
    <div className="portalDashboard">
      <div className="portalDashboardMain">
        <header className="portalDashboardGreet">
          <div className="portalAvatar" aria-hidden>
            {academiaInicial}
          </div>
          <div className="portalGreetText">
            <p className="portalGreetHi">Olá, seja bem-vindo(a) de volta!</p>
            <h1 className="portalGreetTitle">Visão geral</h1>
            <p className="portalGreetMeta">
              {member.academia?.nome ?? 'Sua academia'} ·{' '}
              {member.papel === 'gestor' ? 'Gestor' : 'Personal'}
            </p>
          </div>
        </header>

        <p className="portalSectionLabel">Acesso rápido</p>
        <div className="portalSessions">
          <Link
            to="/dashboard"
            className={`portalSessionCard${location.pathname === '/dashboard' ? ' portalSessionCardActive' : ''}`}
          >
            <IconGrid />
            Início
          </Link>
          <Link
            to="/alunos"
            className={`portalSessionCard${location.pathname.startsWith('/alunos') ? ' portalSessionCardActive' : ''}`}
          >
            <IconUsersBig />
            Alunos
          </Link>
          {member.papel === 'gestor' && (
            <Link
              to="/convites"
              className={`portalSessionCard${location.pathname === '/convites' ? ' portalSessionCardActive' : ''}`}
            >
              <IconEnvelope />
              Convites
            </Link>
          )}
        </div>

        <p className="portalSectionLabel">Próximos treinos</p>
        {loading && <p className="portalPageDesc">Carregando…</p>}
        {erro && <p style={{ color: '#f87171' }}>{erro}</p>}
        {!loading && !erro && (
          <div className="portalChallengesGrid">
            {(data?.proximosTreinos?.length ?? 0) === 0 ? (
              <div className="portalCard" style={{ gridColumn: '1 / -1' }}>
                <p className="portalPageDesc" style={{ margin: 0 }}>
                  Nenhum plano futuro na fila.
                </p>
              </div>
            ) : (
              data?.proximosTreinos.map((t) => (
                <Link key={t.id} to={`/alunos/${t.usuario_id}`} className="portalChallengeCard">
                  <div className="portalChallengeInner">
                    <h2 className="portalChallengeTitle">{t.nome}</h2>
                    <p className="portalChallengeSub">Previsto: {t.data_prevista}</p>
                  </div>
                  <span className="portalChallengePlay" aria-hidden>
                    <PlayIcon />
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <aside className="portalStatsCard" aria-label="Indicadores">
        <h2 className="portalStatsCardTitle">Atividade</h2>
        <div className="portalRingRow">
          <ProgressRing percent={loading ? 0 : engagementPct} />
          <div className="portalRingLabel">
            <div className="portalRingPct">{loading ? '—' : `${engagementPct}%`}</div>
            <p className="portalRingCaption">
              Alunos ativos em relação ao total cadastrado na sua visão.
            </p>
          </div>
        </div>

        <div className="portalStatGrid">
          <div className="portalStatCell">
            <div className="portalStatCellLabel">Ativos</div>
            <div className="portalStatCellValue">{loading ? '—' : data?.alunosAtivos ?? 0}</div>
          </div>
          <div className="portalStatCell">
            <div className="portalStatCellLabel">Total</div>
            <div className="portalStatCellValue">{loading ? '—' : data?.totalAlunos ?? 0}</div>
          </div>
          <div className="portalStatCell">
            <div className="portalStatCellLabel">Treinos (sem.)</div>
            <div className="portalStatCellValue">{loading ? '—' : data?.treinosSemana ?? 0}</div>
          </div>
          <div className="portalStatCell">
            <div className="portalStatCellLabel">Pontos (sem.)</div>
            <div className="portalStatCellValue portalStatCellValueAccent">
              {loading ? '—' : data?.pontosSemanaAgregados ?? 0}
            </div>
          </div>
        </div>

        <Link to="/alunos" className="portalBtn portalBtnPrimary portalStatsCta">
          Ver lista de alunos
        </Link>
      </aside>
    </div>
  )
}
