import { Link, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { promptPreviews } from '../data/prompts'

export function LandingPage() {
  const navigate = useNavigate()
  const preview = promptPreviews[0]
  return (
    <Layout>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">PARA JUNTADAS QUE YA VIENEN CON TEMA</p>
          <h1>Elegí una postura.<br /><em>Defendela igual.</em></h1>
          <p className="hero-text">Un juego rápido para discutir pavadas importantes, votar y ver quién convence a la mesa.</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => navigate('/crear')}>Crear una sala <span aria-hidden="true">→</span></button>
            <Link className="button button-secondary" to="/unirse">Tengo un código</Link>
          </div>
          <p className="microcopy">Funciona desde un link. No instalás nada.</p>
        </div>
        <aside className="prompt-card hero-debate-card" aria-label="Ejemplo de consigna">
          <div className="prompt-topline"><span className="tag tag-blue">{preview.category}</span><span>01:00</span></div>
          <span className="card-edition" aria-hidden="true">MESA 01</span>
          <p>{preview.text}</p>
          <div className="sides"><span>{preview.sideA}</span><span>{preview.sideB}</span></div>
          <div className="scribble">bardo sano ↑</div>
        </aside>
      </section>
      <section className="how-it-works" aria-labelledby="how-title">
        <p className="eyebrow">SIN VUELTAS</p>
        <h2 id="how-title">Se arma en menos de un tema.</h2>
        <div className="steps">
          <article><b>01</b><h3>Creá la mesa</h3><p>Elegí el tono y compartí QR o link.</p><span aria-hidden="true">↗</span></article>
          <article><b>02</b><h3>Tomá postura</h3><p>Te toca defenderla aunque no sea la tuya.</p><span aria-hidden="true">↔</span></article>
          <article><b>03</b><h3>Voten y sigan</h3><p>La mesa decide. Cinco rondas y revancha.</p><span aria-hidden="true">★</span></article>
        </div>
      </section>
    </Layout>
  )
}
