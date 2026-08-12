import { promptPreviews } from '../data/prompts'
import type { Intensity, MockPlayer, MockRoom, MockRound, Side } from '../types/game'
import { generateRoomCode } from './roomCode'

const STORAGE_PREFIX = 'contramano:room:'
const SESSION_PREFIX = 'contramano:player:'
const DEBATE_SECONDS = 60
const VOTE_SECONDS = 30

type Random = () => number

function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function shuffled<T>(items: T[], random: Random): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function normalizeRoom(room: MockRoom): MockRoom {
  return {
    ...room,
    phase: room.phase ?? 'lobby',
    rounds: room.rounds ?? [],
    lastOddExtraSide: room.lastOddExtraSide ?? null,
    players: room.players.map((player) => ({
      ...player,
      score: player.score ?? 0,
      activeFromRound: player.activeFromRound ?? 1,
    })),
  }
}

function currentRound(room: MockRoom): MockRound {
  const round = room.rounds.at(-1)
  if (!round) throw new Error('No hay una ronda activa.')
  return round
}

function savePlayerSession(code: string, playerId: string): void {
  localStorage.setItem(`${SESSION_PREFIX}${code}`, playerId)
}

export function getLocalPlayerId(code: string): string | null {
  return localStorage.getItem(`${SESSION_PREFIX}${code.toUpperCase()}`)
}

export function saveMockRoom(room: MockRoom): void {
  localStorage.setItem(`${STORAGE_PREFIX}${room.code}`, JSON.stringify(room))
}

export function getMockRoom(code: string): MockRoom | null {
  const saved = localStorage.getItem(`${STORAGE_PREFIX}${code.toUpperCase()}`)
  return saved ? normalizeRoom(JSON.parse(saved) as MockRoom) : null
}

function mutateRoom(code: string, mutation: (room: MockRoom) => void): MockRoom | null {
  const room = getMockRoom(code)
  if (!room) return null
  mutation(room)
  saveMockRoom(room)
  return room
}

export function createMockRoom(nickname: string, intensity: Intensity): MockRoom {
  let code = generateRoomCode()
  while (getMockRoom(code)) code = generateRoomCode()
  const host: MockPlayer = { id: id(), nickname, isHost: true, score: 0, activeFromRound: 1 }
  const now = new Date()
  const room: MockRoom = {
    code,
    hostId: host.id,
    intensity,
    phase: 'lobby',
    players: [host],
    rounds: [],
    lastOddExtraSide: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
  saveMockRoom(room)
  savePlayerSession(code, host.id)
  return room
}

export function joinMockRoom(code: string, nickname: string): MockRoom | null {
  const room = mutateRoom(code, (storedRoom) => {
    const existing = storedRoom.players.find((player) => player.nickname.toLowerCase() === nickname.toLowerCase())
    if (existing) {
      savePlayerSession(storedRoom.code, existing.id)
      return
    }
    const nextRound = storedRoom.rounds.length + 1
    storedRoom.players.push({
      id: id(), nickname, isHost: false, score: 0,
      activeFromRound: storedRoom.phase === 'lobby' ? 1 : nextRound,
    })
  })
  if (room) {
    const player = room.players.find((candidate) => candidate.nickname.toLowerCase() === nickname.toLowerCase())
    if (player) savePlayerSession(room.code, player.id)
  }
  return room
}

export function addDemoPlayers(code: string): MockRoom | null {
  return mutateRoom(code, (room) => {
    ;['Mili', 'Tomi', 'Sofi', 'Lolo'].forEach((nickname) => {
      if (room.players.some((player) => player.nickname === nickname)) return
      room.players.push({ id: id(), nickname, isHost: false, score: 0, activeFromRound: room.rounds.length + 1 })
    })
  })
}

export function assignPostures(
  players: MockPlayer[],
  previousAssignments: Record<string, Side> = {},
  lastOddExtraSide: Side | null = null,
  random: Random = Math.random,
): { assignments: Record<string, Side>; lastOddExtraSide: Side | null } {
  const playerCount = players.length
  if (playerCount < 2) throw new Error('Se necesitan al menos dos jugadores para armar equipos.')
  const extraSide: Side | null = playerCount % 2 === 1 ? (lastOddExtraSide === null ? (random() < 0.5 ? 'A' : 'B') : lastOddExtraSide === 'A' ? 'B' : 'A') : null
  const targetA = Math.floor(playerCount / 2) + (extraSide === 'A' ? 1 : 0)
  const targetB = playerCount - targetA
  const assignments: Record<string, Side> = {}
  let assignedA = 0
  let assignedB = 0
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
  shuffled([...previousA, ...previousB], random).filter((player) => assignments[player.id] === undefined).forEach((player) => {
    const opposite: Side = previousAssignments[player.id] === 'A' ? 'B' : 'A'
    if (!place(player, opposite)) place(player, opposite === 'A' ? 'B' : 'A')
  })
  return { assignments, lastOddExtraSide: extraSide ?? lastOddExtraSide }
}

function pickPrompt(room: MockRoom): import('../types/game').PromptPreview {
  const usedIds = new Set(room.rounds.map((round) => round.promptId))
  const available = promptPreviews.filter((prompt) => prompt.intensity === room.intensity && !usedIds.has(prompt.id))
  return (available.length > 0 ? available : promptPreviews.filter((prompt) => prompt.intensity === room.intensity))[room.rounds.length % 12]
}

function beginRound(room: MockRoom, random: Random = Math.random): void {
  const number = room.rounds.length + 1
  const activePlayers = room.players.filter((player) => player.activeFromRound <= number)
  const previous = room.rounds.at(-1)
  const allocation = assignPostures(activePlayers, previous?.assignments, room.lastOddExtraSide, random)
  const now = Date.now()
  const prompt = pickPrompt(room)
  room.lastOddExtraSide = allocation.lastOddExtraSide
  room.rounds.push({ number, promptId: prompt.id, prompt, assignments: allocation.assignments, debateEndsAt: new Date(now + DEBATE_SECONDS * 1000).toISOString(), voteEndsAt: null, votes: [], changeRequests: [], result: undefined })
  room.phase = 'debating'
}

export function startMockGame(code: string, actorId: string, random: Random = Math.random): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (actorId !== room.hostId || room.phase !== 'lobby' || room.players.length < 3) return
    beginRound(room, random)
  })
}

