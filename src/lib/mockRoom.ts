import { findPrompt, promptsForIntensity } from '../data/prompts'
import type { DeckStage, Intensity, MockDeck, MockPlayer, MockRoom, MockRound, PromptPreview, Side } from '../types/game'
import { generateRoomCode } from './roomCode'

const STORAGE_PREFIX = 'contramano:room:'
const SESSION_PREFIX = 'contramano:player:'
const DEBATE_SECONDS = 60
const VOTE_SECONDS = 30
const CONNECTED_WINDOW_MS = 20_000
const HOST_GRACE_MS = 45_000
export const MAX_PLAYERS = 8
export const MIN_PLAYERS = 3

type Random = () => number

function id(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` }

function shuffled<T>(items: T[], random: Random): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function promptsForStage(intensity: Intensity, stage: DeckStage): PromptPreview[] {
  return promptsForIntensity(intensity).filter((prompt) => intensity === 'bardo'
    ? prompt.status === 'active' || prompt.status === 'reserve'
    : stage === 'active'
    ? prompt.status === 'active'
    : stage === 'reserve'
      ? prompt.status === 'reserve'
      : prompt.status === 'active' || prompt.status === 'reserve')
}

function newDeck(intensity: Intensity, history: string[] = [], cycle = 1, random: Random = Math.random, stage: DeckStage = intensity === 'bardo' ? 'repeat' : 'active'): MockDeck {
  const recent = new Set(history.slice(-5))
  const eligible = promptsForStage(intensity, stage)
  const protectedIds = eligible.filter((prompt) => !recent.has(prompt.id)).map((prompt) => prompt.id)
  const blockedIds = eligible.filter((prompt) => recent.has(prompt.id)).map((prompt) => prompt.id)
  const safePrefix = shuffled(protectedIds, random)
  const delayed = shuffled(blockedIds, random)
  const firstFive = safePrefix.slice(0, 5)
  const remaining = shuffled([...safePrefix.slice(5), ...delayed], random)
  return { order: [...firstFive, ...remaining], cursor: 0, history, cycle, stage }
}

function createDecks(random: Random = Math.random): MockRoom['decks'] {
  return { tranqui: newDeck('tranqui', [], 1, random), bardo: newDeck('bardo', [], 1, random) }
}

function nextPrompt(room: MockRoom, intensity: Intensity, random: Random = Math.random): PromptPreview {
  let deck = room.decks[intensity]
  if (intensity === 'bardo' && deck.stage !== 'repeat') {
    // Los mazos guardados antes de la normalización tenían sólo las activas.
    // Se reconstruyen sin perder historial para mezclar activas y reservas.
    deck = newDeck(intensity, deck.history, deck.cycle, random, 'repeat')
    room.decks[intensity] = deck
  }
  const hasPlayableAhead = (candidateDeck: MockDeck): boolean => candidateDeck.order.slice(candidateDeck.cursor)
    .some((promptId) => {
      const prompt = findPrompt(promptId)
      return Boolean(prompt && prompt.status !== 'archived')
    })

  while (!hasPlayableAhead(deck)) {
    // Salas guardadas antes de V2 pueden conservar IDs archivados. En vez de
    // romper la partida, se reconstruye ese tramo con el catálogo vigente.
    const exhausted = deck.cursor >= deck.order.length
    const nextStage: DeckStage = exhausted ? (deck.stage === 'active' ? 'reserve' : 'repeat') : deck.stage
    deck = newDeck(intensity, deck.history, deck.cycle + (exhausted ? 1 : 0), random, nextStage)
    room.decks[intensity] = deck
    if (hasPlayableAhead(deck)) break
    if (deck.stage === 'repeat' || !promptsForStage(intensity, nextStage).length) throw new Error(`No hay consignas disponibles para ${intensity}.`)
  }
  // En una revancha, las cinco del juego anterior siguen protegidas mientras
  // se completan las cinco nuevas. Durante una partida también evitamos toda
  // repetición de pregunta, no sólo las cinco últimas del historial global.
  const protectedHistoryStart = Math.max(0, deck.history.length - room.rounds.length - 5)
  const recentIds = new Set(deck.history.slice(protectedHistoryStart))
  const categoryRounds = room.phase === 'debating' ? room.rounds.slice(0, -1) : room.rounds
  const usedCategories = new Set(categoryRounds.map((round) => round.prompt.category))
  let selectedIndex = deck.cursor
  for (let index = deck.cursor; index < deck.order.length; index += 1) {
    const candidate = findPrompt(deck.order[index])
    if (!candidate || candidate.status === 'archived') continue
    if (!recentIds.has(candidate.id) && !usedCategories.has(candidate.category)) { selectedIndex = index; break }
  }
  if (selectedIndex === deck.cursor) {
    // Degradación controlada: sólo se permite repetir categoría si ya no hay
    // otra disponible. Las cinco últimas preguntas siguen protegidas.
    for (let index = deck.cursor; index < deck.order.length; index += 1) {
      const candidate = findPrompt(deck.order[index])
      if (!candidate || candidate.status === 'archived') continue
      if (!recentIds.has(candidate.id)) { selectedIndex = index; break }
    }
  }
  if (selectedIndex === deck.cursor) {
    for (let index = deck.cursor; index < deck.order.length; index += 1) {
      const candidate = findPrompt(deck.order[index])
      if (candidate && candidate.status !== 'archived') { selectedIndex = index; break }
    }
  }
  ;[deck.order[deck.cursor], deck.order[selectedIndex]] = [deck.order[selectedIndex], deck.order[deck.cursor]]
  const promptId = deck.order[deck.cursor]
  deck.cursor += 1
  deck.history.push(promptId)
  const prompt = findPrompt(promptId)
  if (!prompt || prompt.status === 'archived') throw new Error('La consigna elegida ya no está disponible.')
  return prompt
}

function normalizeRoom(room: MockRoom): MockRoom {
  return {
    ...room,
    phase: room.phase ?? 'lobby', lastOddExtraSide: room.lastOddExtraSide ?? null,
    decks: room.decks ? {
      tranqui: { ...room.decks.tranqui, stage: room.decks.tranqui.stage ?? 'active' },
      bardo: { ...room.decks.bardo, stage: room.decks.bardo.stage ?? 'active' },
    } : createDecks(),
    players: room.players.map((player) => ({ ...player, score: player.score ?? 0, activeFromRound: player.activeFromRound ?? 1, juryRounds: player.juryRounds ?? 0, lastSeenAt: player.lastSeenAt ?? room.createdAt })),
    rounds: (room.rounds ?? []).map((round) => ({ ...round, jurorIds: round.jurorIds ?? [], wasRandomTiebreak: round.wasRandomTiebreak ?? false })),
  }
}

function currentRound(room: MockRoom): MockRound {
  const round = room.rounds.at(-1)
  if (!round) throw new Error('No hay una ronda activa.')
  return round
}

function savePlayerSession(code: string, playerId: string): void { localStorage.setItem(`${SESSION_PREFIX}${code}`, playerId) }
export function getLocalPlayerId(code: string): string | null { return localStorage.getItem(`${SESSION_PREFIX}${code.toUpperCase()}`) }
export function saveMockRoom(room: MockRoom): void { localStorage.setItem(`${STORAGE_PREFIX}${room.code}`, JSON.stringify(room)) }
export function getMockRoom(code: string): MockRoom | null {
  const saved = localStorage.getItem(`${STORAGE_PREFIX}${code.toUpperCase()}`)
  return saved ? normalizeRoom(JSON.parse(saved) as MockRoom) : null
}
function mutateRoom(code: string, mutation: (room: MockRoom) => void): MockRoom | null {
  const room = getMockRoom(code)
  if (!room) return null
  mutation(room); saveMockRoom(room); return room
}

export function createMockRoom(nickname: string, intensity: Intensity): MockRoom {
  let code = generateRoomCode()
  while (getMockRoom(code)) code = generateRoomCode()
  const now = new Date()
  const host: MockPlayer = { id: id(), nickname, isHost: true, score: 0, activeFromRound: 1, juryRounds: 0, lastSeenAt: now.toISOString() }
  const room: MockRoom = { code, hostId: host.id, intensity, phase: 'lobby', players: [host], rounds: [], decks: createDecks(), lastOddExtraSide: null, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 86400000).toISOString() }
  saveMockRoom(room); savePlayerSession(code, host.id); return room
}

export function joinMockRoom(code: string, nickname: string): MockRoom | null {
  const room = mutateRoom(code, (storedRoom) => {
    const existing = storedRoom.players.find((player) => player.nickname.toLowerCase() === nickname.toLowerCase())
    if (existing) { existing.lastSeenAt = new Date().toISOString(); savePlayerSession(storedRoom.code, existing.id); return }
    if (storedRoom.players.length >= MAX_PLAYERS) return
    storedRoom.players.push({ id: id(), nickname, isHost: false, score: 0, juryRounds: 0, activeFromRound: storedRoom.phase === 'lobby' ? 1 : storedRoom.rounds.length + 1, lastSeenAt: new Date().toISOString() })
  })
  const player = room?.players.find((candidate) => candidate.nickname.toLowerCase() === nickname.toLowerCase())
  if (player) savePlayerSession(room!.code, player.id)
  return room
}

export function addDemoPlayers(code: string): MockRoom | null {
  return mutateRoom(code, (room) => {
    ;['Mili', 'Tomi', 'Sofi', 'Lolo', 'Nati', 'Pau', 'Rama'].forEach((nickname) => {
      if (room.players.length >= MAX_PLAYERS || room.players.some((player) => player.nickname === nickname)) return
      room.players.push({ id: id(), nickname, isHost: false, score: 0, juryRounds: 0, activeFromRound: room.phase === 'lobby' ? 1 : room.rounds.length + 1, lastSeenAt: new Date().toISOString() })
    })
  })
}

export function jurorCountFor(playerCount: number): number { return playerCount >= 6 ? 2 : 1 }

export function selectJurors(players: MockPlayer[], previousJurorIds: string[] = [], random: Random = Math.random): MockPlayer[] {
  const count = jurorCountFor(players.length)
  return [...players].sort((left, right) => {
    const juryDifference = left.juryRounds - right.juryRounds
    if (juryDifference !== 0) return juryDifference
    const leftWasJuror = previousJurorIds.includes(left.id) ? 1 : 0
    const rightWasJuror = previousJurorIds.includes(right.id) ? 1 : 0
    if (leftWasJuror !== rightWasJuror) return leftWasJuror - rightWasJuror
    return random() < 0.5 ? -1 : 1
  }).slice(0, count)
}

export function assignPostures(players: MockPlayer[], previousAssignments: Record<string, Side> = {}, lastOddExtraSide: Side | null = null, random: Random = Math.random): { assignments: Record<string, Side>; lastOddExtraSide: Side | null } {
  const count = players.length
  if (count < 2) throw new Error('Se necesitan al menos dos personas debatiendo.')
  const extraSide: Side | null = count % 2 === 1 ? (lastOddExtraSide === null ? (random() < 0.5 ? 'A' : 'B') : lastOddExtraSide === 'A' ? 'B' : 'A') : null
  const targetA = Math.floor(count / 2) + (extraSide === 'A' ? 1 : 0)
  const targetB = count - targetA
  const assignments: Record<string, Side> = {}
  let assignedA = 0; let assignedB = 0
  const place = (player: MockPlayer, side: Side): boolean => {
    if (side === 'A' && assignedA < targetA) { assignments[player.id] = 'A'; assignedA += 1; return true }
    if (side === 'B' && assignedB < targetB) { assignments[player.id] = 'B'; assignedB += 1; return true }
    return false
  }
  const previousA = shuffled(players.filter((player) => previousAssignments[player.id] === 'A'), random)
  const previousB = shuffled(players.filter((player) => previousAssignments[player.id] === 'B'), random)
  const newcomers = shuffled(players.filter((player) => previousAssignments[player.id] === undefined), random)
  previousB.forEach((player) => place(player, 'A'))
  previousA.forEach((player) => place(player, 'B'))
  newcomers.forEach((player) => {
    if (assignedA === targetA) place(player, 'B')
    else if (assignedB === targetB) place(player, 'A')
    else place(player, random() < 0.5 ? 'A' : 'B')
  })
  shuffled([...previousA, ...previousB], random).filter((player) => !assignments[player.id]).forEach((player) => {
    const opposite: Side = previousAssignments[player.id] === 'A' ? 'B' : 'A'
    if (!place(player, opposite)) place(player, opposite === 'A' ? 'B' : 'A')
  })
  return { assignments, lastOddExtraSide: extraSide ?? lastOddExtraSide }
}

function beginRound(room: MockRoom, random: Random = Math.random): void {
  const number = room.rounds.length + 1
  const active = room.players.filter((player) => player.activeFromRound <= number)
  const previous = room.rounds.at(-1)
  const jurors = selectJurors(active, previous?.jurorIds, random)
  const debaters = active.filter((player) => !jurors.some((juror) => juror.id === player.id))
  const allocation = assignPostures(debaters, previous?.assignments, room.lastOddExtraSide, random)
  const now = Date.now()
  jurors.forEach((juror) => { juror.juryRounds += 1 })
  room.lastOddExtraSide = allocation.lastOddExtraSide
  const prompt = nextPrompt(room, room.intensity, random)
  room.rounds.push({ number, promptId: prompt.id, prompt, jurorIds: jurors.map((juror) => juror.id), assignments: allocation.assignments, debateEndsAt: new Date(now + DEBATE_SECONDS * 1000).toISOString(), voteEndsAt: null, votes: [], changeRequests: [], result: undefined, wasRandomTiebreak: false })
  room.phase = 'debating'
}

export function startMockGame(code: string, actorId: string, random: Random = Math.random): MockRoom | null { return mutateRoom(code, (room) => { if (actorId === room.hostId && room.phase === 'lobby' && room.players.length >= MIN_PLAYERS) beginRound(room, random) }) }
export function advanceToVoting(code: string, actorId: string): MockRoom | null { return mutateRoom(code, (room) => { const round = currentRound(room); if (room.phase === 'debating' && (actorId === room.hostId || Date.now() >= new Date(round.debateEndsAt).getTime())) { room.phase = 'voting'; round.voteEndsAt = new Date(Date.now() + VOTE_SECONDS * 1000).toISOString() } }) }

function finalizeRound(room: MockRoom, random: Random = Math.random): void {
  const round = currentRound(room)
  const a = round.votes.filter((vote) => vote.side === 'A').length
  const b = round.votes.filter((vote) => vote.side === 'B').length
  round.wasRandomTiebreak = a === b
  round.result = a === b ? (random() < 0.5 ? 'A' : 'B') : a > b ? 'A' : 'B'
  room.players.forEach((player) => { if (round.assignments[player.id] === round.result) player.score += 1 })
  room.phase = 'results'
}

export function castMockVote(code: string, playerId: string, side: Side, random: Random = Math.random): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (room.phase !== 'voting') return
    const round = currentRound(room)
    if (!round.jurorIds.includes(playerId) || round.votes.some((vote) => vote.playerId === playerId)) return
    round.votes.push({ playerId, side })
    if (round.votes.length === round.jurorIds.length) finalizeRound(room, random)
  })
}

export function closeMockVoting(code: string, _actorId: string, random: Random = Math.random): MockRoom | null { return mutateRoom(code, (room) => { const round = currentRound(room); if (room.phase === 'voting' && Boolean(round.voteEndsAt && Date.now() >= new Date(round.voteEndsAt).getTime())) finalizeRound(room, random) }) }
export function requestPromptChange(code: string, playerId: string): MockRoom | null { return mutateRoom(code, (room) => { if (room.phase !== 'debating') return; const round = currentRound(room); if (!(round.assignments[playerId] || round.jurorIds.includes(playerId))) return; if (!round.changeRequests.includes(playerId)) round.changeRequests.push(playerId) }) }
export function confirmPromptChange(code: string, actorId: string, random: Random = Math.random): MockRoom | null { return mutateRoom(code, (room) => { if (actorId !== room.hostId || room.phase !== 'debating') return; const round = currentRound(room); if (round.changeRequests.length === 0) return; const next = nextPrompt(room, room.intensity, random); round.prompt = next; round.promptId = next.id; round.changeRequests = []; round.debateEndsAt = new Date(Date.now() + DEBATE_SECONDS * 1000).toISOString() }) }
export function setMockIntensity(code: string, actorId: string, intensity: Intensity): MockRoom | null { return mutateRoom(code, (room) => { if (actorId === room.hostId && (room.phase === 'lobby' || room.phase === 'results')) room.intensity = intensity }) }
export function continueMockGame(code: string, actorId: string, random: Random = Math.random): MockRoom | null { return mutateRoom(code, (room) => { if (actorId !== room.hostId || room.phase !== 'results') return; if (room.rounds.length >= 5) { room.phase = 'finished'; return }; beginRound(room, random) }) }
function isConnected(player: MockPlayer, now: number): boolean { return new Date(player.lastSeenAt ?? 0).getTime() >= now - CONNECTED_WINDOW_MS }

export function heartbeatMockRoom(code: string, playerId: string, now = Date.now()): MockRoom | null {
  return mutateRoom(code, (room) => {
    const player = room.players.find((candidate) => candidate.id === playerId)
    if (player) player.lastSeenAt = new Date(now).toISOString()
  })
}

export function reconcileMockRoom(code: string, now = Date.now(), random: Random = Math.random): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (new Date(room.expiresAt).getTime() <= now) return
    const connected = room.players.filter((player) => isConnected(player, now))
    room.connectedPlayerIds = connected.map((player) => player.id)
    const round = room.rounds.at(-1)
    if (room.phase === 'debating' || room.phase === 'voting') {
      if (connected.length < MIN_PLAYERS && round) {
        room.pausedPhase = room.phase
        room.pausedRemainingSeconds = Math.max(0, Math.ceil(((room.phase === 'voting' ? new Date(round.voteEndsAt ?? now).getTime() : new Date(round.debateEndsAt).getTime()) - now) / 1000))
        room.pauseReason = 'low_players'; room.phase = 'paused'
      } else if (room.phase === 'debating' && now >= new Date(round?.debateEndsAt ?? now).getTime()) {
        room.phase = 'voting'; if (round) round.voteEndsAt = new Date(now + VOTE_SECONDS * 1000).toISOString()
      } else if (room.phase === 'voting' && now >= new Date(round?.voteEndsAt ?? now).getTime()) {
        finalizeRound(room, random)
      }
    }
    const host = room.players.find((player) => player.id === room.hostId)
    if (host && !isConnected(host, now) && new Date(host.lastSeenAt ?? 0).getTime() < now - HOST_GRACE_MS && connected.length >= MIN_PLAYERS) {
      const nextHost = [...connected].filter((player) => player.id !== host.id).sort((left, right) => left.id.localeCompare(right.id))[0]
      if (nextHost) { room.players.forEach((player) => { player.isHost = player.id === nextHost.id }); room.hostId = nextHost.id }
    }
  })
}

export function pauseMockGame(code: string, actorId: string, now = Date.now()): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (actorId !== room.hostId || (room.phase !== 'debating' && room.phase !== 'voting')) return
    const round = currentRound(room); room.pausedPhase = room.phase; room.pausedRemainingSeconds = Math.max(0, Math.ceil(((room.phase === 'voting' ? new Date(round.voteEndsAt ?? now).getTime() : new Date(round.debateEndsAt).getTime()) - now) / 1000)); room.pauseReason = 'host'; room.phase = 'paused'
  })
}

export function resumeMockGame(code: string, actorId: string, now = Date.now()): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (actorId !== room.hostId || room.phase !== 'paused' || room.players.filter((player) => isConnected(player, now)).length < MIN_PLAYERS) return
    const round = currentRound(room); const remaining = room.pausedRemainingSeconds ?? 0
    if (room.pausedPhase === 'voting') round.voteEndsAt = new Date(now + remaining * 1000).toISOString()
    else round.debateEndsAt = new Date(now + remaining * 1000).toISOString()
    room.phase = room.pausedPhase ?? 'debating'; room.pausedPhase = null; room.pausedRemainingSeconds = null; room.pauseReason = null
  })
}

export function rematchMockGame(code: string, actorId: string): MockRoom | null {
  const room = getMockRoom(code)
  if (!room || actorId !== room.hostId || room.phase !== 'finished') return room
  const now = Date.now(); const connected = room.players.filter((player) => isConnected(player, now))
  const host = connected.find((player) => player.id === actorId)
  if (!host) return room
  let nextCode = generateRoomCode(); while (getMockRoom(nextCode)) nextCode = generateRoomCode()
  const nextPlayers = connected.map((player) => ({ ...player, isHost: player.id === host.id, score: 0, juryRounds: 0, activeFromRound: 1, lastSeenAt: new Date(now).toISOString() }))
  const previousFive = room.rounds.slice(-5).map((round) => round.promptId)
  const next: MockRoom = {
    code: nextCode, hostId: host.id, intensity: room.intensity, phase: 'lobby', players: nextPlayers, rounds: [],
    decks: {
      tranqui: newDeck('tranqui', previousFive),
      bardo: newDeck('bardo', previousFive),
    },
    lastOddExtraSide: null, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(), connectedPlayerIds: nextPlayers.map((player) => player.id),
  }
  room.successorCode = nextCode; saveMockRoom(room); saveMockRoom(next); savePlayerSession(nextCode, host.id)
  return next
}
export const mockDurations = { debateSeconds: DEBATE_SECONDS, voteSeconds: VOTE_SECONDS }
