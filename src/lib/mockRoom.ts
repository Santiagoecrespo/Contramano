import { generateRoomCode } from './roomCode'
import type { Intensity, MockPlayer, MockRoom } from '../types/game'

const STORAGE_PREFIX = 'contramano:room:'

function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function saveMockRoom(room: MockRoom): void {
  localStorage.setItem(`${STORAGE_PREFIX}${room.code}`, JSON.stringify(room))
}

export function getMockRoom(code: string): MockRoom | null {
  const saved = localStorage.getItem(`${STORAGE_PREFIX}${code.toUpperCase()}`)
  return saved ? (JSON.parse(saved) as MockRoom) : null
}

export function createMockRoom(nickname: string, intensity: Intensity): MockRoom {
  let code = generateRoomCode()
  while (getMockRoom(code)) code = generateRoomCode()
  const host: MockPlayer = { id: id(), nickname, isHost: true }
  const now = new Date()
  const room: MockRoom = {
    code,
    hostId: host.id,
    intensity,
    players: [host],
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  }
  saveMockRoom(room)
  return room
}

export function joinMockRoom(code: string, nickname: string): MockRoom | null {
  const room = getMockRoom(code)
  if (!room) return null
  if (!room.players.some((player) => player.nickname.toLowerCase() === nickname.toLowerCase())) {
    room.players.push({ id: id(), nickname, isHost: false })
    saveMockRoom(room)
  }
  return room
}

export function addDemoPlayers(code: string): MockRoom | null {
  const room = getMockRoom(code)
  if (!room) return null
  ;['Mili', 'Tomi', 'Sofi'].forEach((nickname) => {
    if (!room.players.some((player) => player.nickname === nickname)) {
      room.players.push({ id: id(), nickname, isHost: false })
    }
  })
  saveMockRoom(room)
  return room
}

