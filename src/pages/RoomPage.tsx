import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { QrModal } from '../components/QrModal'
import {
  addDemoPlayers, advanceToVoting, castMockVote, closeMockVoting, confirmPromptChange,
  continueMockGame, getLocalPlayerId, getMockRoom, joinMockRoom,
  rematchMockGame, requestPromptChange, startMockGame,
} from '../lib/mockRoom'
import type { MockRoom, Side } from '../types/game'

function timeLeft(endsAt: string | null, now: number): number {
  return endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000)) : 0
}

function displayTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export function RoomPage() {
  const { code = '' } = useParams()
  const [room, setRoom] = useState<MockRoom | null>(() => getMockRoom(code))
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(() => getLocalPlayerId(code))
  const [showQr, setShowQr] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [joinNickname, setJoinNickname] = useState('')
  const roomUrl = `${window.location.origin}/sala/${code}`
  const localPlayer = room?.players.find((player) => player.id === localPlayerId) ?? null
  const currentRound = room?.rounds.at(-1)
  const isHost = localPlayer?.id === room?.hostId

  function update(next: MockRoom | null) {
    if (next) setRoom(next)
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!room || !currentRound || !isHost) return
    if (room.phase === 'debating' && timeLeft(currentRound.debateEndsAt, now) === 0) update(advanceToVoting(room.code, room.hostId))
    if (room.phase === 'voting' && timeLeft(currentRound.voteEndsAt, now) === 0) update(closeMockVoting(room.code, room.hostId))
  }, [currentRound, isHost, now, room])

  const rankedPlayers = useMemo(() => room ? [...room.players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname)) : [], [room])

  function shareWhatsApp() {
    const text = `Caé a mi mesa de Contramano. Entrá acá: ${roomUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  function joinFromLink(event: FormEvent) {
    event.preventDefault()
    const next = joinMockRoom(code, joinNickname.trim())
    if (!next) return
    setLocalPlayerId(getLocalPlayerId(code))
    update(next)
  }

  function completeDemoVotes() {
    if (!room || !currentRound) return
    let next: MockRoom | null = room
    const votes = currentRound.votes.map((vote) => vote.playerId)
    Object.entries(currentRound.assignments).filter(([playerId]) => !votes.includes(playerId)).forEach(([playerId], index) => {
      next = castMockVote(room.code, playerId, index % 2 === 0 ? 'A' : 'B')
    })
    update(next)
  }

  if (!room) {
    return <Layout><section className="empty-state"><p className="eyebrow">SALA NO ENCONTRADA</p><h1>Ese código no nos llevó a ninguna mesa.</h1><Link className="button button-primary" to="/unirse">Probar otro código</Link></section></Layout>
  }

  if (!localPlayer) {
    return (
      <Layout>
        <section className="form-page join-link-page">
          <p className="eyebrow">ENTRASTE A UNA MESA</p><h1>Falta saber cómo te llamamos.</h1>
          <form className="form-card" onSubmit={joinFromLink}>
            <label htmlFor="shared-nickname">Tu apodo</label>
            <input id="shared-nickname" autoFocus maxLength={16} value={joinNickname} onChange={(event) => setJoinNickname(event.target.value)} placeholder="Cómo te dicen" />
            <button className="button button-primary form-submit" type="submit" disabled={joinNickname.trim().length < 2}>Entrar a la mesa <span aria-hidden="true">→</span></button>
            <p className="microcopy">No instalás nada. Jugás desde este link.</p>
          </form>
        </section>
      </Layout>
    )
  }

  const canStart = room.players.length >= 3
  const mySide = currentRound?.assignments[localPlayer.id]
  const myVote = currentRound?.votes.find((vote) => vote.playerId === localPlayer.id)
  const debateRemaining = timeLeft(currentRound?.debateEndsAt ?? null, now)
  const votingRemaining = timeLeft(currentRound?.voteEndsAt ?? null, now)

  return (
    <Layout>
      <section className="room-page">
        <div className="room-heading"><div><p className="eyebrow">SALA · {room.intensity === 'tranqui' ? 'TRANQUI' : 'MODO BARDO'}</p><h1>{room.phase === 'lobby' ? 'La mesa está servida.' : room.phase === 'finished' ? 'La mesa eligió.' : `Ronda ${currentRound?.number ?? 1} de 5`}</h1></div><span className="room-code">{room.code}</span></div>

        {room.phase === 'lobby' && <Lobby room={room} isHost={isHost} canStart={canStart} onStart={() => update(startMockGame(room.code, room.hostId))} onDemo={() => update(addDemoPlayers(room.code))} onQr={() => setShowQr(true)} onShare={shareWhatsApp} />}

        {room.phase === 'debating' && currentRound && <section className="game-layout">
          <RoundCard round={currentRound} side={mySide} timer={displayTime(debateRemaining)} label="Tiempo para el bardo" />
          <aside className="game-sidebar">
            <PlayerScoreboard players={rankedPlayers} localPlayerId={localPlayer.id} />
            <section className="control-card"><p className="eyebrow">CAMBIAR CONSIGNA</p>{currentRound.changeRequests.length > 0 ? <p><b>{currentRound.changeRequests.length} persona{currentRound.changeRequests.length > 1 ? 's pidieron' : ' pidió'} cambiarla.</b></p> : <p>Si la consigna no va, pedí otra sin explicaciones.</p>}
              {!currentRound.changeRequests.includes(localPlayer.id) && <button className="button button-secondary full-width" onClick={() => update(requestPromptChange(room.code, localPlayer.id))}>Solicitar cambio</button>}
              {isHost && currentRound.changeRequests.length > 0 && <button className="button button-primary full-width" onClick={() => update(confirmPromptChange(room.code, room.hostId))}>Cambiar consigna</button>}
            </section>
            {isHost && <section className="control-card host-card"><p className="eyebrow">CONTROL DEL HOST</p><button className="button button-dark full-width" onClick={() => update(advanceToVoting(room.code, room.hostId))}>Abrir votación ahora</button><small>El temporizador la abre automáticamente en esta demo.</small></section>}
          </aside>
        </section>}

        {room.phase === 'voting' && currentRound && <section className="game-layout">
          <RoundCard round={currentRound} side={mySide} timer={displayTime(votingRemaining)} label="La mesa está votando" compact />
          <aside className="game-sidebar">
            <section className="vote-card"><p className="eyebrow">VOTO PRIVADO</p><h2>¿Qué postura fue mejor defendida?</h2>{myVote ? <p className="vote-confirmation">Tu voto quedó guardado. Esperando al resto…</p> : <div className="vote-buttons"><button onClick={() => update(castMockVote(room.code, localPlayer.id, 'A'))}>{currentRound.prompt.sideA}</button><button onClick={() => update(castMockVote(room.code, localPlayer.id, 'B'))}>{currentRound.prompt.sideB}</button></div>}<p className="vote-progress">{currentRound.votes.length} de {Object.keys(currentRound.assignments).length} votos</p></section>
            {isHost && <section className="control-card host-card"><p className="eyebrow">DEMO LOCAL</p><button className="button button-secondary full-width" onClick={completeDemoVotes}>Completar votos de demo</button><button className="button button-dark full-width" onClick={() => update(closeMockVoting(room.code, room.hostId))}>Cerrar y mostrar resultado</button></section>}
          </aside>
        </section>}

        {room.phase === 'results' && currentRound && <ResultScreen room={room} round={currentRound} isHost={isHost} onContinue={() => update(continueMockGame(room.code, room.hostId))} />}
        {room.phase === 'finished' && <FinishedScreen players={rankedPlayers} isHost={isHost} onRematch={() => update(rematchMockGame(room.code, room.hostId))} />}
      </section>
      {showQr && <QrModal url={roomUrl} onClose={() => setShowQr(false)} />}
    </Layout>
  )
}

function Lobby({ room, isHost, canStart, onStart, onDemo, onQr, onShare }: { room: MockRoom; isHost: boolean; canStart: boolean; onStart: () => void; onDemo: () => void; onQr: () => void; onShare: () => void }) {
  return <div className="room-grid"><section className="lobby-card"><div className="lobby-card-top"><div><p className="eyebrow">JUGADORES</p><h2>{room.players.length} {room.players.length === 1 ? 'persona' : 'personas'} en la mesa</h2></div><span className="live-dot">En lobby</span></div><PlayerList players={room.players} />
    {room.players.length === 1 && <div className="waiting-message"><b>Creaste la mesa.</b><span>Compartí el QR o el link para sumar gente.</span></div>}
    {room.players.length === 2 && <div className="waiting-message"><b>Falta una persona para empezar.</b><span>Mandá el link al grupo y listo.</span></div>}
    {canStart && <div className="ready-message"><b>Ya pueden arrancar.</b><span>Hay equipo suficiente para una buena discusión.</span></div>}
    {isHost && <button className="button button-dark full-width" disabled={!canStart} onClick={onStart}>Empezar partida <span aria-hidden="true">→</span></button>}
  </section><aside className="share-card"><p className="eyebrow">INVITÁ A LA MESA</p><h2>Un link y adentro.</h2><p>Abren desde el celu, ponen apodo y juegan. No tienen que instalar nada.</p><button className="button button-primary full-width" onClick={onQr}>Mostrar QR</button><button className="button button-secondary full-width" onClick={onShare}>Compartir por WhatsApp</button>{isHost && <button className="text-button" onClick={onDemo}>Sumar jugadores de demo</button>}</aside></div>
}

function RoundCard({ round, side, timer, label, compact = false }: { round: NonNullable<MockRoom['rounds'][number]>; side: Side | undefined; timer: string; label: string; compact?: boolean }) {
  return <section className={compact ? 'round-card compact' : 'round-card'}><div className="round-top"><span className="tag tag-blue">{round.prompt.category}</span><span className="timer"><i />{timer}</span></div><p className="eyebrow">{label}</p><h2>{round.prompt.text}</h2><div className="my-side"><span>TE TOCÓ DEFENDER</span><strong className={side === 'A' ? 'side-a' : 'side-b'}>{side === 'A' ? round.prompt.sideA : round.prompt.sideB}</strong><small>No importa si estás de acuerdo: esa es la gracia.</small></div></section>
}

function PlayerList({ players }: { players: MockRoom['players'] }) {
  return <ul className="player-list">{players.map((player) => <li key={player.id}><span className="avatar">{player.nickname.slice(0, 1).toUpperCase()}</span><span>{player.nickname}{player.isHost && <small>Anfitrión</small>}</span><span className="online">conectado</span></li>)}</ul>
}

function PlayerScoreboard({ players, localPlayerId }: { players: MockRoom['players']; localPlayerId: string }) {
  return <section className="scoreboard"><p className="eyebrow">PUNTAJE</p>{players.map((player, index) => <div className={player.id === localPlayerId ? 'score-row is-me' : 'score-row'} key={player.id}><span>{index + 1}. {player.nickname}</span><b>{player.score}</b></div>)}</section>
}

function ResultScreen({ room, round, isHost, onContinue }: { room: MockRoom; round: NonNullable<MockRoom['rounds'][number]>; isHost: boolean; onContinue: () => void }) {
  const sideLabel = round.result === 'A' ? round.prompt.sideA : round.result === 'B' ? round.prompt.sideB : null
  const votesA = round.votes.filter((vote) => vote.side === 'A').length
  const votesB = round.votes.filter((vote) => vote.side === 'B').length
  return <section className="result-screen"><p className="eyebrow">RESULTADO · RONDA {round.number}</p><h2>{sideLabel ? 'La postura elegida por la mesa' : 'La mesa quedó dividida'}</h2><div className="result-badge">{sideLabel ?? 'Empate'}</div><p>{votesA} votos para <b>{round.prompt.sideA}</b> · {votesB} para <b>{round.prompt.sideB}</b></p><PlayerScoreboard players={[...room.players].sort((a, b) => b.score - a.score)} localPlayerId="" />{isHost && <button className="button button-primary result-action" onClick={onContinue}>{round.number === 5 ? 'Ver ranking final' : 'Siguiente ronda'} <span aria-hidden="true">→</span></button>}</section>
}

function FinishedScreen({ players, isHost, onRematch }: { players: MockRoom['players']; isHost: boolean; onRematch: () => void }) {
  return <section className="result-screen finished"><p className="eyebrow">CINCO RONDAS DESPUÉS</p><h2>Se discutió. Se votó. Se sobrevivió.</h2><div className="final-ranking">{players.map((player, index) => <div key={player.id}><span>{index + 1}</span><b>{player.nickname}</b><strong>{player.score} pts</strong></div>)}</div>{isHost && <button className="button button-primary result-action" onClick={onRematch}>Revancha <span aria-hidden="true">↻</span></button>}<p className="microcopy">La revancha reinicia puntajes y vuelve al lobby.</p></section>
}
