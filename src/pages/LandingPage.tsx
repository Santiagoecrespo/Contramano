import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'

type LandingCursorState = {
  x: number
  y: number
  isOverInteractiveElement: boolean
}

const LANDING_PREVIEW_INDEX_KEY = 'contramano:landing-sexual-preview-index'

const sexualPreviews = [
  { question: '¿Qué es más satisfactorio tener o provocar un orgasmo?', sideA: 'tener', sideB: 'provocar' },
  { question: '¿Sexo entre amigos fortalece la amistad?', sideA: 'Sí, la re fortalece', sideB: 'No, caga todo' },
  { question: '¿Cojerse a la persona que tenés al lado o no cojer nunca más?', sideA: 'al de al lado', sideB: 'No garcho masss' },
] as const

function nextSexualPreviewIndex(): number {
  try {
    const previous = Number.parseInt(window.sessionStorage.getItem(LANDING_PREVIEW_INDEX_KEY) ?? '', 10)
    const index = Number.isInteger(previous) ? (previous + 1) % sexualPreviews.length : 0
    window.sessionStorage.setItem(LANDING_PREVIEW_INDEX_KEY, String(index))
    return index
  } catch {
    return 0
  }
}

function LandingCursor() {
  const [enabled, setEnabled] = useState(false)
  const [cursor, setCursor] = useState<LandingCursorState>({ x: 0, y: 0, isOverInteractiveElement: false })

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateEnabled = () => setEnabled(finePointer.matches && !reducedMotion.matches)
    const updateCursor = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return

      const target = event.target
      const isOverInteractiveElement = target instanceof Element && target.closest('[data-landing-interactive]') !== null
      setCursor({ x: event.clientX, y: event.clientY, isOverInteractiveElement })
    }

    updateEnabled()
    finePointer.addEventListener('change', updateEnabled)
    reducedMotion.addEventListener('change', updateEnabled)
    window.addEventListener('pointermove', updateCursor)

    return () => {
      finePointer.removeEventListener('change', updateEnabled)
      reducedMotion.removeEventListener('change', updateEnabled)
      window.removeEventListener('pointermove', updateCursor)
    }
  }, [])

  if (!enabled) return null

  return <span className={`landing-cursor ${cursor.isOverInteractiveElement ? 'is-active' : ''}`} style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }} aria-hidden="true"><span>↗</span></span>
}

export function LandingPage() {
  const [preview] = useState(() => sexualPreviews[nextSexualPreviewIndex()])

  return (
    <Layout>
      <div className="landing-page">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">PARA JUNTADAS QUE YA VIENEN CON TEMA</p>
            <h1>Elegí una postura.<br /><em>Defendela con todo.</em></h1>
            <p className="hero-text">Entren, voten y descubran quién quedó más en contramano.</p>
            <div className="mode-grid" aria-label="Elegí un modo de juego">
              <Link className="mode-card mode-online" to="/crear" data-landing-interactive><span className="mode-chip">3 A 8 PERSONAS</span><span className="mode-icon" aria-hidden="true">↗</span><span className="mode-card-title">Juntada online</span><small>Armen la mesa y jueguen cada quien desde su celular.</small></Link>
              <Link className="mode-card mode-duel" to="/cara-a-cara" data-landing-interactive><span className="mode-chip">2 PERSONAS · 1 DISPOSITIVO</span><span className="mode-icon" aria-hidden="true">↔</span><span className="mode-card-title">Cara a cara</span><small>Voten en secreto y vean si van por la misma vereda.</small></Link>
            </div>
            <div className="hero-actions">
              <Link className="button button-secondary" to="/unirse" data-landing-interactive>Tengo un código de sala</Link>
            </div>
            <p className="microcopy">Funciona desde un link. No instalás nada.</p>
          </div>
          <aside className="prompt-card hero-debate-card" aria-label="Ejemplo decorativo de consigna">
            <div className="prompt-topline"><span className="tag tag-blue">SIN FILTRO</span><span>01:00</span></div>
            <span className="card-edition" aria-hidden="true">MESA 01</span>
            <p>{preview.question}</p>
            <div className="sides"><span>{preview.sideA}</span><span>{preview.sideB}</span></div>
            <div className="scribble">sin filtro ↑</div>
          </aside>
        </section>
        <section className="how-it-works" aria-labelledby="how-title">
          <p className="eyebrow">SIN VUELTAS</p>
          <h2 id="how-title">Se arma en dos patadas.</h2>
          <div className="steps">
            <article><b>01</b><h3>Creá la mesa</h3><p>Elegí el tono y compartí QR o link.</p><span aria-hidden="true">↗</span></article>
            <article><b>02</b><h3>Defendé tu postura</h3><p>Te toca defenderla aunque no sea la tuya.</p><span aria-hidden="true">↔</span></article>
            <article><b>03</b><h3>Voten y sigan</h3><p>La mesa decide. Cinco rondas y revancha.</p><span aria-hidden="true">★</span></article>
          </div>
        </section>
        <LandingCursor />
      </div>
    </Layout>
  )
}
