import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { usePortal } from '../portal/PortalContext'

type TreinoCat = {
  id: string
  nome: string
  data_prevista: string
  categoria: string | null
  created_at?: string
  personais?: { nome: string | null } | null
}

export function TreinosAcademiaPage() {
  const { portalCall, member } = usePortal()
  const [treinos, setTreinos] = useState<TreinoCat[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const podeVer = member?.papel === 'personal' || member?.papel === 'gestor'

  useEffect(() => {
    if (!podeVer) return
    let mounted = true
    setLoading(true)
    setErro(null)
    ;(async () => {
      try {
        const d = await portalCall<{ treinos: TreinoCat[] }>('portal_treinos_catalogo', {})
        if (mounted) setTreinos(d.treinos ?? [])
      } catch (e: unknown) {
        if (mounted) setErro((e as Error)?.message || 'Erro ao carregar treinos.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [portalCall, podeVer])

  if (member && !podeVer) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link to="/dashboard" style={{ color: '#9ca3af' }}>
          ← Início
        </Link>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 10,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Treinos da academia</h1>
          {member?.papel === 'personal' && (
            <Link to="/treinos-academia/novo" className="portalBtn portalBtnPrimary" style={{ textDecoration: 'none' }}>
              Novo treino
            </Link>
          )}
        </div>
        <p className="portalPageDesc" style={{ marginTop: 8, maxWidth: 560 }}>
          Modelos sem aluno vinculado ficam disponíveis no app para todos os alunos ativos desta unidade.
        </p>
      </div>

      {loading && <p style={{ color: '#9ca3af' }}>A carregar…</p>}
      {erro && <p style={{ color: '#fca5a5' }}>{erro}</p>}

      {!loading && !erro && treinos.length === 0 && (
        <div className="portalCard">
          <p style={{ margin: 0, color: '#9ca3af' }}>
            Ainda não há treinos de catálogo. {member?.papel === 'personal' && 'Crie o primeiro com «Novo treino».'}
          </p>
        </div>
      )}

      {!loading &&
        treinos.map((t) => {
          const pn = t.personais?.nome?.trim()
          return (
            <div key={t.id} className="portalCard" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{t.nome}</div>
                  <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
                    {pn ? `Personal: ${pn}` : 'Academia'}
                    {t.data_prevista ? ` · ${t.data_prevista}` : ''}
                  </div>
                </div>
                {member?.papel === 'personal' && (
                  <Link
                    to={`/treinos-academia/novo?duplicarDe=${encodeURIComponent(t.id)}`}
                    className="portalBtn portalBtnGhost"
                    style={{ textDecoration: 'none', alignSelf: 'flex-start' }}
                  >
                    Duplicar
                  </Link>
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}
