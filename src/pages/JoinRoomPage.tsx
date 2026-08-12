import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { joinMockRoom } from '../lib/mockRoom'

export function JoinRoomPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')

  function joinRoom(event: FormEvent) {
    event.preventDefault()
    const room = joinMockRoom(code.trim().toUpperCase(), nickname.trim())
    const joined = room?.players.some((player) => player.nickname.toLowerCase() === nickname.trim().toLowerCase())
    if (!room || !joined || nickname.trim().length < 2) {
      setError(room && !joined ? 'La sala está completa: admite hasta 8 jugadores.' : 'Revisá el código y usá un apodo de al menos 2 caracteres.')
      return
    }
    navigate(`/sala/${room.code}`)
  }

  return (
    <Layout>
      <section className="form-page">
        <p className="eyebrow">ENTRAR A UNA MESA</p>
        <h1>Pasá, ya arrancó el bardo.</h1>
        <form className="form-card" onSubmit={joinRoom}>
          <label htmlFor="room-code">Código de sala</label>
          <input id="room-code" className="code-input" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="EJ: JUNT4DA" />
          <label htmlFor="join-nickname">Tu apodo</label>
          <input id="join-nickname" maxLength={16} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Cómo te dicen" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary form-submit" type="submit">Entrar a la sala <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </Layout>
  )
}
