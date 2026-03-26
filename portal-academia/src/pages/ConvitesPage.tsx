import { useEffect, useState } from 'react'
import { usePortal } from '../portal/PortalContext'

type Convite = {
  id: string
  email: string
  token: string
  expira_em: string
  consumido_em?: string | null
  created_at: string
}

export function ConvitesPage() {
  const { member, portalCall } = usePortal()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [convites, setConvites] = useState<Convite[]>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setErro(null)
        setLoading(true)
        if (member?.papel !== 'gestor') return
        const res = await portalCall<{ convites: Convite[] }>('portal_convites', {})
        if (mounted) setConvites(res.convites ?? [])
      } catch (err: any) {
        if (mounted) setErro(err?.message || 'Erro ao carregar convites')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [member?.papel, portalCall, member])

  if (member?.papel !== 'gestor') {
    return <div className="portalCard">Apenas gestor.</div>
  }

  return (
    <div>
      <header className="portalPageHeader">
        <h1 className="portalPageTitle">Convites</h1>
        <p className="portalPageDesc">Histórico dos convites e cadastros vinculados ao app.</p>
      </header>

      <div className="portalCard" style={{ marginTop: 16 }}>
        {loading && <p style={{ margin: 0, color: '#9ca3af' }}>Carregando…</p>}
        {erro && <p style={{ margin: 0, color: '#fca5a5' }}>{erro}</p>}

        {!loading && !erro && (
          <table className="portalTable">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Token</th>
                <th>Expira</th>
              </tr>
            </thead>
            <tbody>
              {convites.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: '#9ca3af', textAlign: 'center' }}>
                    Nenhum convite.
                  </td>
                </tr>
              ) : (
                convites.map((c) => (
                  <tr key={c.id}>
                    <td>{c.email}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>
                      {c.token.slice(0, 16)}…
                    </td>
                    <td style={{ color: '#9ca3af' }}>
                      {new Date(c.expira_em).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

