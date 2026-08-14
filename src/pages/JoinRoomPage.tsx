import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { joinRoom, roomAccessError } from '../lib/gameService'

const roomCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/

export function JoinRoomPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleJoinRoom(event: FormEvent) {
    event.preventDefault()
    const cleanCode = code.trim().toUpperCase()
    const cleanNickname = nickname.trim()
    if (!roomCodePattern.test(cleanCode)) {
      setError('El código tiene 8 caracteres: letras y números, sin O, I ni 1.')
      return
    }
    if (cleanNickname.length < 2 || cleanNickname.length > 16) {
      setError('Usá un apodo de 2 a 16 caracteres.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const room = await joinRoom(cleanCode, cleanNickname)
      navigate(`/sala/${room.code}`)
    } catch (caught) {
      setError(roomAccessError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <section className="form-page" aria-labelledby="join-room-title">
        <p className="eyebrow">ENTRAR A UNA MESA</p>
        <h1 id="join-room-title">Pasá, ya arrancó el bardo.</h1>
        <form className="form-card" onSubmit={handleJoinRoom} aria-busy={busy}>
          <label htmlFor="room-code">Código de sala</label>
          <input id="room-code" className="code-input" maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck="false" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="EJ: AB2CD3EF" aria-describedby="code-help" />
          <small id="code-help" className="field-help">Son 8 caracteres. No usamos O, I ni 1 para evitar confusiones.</small>
          <label htmlFor="join-nickname">Tu apodo</label>
          <input id="join-nickname" autoComplete="nickname" maxLength={16} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Cómo te dicen" />
          {error && <p className="form-error" role="alert">{error}</p>}
          {busy && <p className="action-status" role="status">Buscando la mesa…</p>}
          <button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? 'Entrando…' : <>Entrar a la sala <span aria-hidden="true">→</span></>}</button>
        </form>
      </section>
    </Layout>
  )
}
