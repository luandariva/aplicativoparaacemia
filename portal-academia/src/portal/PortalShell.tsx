import { Navigate, Outlet } from 'react-router-dom'
import { usePortal } from './PortalContext'
import { PortalNav } from './PortalNav'

export function PortalShell() {
  const { status, member } = usePortal()

  if (status === 'loading') {
    return (
      <div className="portalShell">
        <div className="portalBody">
          <div className="portalMain">
            <p className="portalPageDesc" style={{ margin: 0 }}>
              Carregando…
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace />
  }

  if (status === 'noAccess' || !member) {
    return <Navigate to="/sem-acesso" replace />
  }

  return (
    <div className="portalShell">
      <PortalNav member={member} />
      <div className="portalBody">
        <main className="portalMain">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

