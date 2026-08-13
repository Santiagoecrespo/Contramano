import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { QrModal } from '../components/QrModal'
import {
  addDemo, changeIntensity, closeVoting, confirmChange, getRoom, isRealtimeMode, joinRoom,
  forgetLocalPlayer, localPlayerId, nextRound, openVoting, prepareRoomVisit, rematch, requestChange,
  roomAccessError, startGame, subscribeRoom, vote,
} from '../lib/gameService'
import { MAX_PLAYERS } from '../lib/mockRoom'
import type { MockRoom, Side } from '../types/game'

function timeLeft(endsAt: string | null, now: number): number { return endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000)) : 0 }
function displayTime(seconds: number): string { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` }
type AccessState = 'checking' | 'guest' | 'member' | 'blocked'

export function RoomPage() {
  const { code = '' } = useParams()
  const [room, setRoom] = useState<MockRoom | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(() => localPlayerId(code))
  const [accessState, setAccessState] = useState<AccessState>('checking')
  const [showQr, setShowQr] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [serverOffset, setServerOffset] = useState(0)
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[]>([])
  const [joinNickname, setJoinNickname] = useState('')
  const [error, setError] = useState('')
  const roomUrl = `${window.location.origin}/sala/${code}`
  const applySnapshot = useCallback((next: MockRoom) => {
    if (next.serverNow) setServerOffset(new Date(next.serverNow).getTime() - Date.now())
    setRoom(next)
  }, [])
  const refresh = useCallback(async () => {
    const next = await getRoom(code)
    if (!next) throw new Error('Sala no encontrada')
    applySnapshot(next)
  }, [applySnapshot, code])

  useEffect(() => {
    let cancelled = false
    async function establishAccess() {
      setAccessState('checking'); setRoom(null); setError(''); setOnlinePlayerIds([])
      try {
        await prepareRoomVisit()
        if (cancelled) return
        const storedPlayerId = localPlayerId(code)
        setPlayerId(storedPlayerId)
        if (isRealtimeMode && !storedPlayerId) {
          setAccessState('guest')
          return
        }
        await refresh()
        if (!cancelled) setAccessState(storedPlayerId ? 'member' : 'guest')
      } catch (caught) {
        if (cancelled) return
        const accessError = roomAccessError(caught)
        if (isRealtimeMode && localPlayerId(code)) forgetLocalPlayer(code)
        setPlayerId(null); setError(accessError.message); setAccessState(accessError.terminal ? 'blocked' : 'guest')
      }
    }
    void establishAccess()
    return () => { cancelled = true }
  }, [code, refresh])
  useEffect(() => {
    if (accessState !== 'member' || !playerId) return undefined
    return subscribeRoom(code, playerId, () => { void refresh().catch((caught) => setError(roomAccessError(caught).message)) }, setOnlinePlayerIds)
  }, [accessState, code, playerId, refresh])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer) }, [])

  const localPlayer = room?.players.find((player) => player.id === playerId) ?? null
  const currentRound = room?.rounds.at(-1)
  const isHost = localPlayer?.id === room?.hostId
  const serverNow = now + serverOffset

  const run = useCallback(async (operation: () => Promise<MockRoom>) => {
    try { setError(''); applySnapshot(await operation()) } catch (caught) { setError(caught instanceof Error ? caught.message : 'No pudimos actualizar la sala.') }
  }, [applySnapshot])

  useEffect(() => {
    if (!room || !currentRound || !isHost) return
    if (room.phase === 'debating' && timeLeft(currentRound.debateEndsAt, serverNow) === 0) void run(() => openVoting(room, room.hostId))
    if (room.phase === 'voting' && timeLeft(currentRound.voteEndsAt, serverNow) === 0) void run(() => closeVoting(room, room.hostId))
  }, [currentRound, isHost, room, run, serverNow])

  const rankedPlayers = useMemo(() => room ? [...room.players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname)) : [], [room])
  function shareWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(`Caé a mi mesa de Contramano. Entrá acá: ${roomUrl}`)}`, '_blank', 'noopener,noreferrer') }
  async function joinFromLink(event: FormEvent) {
    event.preventDefault()
    try {
      setError('')
      const next = await joinRoom(code, joinNickname.trim())
      setPlayerId(localPlayerId(code)); applySnapshot(next); setAccessState('member')
    } catch (caught) {
      const accessError = roomAccessError(caught)
      setError(accessError.message)
      if (accessError.terminal) setAccessState('blocked')
    }
  }

  if (accessState === 'checking') return <Layout><section className="empty-state"><p className="eyebrow">CARGANDO SALA</p><h1>Buscando la mesa…</h1></section></Layout>
  if (accessState === 'blocked') return <Layout><section className="empty-state"><p className="eyebrow">NO PUDIMOS ABRIR LA SALA</p><h1>{error || 'Esta sala no está disponible.'}</h1><Link className="button button-primary" to="/">Volver al inicio</Link></section></Layout>
  if (accessState === 'guest') return <Layout><section className="form-page join-link-page"><p className="eyebrow">ENTRASTE A UNA MESA</p><h1>Falta saber cómo te llamamos.</h1><form className="form-card" onSubmit={joinFromLink}><label htmlFor="shared-nickname">Tu apodo</label><input id="shared-nickname" autoFocus maxLength={16} value={joinNickname} onChange={(event) => setJoinNickname(event.target.value)} placeholder="Cómo te dicen" />{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary form-submit" type="submit" disabled={joinNickname.trim().length < 2}>Unirme a la mesa <span>→</span></button><p className="microcopy">No instalás nada. Jugás desde este link.</p></form></section></Layout>
  if (!room) return <Layout><section className="empty-state"><p className="eyebrow">SALA NO DISPONIBLE</p><h1>No pudimos cargar esta mesa.</h1><Link className="button button-primary" to="/">Volver al inicio</Link></section></Layout>
  if (new Date(room.expiresAt).getTime() <= Date.now()) return <Layout><section className="empty-state"><p className="eyebrow">SALA VENCIDA</p><h1>Esta mesa ya terminó su tiempo.</h1><Link className="button button-primary" to="/">Crear otra sala</Link></section></Layout>
  if (!localPlayer) return <Layout><section className="empty-state"><p className="eyebrow">ACCESO NO VÁLIDO</p><h1>Tu sesión no pertenece a esta sala.</h1><Link className="button button-primary" to="/">Volver al inicio</Link></section></Layout>

  const mySide = currentRound?.assignments[localPlayer.id]
  const amJuror = currentRound?.jurorIds.includes(localPlayer.id) ?? false
  const myVote = currentRound?.votes.find((item) => item.playerId === localPlayer.id)
  const debateRemaining = timeLeft(currentRound?.debateEndsAt ?? null, serverNow)
  const votingRemaining = timeLeft(currentRound?.voteEndsAt ?? null, serverNow)
  const canStart = room.players.length >= 3

  return <Layout><section className={`room-page intensity-${room.intensity}`}><div className="room-heading"><div className="room-heading-copy"><p className="eyebrow">SALA · {room.intensity === 'tranqui' ? 'TRANQUI' : 'MODO BARDO'} {isRealtimeMode && '· EN VIVO'}</p><h1>{room.phase === 'lobby' ? 'La mesa está servida.' : room.phase === 'finished' ? 'La mesa eligió.' : `Ronda ${currentRound?.number ?? 1} de 5`}</h1></div><span className="room-code">{room.code}</span></div>{error && <p className="form-error" role="alert">{error}</p>}
    {room.phase === 'lobby' && <Lobby room={room} isHost={isHost} canStart={canStart} onlinePlayerIds={onlinePlayerIds} onStart={() => void run(() => startGame(room, room.hostId))} onDemo={() => void run(() => addDemo(room))} onQr={() => setShowQr(true)} onShare={shareWhatsApp} />}
    {room.phase === 'debating' && currentRound && <section className="game-layout"><RoundCard round={currentRound} side={mySide} isJuror={amJuror} timer={displayTime(debateRemaining)} label="Tiempo para el bardo" /><aside className="game-sidebar"><PlayerScoreboard players={rankedPlayers} localPlayerId={localPlayer.id} /><section className="control-card"><p className="eyebrow">CAMBIAR CONSIGNA</p>{currentRound.changeRequests.length > 0 ? <p><b>{currentRound.changeRequests.length} persona{currentRound.changeRequests.length > 1 ? 's pidieron' : ' pidió'} cambiarla.</b></p> : <p>Si la consigna no va, pedí otra sin explicaciones.</p>}{!currentRound.changeRequests.includes(localPlayer.id) && <button className="button button-secondary full-width" onClick={() => void run(() => requestChange(room, localPlayer.id))}>Solicitar cambio</button>}{isHost && currentRound.changeRequests.length > 0 && <button className="button button-primary full-width" onClick={() => void run(() => confirmChange(room, room.hostId))}>Cambiar consigna</button>}</section>{isHost && <section className="control-card host-card"><p className="eyebrow">CONTROL DEL HOST</p><button className="button button-dark full-width" onClick={() => void run(() => openVoting(room, room.hostId))}>Abrir votación ahora</button><small>También se abre sola al terminar el contador.</small></section>}</aside></section>}
    {room.phase === 'voting' && currentRound && <section className="game-layout"><RoundCard round={currentRound} side={mySide} isJuror={amJuror} timer={displayTime(votingRemaining)} label="El jurado está deliberando" compact /><aside className="game-sidebar">{amJuror ? <section className="vote-card"><p className="eyebrow">VOTO PRIVADO DEL JURADO</p><h2>¿Qué postura fue mejor defendida?</h2>{myVote ? <p className="vote-confirmation">Tu veredicto quedó guardado.</p> : <div className="vote-buttons"><button onClick={() => void run(() => vote(room, localPlayer.id, 'A'))}>{currentRound.prompt.sideA}</button><button onClick={() => void run(() => vote(room, localPlayer.id, 'B'))}>{currentRound.prompt.sideB}</button></div>}<p className="vote-progress">{currentRound.votes.length} de {currentRound.jurorIds.length} voto{currentRound.jurorIds.length > 1 ? 's' : ''} del jurado</p></section> : <section className="control-card jury-wait"><p className="eyebrow">EL JURADO DELIBERA</p><h2>Ahora escuchan y deciden ellos.</h2><p>Tu equipo ya hizo lo suyo. No votás esta ronda.</p></section>}{isHost && <section className="control-card host-card">{!isRealtimeMode && <button className="button button-secondary full-width" onClick={() => void completeDemoVotes(room, currentRound, run)}>Completar votos de demo</button>}<button className="button button-dark full-width" onClick={() => void run(() => closeVoting(room, room.hostId))}>Cerrar votación y mostrar resultado</button></section>}</aside></section>}
    {room.phase === 'results' && currentRound && <ResultScreen room={room} round={currentRound} isHost={isHost} onIntensity={(intensity) => void run(() => changeIntensity(room, room.hostId, intensity))} onContinue={() => void run(() => nextRound(room, room.hostId))} />}
    {room.phase === 'finished' && <FinishedScreen players={rankedPlayers} isHost={isHost} onRematch={() => void run(() => rematch(room, room.hostId))} />}
  </section>{showQr && <QrModal url={roomUrl} onClose={() => setShowQr(false)} />}</Layout>
}

