import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { createMockRoom } from '../lib/mockRoom'
import type { Intensity } from '../types/game'

export function CreateRoomPage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [intensity, setIntensity] = useState<Intensity>('tranqui')
  const [error, setError] = useState('')

  function createRoom(event: FormEvent) {
    event.preventDefault()
    const cleanNickname = nickname.trim()
    if (cleanNickname.length < 2 || cleanNickname.length > 16) {
      setError('Usá un apodo de 2 a 16 caracteres.')
      return
    }
    const room = createMockRoom(cleanNickname, intensity)
    navigate(`/sala/${room.code}`)
  }

  return (
    <Layout>
      <section className="form-page">
        <p className="eyebrow">NUEVA MESA</p>
        <h1>Que empiece el desacuerdo.</h1>
        <form className="form-card" onSubmit={createRoom}>
          <label htmlFor="nickname">¿Cómo te decimos?</label>
          <input id="nickname" autoFocus maxLength={16} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Tu apodo" />
          <fieldset>
            <legend>Intensidad de la noche</legend>
            <div className="intensity-grid">
              <button type="button" onClick={() => setIntensity('tranqui')} className={intensity === 'tranqui' ? 'choice selected' : 'choice'}><span>Tranqui</span><small>Para discutir sin subir el volumen.</small></button>
              <button type="button" onClick={() => setIntensity('bardo')} className={intensity === 'bardo' ? 'choice selected bardo' : 'choice bardo'}><span>Modo Bardo</span><small>Más filoso, siempre entre amigos.</small></button>
            </div>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary form-submit" type="submit">Crear sala <span aria-hidden="true">→</span></button>
          <p className="microcopy">Pack inicial: Previa. Después compartís QR o WhatsApp.</p>
        </form>
      </section>
    </Layout>
  )
}

