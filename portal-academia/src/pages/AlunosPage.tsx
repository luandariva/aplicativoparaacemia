import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortal } from '../portal/PortalContext'

type AlunoRow = {
  id: string
  usuario_id: string
  status: 'convite_pendente' | 'ativo' | 'inativo'
  personal_principal_id: string | null
  usuarios?: { id: string; email: string; display_name?: string | null } | null
}

type PersonalRow = { id: string; nome: string }

export function AlunosPage() {
  const { member, portalCall } = usePortal()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [alunos, setAlunos] = useState<AlunoRow[]>([])

  const [personais, setPersonais] = useState<PersonalRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [invitePersonalId, setInvitePersonalId] = useState('')
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [inviteSenha, setInviteSenha] = useState<string | null>(null)

  const podeGerir = member?.papel === 'gestor'

  const filtrar = useMemo(() => q.trim().toLowerCase(), [q])

  async function carregar() {
    setLoading(true)
    setErro(null)

    try {
      const res = await portalCall<{ alunos: AlunoRow[] }>('portal_alunos', { q: '' })
      setAlunos(res.alunos ?? [])
    } catch (err: any) {
      setErro(err?.message || 'Erro ao carregar alunos')
    } finally {
      setLoading(false)
    }
  }

  async function carregarPersonais() {
    if (!podeGerir) return
    try {
      const res = await portalCall<{ personais: PersonalRow[] }>('portal_personais', {})
      setPersonais(res.personais ?? [])
    } catch {
      setPersonais([])
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!mounted) return
      await carregarPersonais()
      await carregar()
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const alunosFiltrados = useMemo(() => {
    if (!filtrar) return alunos
    return alunos.filter((a) => {
      const email = a.usuarios?.email?.toLowerCase() ?? ''
      const nome = a.usuarios?.display_name?.toLowerCase() ?? ''
      return email.includes(filtrar) || nome.includes(filtrar)
    })
  }, [alunos, filtrar])

  async function enviarConvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteMsg(null)
    setInviteSenha(null)

    if (!podeGerir) return
    if (!inviteEmail.includes('@')) {
      setInviteMsg('Informe um e-mail válido.')
      return
    }

    try {
      const body = {
        email: inviteEmail,
        display_name: inviteName || null,
        personal_principal_id: invitePersonalId || null,
      }
      const res = await portalCall<any>('portal_create_aluno_invite', body)
      setInviteMsg(res.mensagem || 'Aluno criado.')
      setInviteSenha(res.senha_temporaria || null)
      setInviteEmail('')
      setInviteName('')
      setInvitePersonalId('')
      await carregar()
    } catch (err: any) {
      setInviteMsg(err?.message || 'Falha ao criar aluno')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <header className="portalPageHeader">
          <h1 className="portalPageTitle">Alunos</h1>
          <p className="portalPageDesc">Cadastro e vínculo com o app do aluno.</p>
        </header>
        {podeGerir && (
          <div style={{ color: 'var(--portal-lime)', alignSelf: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
            Modo: Gestor
          </div>
        )}
      </div>

      {podeGerir && (
        <div className="portalCard" style={{ marginTop: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Cadastrar aluno</h2>
          <p style={{ marginTop: 8, color: '#9ca3af' }}>
            Cria a conta do aluno no Supabase e vincula ao `alunos_academia`. Não haverá pagamentos.
          </p>

          <form onSubmit={(e) => void enviarConvite(e)} style={{ marginTop: 14 }}>
            <div className="portalFormRow twoCols">
              <div>
                <label style={{ display: 'block', textAlign: 'left' }}>E-mail</label>
                <input
                  className="portalInput"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label style={{ display: 'block', textAlign: 'left' }}>Nome (opcional)</label>
                <input
                  className="portalInput"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
            </div>

            <div className="portalFormRow" style={{ marginTop: 10 }}>
              <div>
                <label style={{ display: 'block', textAlign: 'left' }}>
                  Personal principal (opcional)
                </label>
                <select
                  className="portalSelect"
                  value={invitePersonalId}
                  onChange={(e) => setInvitePersonalId(e.target.value)}
                  disabled={personais.length === 0}
                >
                  <option value="">—</option>
                  {personais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="portalBtn portalBtnPrimary" style={{ marginTop: 14, width: '100%' }}>
              Criar e vincular
            </button>

            {inviteMsg && <p style={{ marginTop: 10, color: '#9ca3af' }}>{inviteMsg}</p>}
            {inviteSenha && (
              <p style={{ marginTop: 10, fontFamily: 'monospace', color: '#fde68a' }}>
                Senha temporária: {inviteSenha}
              </p>
            )}
          </form>
        </div>
      )}

      <div className="portalCard" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label style={{ display: 'block', textAlign: 'left', marginBottom: 6 }}>Buscar</label>
            <input
              className="portalInput"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="E-mail ou nome"
            />
          </div>
        </div>

        {loading && <p style={{ marginTop: 12, color: '#9ca3af' }}>Carregando…</p>}
        {erro && <p style={{ marginTop: 12, color: '#fca5a5' }}>{erro}</p>}

        {!loading && !erro && (
          <table className="portalTable" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>E-mail</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alunosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: '#9ca3af', textAlign: 'center' }}>
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              ) : (
                alunosFiltrados.map((a) => (
                  <tr key={a.id}>
                    <td>{a.usuarios?.display_name ?? '—'}</td>
                    <td style={{ color: '#9ca3af' }}>{a.usuarios?.email ?? '—'}</td>
                    <td style={{ color: '#9ca3af' }}>{a.status}</td>
                    <td>
                      <Link to={`/alunos/${a.usuario_id}`}>Detalhe</Link>
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