async function completeDemoVotes(room: MockRoom, round: MockRoom['rounds'][number], run: (operation: () => Promise<MockRoom>) => Promise<void>) { for (const [index, playerId] of round.jurorIds.entries()) await run(() => vote(room, playerId, index % 2 === 0 ? 'A' : 'B')) }
function Lobby({ room, isHost, canStart, onlinePlayerIds, onStart, onDemo, onQr, onShare }: { room: MockRoom; isHost: boolean; canStart: boolean; onlinePlayerIds: string[]; onStart: () => void; onDemo: () => void; onQr: () => void; onShare: () => void }) { return <div className="room-grid"><section className="lobby-card"><div className="lobby-card-top"><div><p className="eyebrow">JUGADORES</p><h2>{room.players.length} {room.players.length === 1 ? 'persona' : 'personas'} en la mesa</h2></div><span className="live-dot">En lobby</span></div><PlayerList players={room.players} onlinePlayerIds={onlinePlayerIds} />{room.players.length === 1 && <div className="waiting-message"><b>Creaste la mesa.</b><span>Compartí el QR o el link para sumar gente.</span></div>}{room.players.length === 2 && <div className="waiting-message"><b>Falta una persona para empezar.</b><span>Mandá el link al grupo y listo.</span></div>}{canStart && <div className="ready-message"><b>Ya pueden arrancar.</b><span>En cada ronda alguien será jurado.</span></div>}{isHost && <button className="button button-dark full-width" disabled={!canStart} onClick={onStart}>Empezar partida <span>→</span></button>}</section><aside className="share-card"><p className="eyebrow">INVITÁ A LA MESA</p><h2>Un link y adentro.</h2><p>La mesa admite de 3 a {MAX_PLAYERS} personas.</p><div className="share-count" aria-label={`${room.players.length} de ${MAX_PLAYERS} lugares ocupados`}><span style={{ width: `${(room.players.length / MAX_PLAYERS) * 100}%` }} /></div><button className="button button-primary full-width" onClick={onQr}>Mostrar QR</button><button className="button button-secondary full-width" onClick={onShare}>Compartir por WhatsApp</button>{room.players.length >= MAX_PLAYERS ? <p className="room-full">Sala completa: ya son {MAX_PLAYERS}.</p> : isHost && !isRealtimeMode && <button className="text-button" onClick={onDemo}>Completar mesa de demo</button>}</aside></div> }
function RoundCard({ round, side, isJuror, timer, label, compact = false }: { round: MockRoom['rounds'][number]; side: Side | undefined; isJuror: boolean; timer: string; label: string; compact?: boolean }) { return <section className={`round-card ${compact ? 'compact' : ''} ${isJuror ? 'round-card-jury' : `round-card-side-${side ?? 'none'}`} `}><div className="round-top"><span className="tag tag-blue">{round.prompt.category}</span><span className="timer"><i />{timer}</span></div><p className="eyebrow">{label}</p><h2>{round.prompt.text}</h2>{isJuror ? <div className="jury-role"><span>ROL DE ESTA RONDA</span><strong>Sos jurado</strong><small>Escuchá, detectá chamuyo y decidí el veredicto.</small></div> : <div className="my-side"><span>TE TOCÓ DEFENDER</span><strong className={side === 'A' ? 'side-a' : 'side-b'}>{side === 'A' ? round.prompt.sideA : round.prompt.sideB}</strong><small>No importa si estás de acuerdo: esa es la gracia.</small></div>}</section> }
function PlayerList({ players, onlinePlayerIds }: { players: MockRoom['players']; onlinePlayerIds: string[] }) { return <ul className="player-list">{players.map((player) => <li className={player.isHost ? 'is-host' : ''} key={player.id}><span className="avatar">{player.nickname.slice(0, 1).toUpperCase()}</span><span>{player.nickname}{player.isHost && <small>Anfitrión</small>}</span><span className="online">{onlinePlayerIds.includes(player.id) || !isRealtimeMode ? 'conectado' : 'ausente'}</span></li>)}</ul> }
function PlayerScoreboard({ players, localPlayerId }: { players: MockRoom['players']; localPlayerId: string }) { return <section className="scoreboard"><p className="eyebrow">PUNTAJE</p>{players.map((player, index) => <div className={player.id === localPlayerId ? 'score-row is-me' : 'score-row'} key={player.id}><span>{index + 1}. {player.nickname}</span><b>{player.score}</b></div>)}</section> }
function ResultScreen({ room, round, isHost, onIntensity, onContinue }: { room: MockRoom; round: MockRoom['rounds'][number]; isHost: boolean; onIntensity: (intensity: MockRoom['intensity']) => void; onContinue: () => void }) { const label = round.result === 'A' ? round.prompt.sideA : round.prompt.sideB; const votesA = round.votes.filter((vote) => vote.side === 'A').length; const votesB = round.votes.filter((vote) => vote.side === 'B').length; return <section className="result-screen"><p className="eyebrow">RESULTADO · RONDA {round.number}</p><h2>Veredicto del jurado</h2>{round.wasRandomTiebreak && <div className="chaos-tiebreak"><b>Desempate del caos</b><span>El jurado quedó empatado: la postura ganadora salió al azar.</span></div>}<div className="result-badge">{label}</div><p>{votesA} votos para <b>{round.prompt.sideA}</b> · {votesB} para <b>{round.prompt.sideB}</b></p><PlayerScoreboard players={[...room.players].sort((a, b) => b.score - a.score)} localPlayerId="" />{isHost && <><div className="intensity-switch"><span>Siguiente ronda:</span><button className={room.intensity === 'tranqui' ? 'selected' : ''} onClick={() => onIntensity('tranqui')}>Tranqui</button><button className={room.intensity === 'bardo' ? 'selected bardo' : ''} onClick={() => onIntensity('bardo')}>Modo Bardo</button></div><button className="button button-primary result-action" onClick={onContinue}>{round.number === 5 ? 'Ver ranking final' : 'Siguiente ronda'} <span>→</span></button></>}</section> }
function FinishedScreen({ players, isHost, onRematch }: { players: MockRoom['players']; isHost: boolean; onRematch: () => void }) { return <section className="result-screen finished"><p className="eyebrow">CINCO RONDAS DESPUÉS</p><h2>Se discutió. Se votó. Se sobrevivió.</h2><div className="final-ranking">{players.map((player, index) => <div key={player.id}><span>{index + 1}</span><b>{player.nickname}</b><strong>{player.score} pts</strong></div>)}</div>{isHost && <button className="button button-primary result-action" onClick={onRematch}>Revancha <span>↻</span></button>}<p className="microcopy">La revancha continúa los mazos de la sala.</p></section> }
