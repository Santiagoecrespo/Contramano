import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { QrModal } from '../components/QrModal'
import { addDemoPlayers, getMockRoom } from '../lib/mockRoom'
import type { MockRoom } from '../types/game'

export function RoomPage() {
  const { code = '' } = useParams()
  const [room, setRoom] = useState<MockRoom | null>(() => getMockRoom(code))
  const [showQr, setShowQr] = useState(false)
  const roomUrl = `${window.location.origin}/sala/${code}`

  function shareWhatsApp() {
    const text = `Caé a mi mesa de Contramano. Entrá acá: ${roomUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  if (!room) {
    return <Layout><section className="empty-state"><p className="eyebrow">SALA NO ENCONTRADA</p><h1>Ese código no nos llevó a ninguna mesa.</h1><Link className="button button-primary" to="/unirse">Probar otro código</Link></section></Layout>
  }

  const canStart = room.players.length >= 3
  return (
    <Layout>
      <section className="room-page">
        <div className="room-heading"><div><p className="eyebrow">SALA · {room.intensity === 'tranqui' ? 'TRANQUI' : 'MODO BARDO'}</p><h1>La mesa está servida.</h1></div><span className="room-code">{room.code}</span></div>
        <div className="room-grid">
          <section className="lobby-card">
            <div className="lobby-card-top"><div><p className="eyebrow">JUGADORES</p><h2>{room.players.length} {room.players.length === 1 ? 'persona' : 'personas'} en la mesa</h2></div><span className="live-dot">En lobby</span></div>
            <ul className="player-list">{room.players.map((player) => <li key={player.id}><span className="avatar">{player.nickname.slice(0, 1).toUpperCase()}</span><span>{player.nickname}{player.isHost && <small>Anfitrión</small>}</span><span className="online">conectado</span></li>)}</ul>
            {room.players.length === 1 && <div className="waiting-message"><b>Creaste la mesa.</b><span>Compartí el QR o el link para sumar gente.</span></div>}
            {room.players.length === 2 && <div className="waiting-message"><b>Falta una persona para empezar.</b><span>Mandá el link al grupo y listo.</span></div>}
            {canStart && <div className="ready-message"><b>Ya pueden arrancar.</b><span>En el Hito 2 se habilita la primera ronda.</span></div>}
            <button className="button button-dark full-width" disabled={!canStart}>Empezar partida <span aria-hidden="true">→</span></button>
          </section>
          <aside className="share-card"><p className="eyebrow">INVITÁ A LA MESA</p><h2>Un link y adentro.</h2><p>Abren desde el celu, ponen apodo y juegan. No tienen que instalar nada.</p><button className="button button-primary full-width" onClick={() => setShowQr(true)}>Mostrar QR</button><button className="button button-secondary full-width" onClick={shareWhatsApp}>Compartir por WhatsApp</button><button className="text-button" onClick={() => setRoom(addDemoPlayers(room.code))}>Simular 3 jugadores para esta demo</button></aside>
        </div>
      </section>
      {showQr && <QrModal url={roomUrl} onClose={() => setShowQr(false)} />}
    </Layout>
  )
}

