import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { promptPreviews } from '../data/prompts'

export function LandingPage() {
  const preview = promptPreviews[0]
  return (
    <Layout>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">PARA JUNTADAS QUE YA VIENEN CON TEMA</p>
          <h1>Elegí una postura.<br /><em>Defendela igual.</em></h1>
          <p className="hero-text">Elegí cómo jugar y dejá que una consigna haga el resto.</p>
          <div className="mode-grid" aria-label="Elegí un modo de juego">
            <Link className="mode-card mode-online" to="/crear"><span className="mode-icon" aria-hidden="true">↗</span><span>Juntada online</span><small>3 a 8 personas · cada quien desde su celular</small></Link>
            <Link className="mode-card mode-duel" to="/cara-a-cara"><span className="mode-icon" aria-hidden="true">↔</span><span>Cara a cara</span><small>2 personas · un dispositivo</small></Link>
          </div>
          <div className="hero-actions">
            <Link className="button button-secondary" to="/unirse">Tengo un código de sala</Link>
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
