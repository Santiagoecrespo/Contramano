import type { Intensity, MockRoom, Side } from '../types/game'
import { isSupabaseConfigured, supabase, ensureAnonymousSession } from './supabase'
import {
  addDemoPlayers, advanceToVoting, castMockVote, closeMockVoting, confirmPromptChange,
  continueMockGame, createMockRoom, getLocalPlayerId, getMockRoom, joinMockRoom,
  rematchMockGame, requestPromptChange, setMockIntensity, startMockGame,
} from './mockRoom'

const LOCAL_PLAYER_PREFIX = 'contramano:player:'
export const isRealtimeMode = isSupabaseConfigured

function unwrap(snapshot: unknown): MockRoom {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('La sala no devolvió un estado válido.')
  return snapshot as MockRoom
}

async function rpc(name: string, params: Record<string, unknown>): Promise<MockRoom> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  await ensureAnonymousSession()
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return unwrap(data)
}

export async function createRoom(nickname: string, intensity: Intensity): Promise<MockRoom> {
  if (!isRealtimeMode) return createMockRoom(nickname, intensity)
  const room = await rpc('create_room', { p_nickname: nickname, p_intensity: intensity })
  const player = room.players.find((candidate) => candidate.isHost)
  if (player) localStorage.setItem(`${LOCAL_PLAYER_PREFIX}${room.code}`, player.id)
  return room
}

export async function joinRoom(code: string, nickname: string): Promise<MockRoom> {
  if (!isRealtimeMode) {
    const room = joinMockRoom(code, nickname)
    if (!room) throw new Error('Sala no encontrada o completa.')
    return room
  }
  const room = await rpc('join_room', { p_code: code, p_nickname: nickname })
  const viewerPlayerId = (room as MockRoom & { viewerPlayerId?: string }).viewerPlayerId
  const player = room.players.find((candidate) => candidate.id === viewerPlayerId || candidate.nickname.toLowerCase() === nickname.toLowerCase())
  if (player) localStorage.setItem(`${LOCAL_PLAYER_PREFIX}${room.code}`, player.id)
  return room
}

export async function getRoom(code: string): Promise<MockRoom | null> {
  if (!isRealtimeMode) return getMockRoom(code)
  try { return await rpc('get_room_snapshot', { p_code: code }) } catch { return null }
}

export function localPlayerId(code: string): string | null { return getLocalPlayerId(code) }
export async function startGame(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('start_game', { p_room_id: room.code }) : startMockGame(room.code, actorId)! }
export async function openVoting(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('advance_to_voting', { p_room_id: room.code }) : advanceToVoting(room.code, actorId)! }
export async function vote(room: MockRoom, actorId: string, side: Side): Promise<MockRoom> { return isRealtimeMode ? rpc('cast_vote', { p_room_id: room.code, p_side: side }) : castMockVote(room.code, actorId, side)! }
export async function closeVoting(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('close_voting', { p_room_id: room.code }) : closeMockVoting(room.code, actorId)! }
export async function requestChange(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('request_prompt_change', { p_room_id: room.code }) : requestPromptChange(room.code, actorId)! }
export async function confirmChange(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('confirm_prompt_change', { p_room_id: room.code }) : confirmPromptChange(room.code, actorId)! }
export async function nextRound(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('start_round', { p_room_id: room.code }) : continueMockGame(room.code, actorId)! }
export async function rematch(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('rematch', { p_room_id: room.code }) : rematchMockGame(room.code, actorId)! }
export async function changeIntensity(room: MockRoom, actorId: string, intensity: Intensity): Promise<MockRoom> { return isRealtimeMode ? rpc('set_intensity', { p_room_id: room.code, p_intensity: intensity }) : setMockIntensity(room.code, actorId, intensity)! }
export async function addDemo(room: MockRoom): Promise<MockRoom> { return addDemoPlayers(room.code)! }

export function subscribeRoom(code: string, playerId: string | null, onChanged: () => void, onPresence?: (playerIds: string[]) => void): (() => void) | undefined {
  if (!supabase) return undefined
  const client = supabase
  const channel = client.channel(`room:${code}`, { config: { private: true } })
    .on('broadcast', { event: 'room_changed' }, onChanged)
    .on('presence', { event: 'sync' }, () => {
      const ids = Object.values(channel.presenceState()).flatMap((entries) => entries.map((entry) => String((entry as { playerId?: string }).playerId ?? ''))).filter(Boolean)
      onPresence?.(ids)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && playerId) void channel.track({ playerId })
    })
  return () => { void client.removeChannel(channel) }
}