export function advanceToVoting(code: string, actorId: string): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (actorId !== room.hostId || room.phase !== 'debating') return
    const round = currentRound(room)
    room.phase = 'voting'
    round.voteEndsAt = new Date(Date.now() + VOTE_SECONDS * 1000).toISOString()
  })
}

function finalizeRound(room: MockRoom): void {
  const round = currentRound(room)
  const votesA = round.votes.filter((vote) => vote.side === 'A').length
  const votesB = round.votes.filter((vote) => vote.side === 'B').length
  round.result = votesA === votesB ? null : votesA > votesB ? 'A' : 'B'
  if (round.result) room.players.forEach((player) => { if (round.assignments[player.id] === round.result) player.score += 1 })
  room.phase = 'results'
}

export function castMockVote(code: string, playerId: string, side: Side): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (room.phase !== 'voting') return
    const round = currentRound(room)
    if (!round.assignments[playerId] || round.votes.some((vote) => vote.playerId === playerId)) return
    round.votes.push({ playerId, side })
    if (round.votes.length === Object.keys(round.assignments).length) finalizeRound(room)
  })
}

export function closeMockVoting(code: string, actorId: string): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (actorId === room.hostId && room.phase === 'voting') finalizeRound(room)
  })
}

export function requestPromptChange(code: string, playerId: string): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (room.phase !== 'debating' || !currentRound(room).assignments[playerId]) return
    const round = currentRound(room)
    if (!round.changeRequests.includes(playerId)) round.changeRequests.push(playerId)
  })
}

export function confirmPromptChange(code: string, actorId: string): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (actorId !== room.hostId || room.phase !== 'debating') return
    const round = currentRound(room)
    if (round.changeRequests.length === 0) return
    const nextPrompt = promptPreviews.find((prompt) => prompt.intensity === room.intensity && prompt.id !== round.promptId)
    if (!nextPrompt) return
    round.prompt = nextPrompt
    round.promptId = nextPrompt.id
    round.changeRequests = []
    round.debateEndsAt = new Date(Date.now() + DEBATE_SECONDS * 1000).toISOString()
  })
}

export function continueMockGame(code: string, actorId: string, random: Random = Math.random): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (actorId !== room.hostId || room.phase !== 'results') return
    if (room.rounds.length >= 5) { room.phase = 'finished'; return }
    beginRound(room, random)
  })
}

export function rematchMockGame(code: string, actorId: string): MockRoom | null {
  return mutateRoom(code, (room) => {
    if (actorId !== room.hostId || room.phase !== 'finished') return
    room.players.forEach((player) => { player.score = 0; player.activeFromRound = 1 })
    room.rounds = []
    room.lastOddExtraSide = null
    room.phase = 'lobby'
  })
}

export const mockDurations = { debateSeconds: DEBATE_SECONDS, voteSeconds: VOTE_SECONDS }
