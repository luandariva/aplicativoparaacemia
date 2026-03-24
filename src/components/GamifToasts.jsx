import { useEffect, useRef, useState } from 'react'

const SPRING = 'cubic-bezier(.34,1.56,.64,1)'
const ENTER_DUR = '0.48s'
const EXIT_DUR = '0.36s'

function toastMotion(phase) {
  const base = {
    position: 'fixed',
    left: '50%',
    zIndex: 9999,
    pointerEvents: 'none',
    maxWidth: 320,
    width: 'calc(100vw - 32px)',
    transition: `transform ${phase === 'out' ? EXIT_DUR : ENTER_DUR} ${SPRING}, opacity ${phase === 'out' ? EXIT_DUR : '0.32s'} ${SPRING}`,
  }
  if (phase === 'in') {
    return { ...base, transform: 'translateX(-50%) translateY(-26px) scale(0.85)', opacity: 0 }
  }
  if (phase === 'idle') {
    return { ...base, transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1 }
  }
  return { ...base, transform: 'translateX(-50%) translateY(-14px) scale(0.94)', opacity: 0 }
}

/**
 * Toast quando uma conquista (badge) é desbloqueada. Entrada com “spring” físico.
 */
export function BadgeToast({ badge, onClose, top = 'calc(var(--safe-top) + 16px)' }) {
  const [phase, setPhase] = useState('in')
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('idle'))
    })
    const hide = setTimeout(() => setPhase('out'), 4200)
    const unmount = setTimeout(() => closeRef.current?.(), 4200 + 380)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hide)
      clearTimeout(unmount)
    }
  }, [])

  return (
    <div style={{
      top,
      ...toastMotion(phase),
      background: 'linear-gradient(135deg, #1a1d22, #0f1215)',
      border: '1px solid rgba(201,242,77,0.5)',
      borderRadius: 16, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,242,77,0.15)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(201,242,77,0.15)',
        border: '1px solid rgba(201,242,77,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
        animation: 'checkPop .4s ease',
      }}>
        {badge?.icone || '🏆'}
      </div>
      <div>
        <p style={{ fontSize: 11, color: 'rgba(201,242,77,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Conquista desbloqueada!
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#f6f7f8', marginTop: 1 }}>
          {badge?.titulo || 'Nova conquista'}
        </p>
      </div>
    </div>
  )
}

/**
 * Toast após finalizar treino. Mesma curva de entrada em spring.
 */
export function PontosToast({ texto, onClose, top = 'calc(var(--safe-top) + 16px)' }) {
  const [phase, setPhase] = useState('in')
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('idle'))
    })
    const hide = setTimeout(() => setPhase('out'), 4800)
    const unmount = setTimeout(() => closeRef.current?.(), 4800 + 380)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hide)
      clearTimeout(unmount)
    }
  }, [])

  return (
    <div style={{
      top,
      ...toastMotion(phase),
      zIndex: 9998,
      background: 'linear-gradient(135deg, #1a1d22, #0f1215)',
      border: '1px solid rgba(201,242,77,0.4)',
      borderRadius: 16, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(201,242,77,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        ⚡
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#f6f7f8' }}>{texto}</p>
    </div>
  )
}
