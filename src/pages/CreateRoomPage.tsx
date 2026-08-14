import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { createRoom, roomAccessError } from '../lib/gameService'
import type { Intensity } from '../types/game'

export function CreateRoomPage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [intensity, setIntensity] = useState<Intensity>('tranqui')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreateRoom(event: FormEvent) {
    event.preventDefault()
    const cleanNickname = nickname.trim()
    if (cleanNickname.length < 2 || cleanNickname.length > 16) {
      setError('Usá un apodo de 2 a 16 caracteres.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const room = await createRoom(cleanNickname, intensity)
      navigate(`/sala/${room.code}`)
    } catch (caught) {
      setError(roomAccessError(caught).message || 'No pudimos crear la sala. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <section className="form-page" aria-labelledby="create-room-title">
        <p className="eyebrow">NUEVA MESA</p>
        <h1 id="create-room-title">Que empiece el desacuerdo.</h1>
        <form className="form-card" onSubmit={handleCreateRoom} aria-busy={busy}>
          <label htmlFor="nickname">¿Cómo te decimos?</label>
          <input id="nickname" autoFocus autoComplete="nickname" maxLength={16} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Tu apodo" />
          <fieldset>
            <legend>Intensidad de la noche</legend>
            <div className="intensity-grid">
              <button type="button" onClick={() => setIntensity('tranqui')} aria-pressed={intensity === 'tranqui'} disabled={busy} className={intensity === 'tranqui' ? 'choice selected' : 'choice'}><span>Tranqui <i aria-hidden="true">01</i></span><small>Para discutir sin subir el volumen.</small></button>
              <button type="button" onClick={() => setIntensity('bardo')} aria-pressed={intensity === 'bardo'} disabled={busy} className={intensity === 'bardo' ? 'choice selected bardo' : 'choice bardo'}><span>Modo Bardo <i aria-hidden="true">02</i></span><small>Más filoso, siempre entre amigos.</small></button>
            </div>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          {busy && <p className="action-status" role="status">Estamos preparando la mesa…</p>}
          <button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? 'Creando sala…' : <>Crear sala <span aria-hidden="true">→</span></>}</button>
          <p className="microcopy">Después compartís QR o WhatsApp. No instalás nada.</p>
        </form>
      </section>
    </Layout>
  )
}
