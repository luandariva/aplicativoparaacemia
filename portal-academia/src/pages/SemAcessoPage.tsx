import { Link } from 'react-router-dom'

export function SemAcessoPage() {
  return (
    <div className="portalShell">
      <div className="portalPage">
        <div className="portalCard">
          <h1 className="portalCardTitle">Sem permissão</h1>
          <p style={{ marginTop: 0, color: '#9ca3af' }}>
            A sua conta não está associada como <code>gestor</code> ou{' '}
            <code>personal</code> em <code>membros_portal</code>, ou está inativa.
          </p>
          <Link to="/login" className="portalLink">
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}

