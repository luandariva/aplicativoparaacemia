import { useNavigate } from 'react-router-dom'
import GamifWidget from '../components/GamifWidget'

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      padding: '18px', paddingTop: 'calc(var(--safe-top) + 14px)',
      paddingBottom: 'calc(84px + var(--safe-bottom))',
      gap: 16, overflowY: 'auto',
    }}>
      <div style={{ animation: 'floatIn .35s ease both' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Ola, Dariva</p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1,
          fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.02em',
        }}>
          Bem-vindo de volta!
        </h1>
      </div>

      <div style={{ animation: 'floatIn .38s ease .04s both' }}>
        <GamifWidget onVerConquistas={() => navigate('/perfil')} />
      </div>

      <div style={{
        borderRadius: 20, border: '1px solid var(--border)',
        background: 'linear-gradient(145deg, #13161b, #0a0c0f)', padding: 16,
        boxShadow: 'var(--shadow-soft)', animation: 'floatIn .4s ease .08s both',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 82, height: 82, borderRadius: '50%',
            border: '6px solid rgba(201,242,77,0.2)',
            boxShadow: 'inset 0 0 0 3px rgba(201,242,77,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--green)', fontWeight: 800, fontSize: 18,
          }}>
            84%
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Treinos na semana', value: '5' },
              { label: 'Aderencia da dieta', value: '79%' },
              { label: 'Meta de proteina', value: '98/160g' },
              { label: 'Saldo do dia', value: '760 kcal' },
            ].map((m) => (
              <div key={m.label}>
                <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.label}</p>
                <p style={{
                  fontSize: 20, fontWeight: 800, color: 'var(--green)',
                  fontFamily: 'var(--font-display)', lineHeight: 1.05,
                }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </div>
        <button type="button" style={{
          width: '100%', marginTop: 12, borderRadius: 12, background: 'var(--green)',
          color: '#111', padding: '10px 12px', fontSize: 12, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Ver resumo completo
        </button>
      </div>

      <div style={{ animation: 'floatIn .45s ease .12s both' }}>
        <div style={{
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          padding: 14,
        }}>
          <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', marginBottom: 10 }}>Apanhado geral</h2>
          {[
            { titulo: 'Dieta', detalhe: '3 refeicoes registradas · jantar pendente' },
            { titulo: 'Treino', detalhe: 'Treino de costas disponivel para hoje' },
            { titulo: 'Evolucao', detalhe: 'Aderencia semanal acima da media' },
          ].map((item, i) => (
            <div key={item.titulo} style={{
              padding: '10px 0',
              borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.titulo}</p>
              <p style={{ fontSize: 14 }}>{item.detalhe}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ animation: 'floatIn .5s ease .16s both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700 }}>Seus desafios</h2>
          <button type="button" style={{
            color: '#111',
            background: 'var(--green)',
            border: '1px solid rgba(0,0,0,0.25)',
            borderRadius: 10,
            padding: '6px 10px',
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}>
            Ver todos
          </button>
        </div>
        <div style={{
          borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden',
          minHeight: 190,
          backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.65), rgba(0,0,0,0.1)), url(https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=900&q=60)',
          backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex',
          flexDirection: 'column', justifyContent: 'flex-end', padding: 14,
        }}>
          <p style={{ fontSize: 21, fontWeight: 800, fontFamily: 'var(--font-display)' }}>Corrida na rua</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--green)', fontSize: 13, fontWeight: 700 }}>30 min</p>
            <button type="button" style={{
              width: 34, height: 34, borderRadius: '50%', background: 'var(--green)',
              color: '#101010', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 800,
            }}>
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
