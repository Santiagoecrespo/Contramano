import type { Intensity, MockRoom, Side } from '../types/game'
import { isSupabaseConfigured, supabase, ensureAnonymousSession } from './supabase'
import {
  addDemoPlayers, advanceToVoting, castMockVote, closeMockVoting, confirmPromptChange,
  continueMockGame, createMockRoom, getLocalPlayerId, getMockRoom, joinMockRoom,
  heartbeatMockRoom, pauseMockGame, reconcileMockRoom, rematchMockGame, requestPromptChange, resumeMockGame, setMockIntensity, startMockGame,
} from './mockRoom'

const LOCAL_PLAYER_PREFIX = 'contramano:player:'
export const isRealtimeMode = isSupabaseConfigured

export type RoomAccessError = { message: string; terminal: boolean }

function unwrap(snapshot: unknown): MockRoom {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('La sala no devolvió un estado válido.')
  return snapshot as MockRoom
}

function rememberViewer(snapshot: MockRoom): MockRoom {
  const viewerPlayerId = (snapshot as MockRoom & { viewerPlayerId?: string }).viewerPlayerId
  if (viewerPlayerId) localStorage.setItem(`${LOCAL_PLAYER_PREFIX}${snapshot.code}`, viewerPlayerId)
  return snapshot
}

async function rpc(name: string, params: Record<string, unknown>): Promise<MockRoom> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  await ensureAnonymousSession()
  const { data, error } = await supabase.rpc(name, params)
  if (error) {
    if (import.meta.env.DEV) console.error(`[Contramano RPC] ${name}`, error)
    throw new Error(error.message)
  }
  return unwrap(data)
}

export async function prepareRoomVisit(): Promise<void> {
  if (isRealtimeMode) await ensureAnonymousSession()
}

export function roomAccessError(error: unknown): RoomAccessError {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '')
  const normalized = message.toLowerCase()
  if (normalized.includes('no encontrada')) return { message: 'No encontramos esa sala. Revisá el link o el código.', terminal: true }
  if (normalized.includes('vencida')) return { message: 'Esta sala ya venció. Creá otra para seguir jugando.', terminal: true }
  if (normalized.includes('completa')) return { message: 'La sala está completa: ya hay 8 personas.', terminal: true }
  if (normalized.includes('terminó') || normalized.includes('termino')) return { message: 'Esta partida ya terminó y no admite más participantes.', terminal: true }
  if (normalized.includes('cancelada')) return { message: 'Esta mesa fue cancelada por el anfitrión.', terminal: true }
  if (normalized.includes('duplicate') || normalized.includes('ya existe')) return { message: 'Ese apodo ya está en uso en esta sala. Elegí otro.', terminal: false }
  return { message: 'No pudimos entrar a la sala. Probá de nuevo.', terminal: false }
}

export async function createRoom(nickname: string, intensity: Intensity): Promise<MockRoom> {
  if (!isRealtimeMode) return createMockRoom(nickname, intensity)
  const room = rememberViewer(await rpc('create_room', { p_nickname: nickname, p_intensity: intensity }))
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
  const room = rememberViewer(await rpc('join_room', { p_code: code, p_nickname: nickname }))
  const viewerPlayerId = (room as MockRoom & { viewerPlayerId?: string }).viewerPlayerId
  const player = room.players.find((candidate) => candidate.id === viewerPlayerId || candidate.nickname.toLowerCase() === nickname.toLowerCase())
  if (!player) throw new Error('No pudimos confirmar tu ingreso a la sala.')
  localStorage.setItem(`${LOCAL_PLAYER_PREFIX}${room.code}`, player.id)
  return room
}

export async function getRoom(code: string): Promise<MockRoom | null> {
  if (!isRealtimeMode) return getMockRoom(code)
  return rpc('get_room_snapshot', { p_code: code })
}

export async function resumeRoomMember(code: string): Promise<MockRoom> {
  if (!isRealtimeMode) {
    const room = getMockRoom(code)
    if (!room) throw new Error('Sala no encontrada')
    return room
  }
  return rememberViewer(await rpc('resume_room_member', { p_room_id: code }))
}

export async function heartbeat(code: string, playerId: string): Promise<MockRoom> {
  if (!isRealtimeMode) return heartbeatMockRoom(code, playerId) ?? (() => { throw new Error('Sala no encontrada') })()
  return rememberViewer(await rpc('heartbeat', { p_room_id: code }))
}

export async function reconcileRoom(code: string): Promise<MockRoom> {
  if (!isRealtimeMode) return reconcileMockRoom(code) ?? (() => { throw new Error('Sala no encontrada') })()
  return rememberViewer(await rpc('reconcile_room', { p_room_id: code }))
}

export function localPlayerId(code: string): string | null { return getLocalPlayerId(code) }
export function forgetLocalPlayer(code: string): void { localStorage.removeItem(`${LOCAL_PLAYER_PREFIX}${code.toUpperCase()}`) }
export async function startGame(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('start_game', { p_room_id: room.code }) : startMockGame(room.code, actorId)! }
export async function openVoting(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('advance_to_voting', { p_room_id: room.code }) : advanceToVoting(room.code, actorId)! }
export async function vote(room: MockRoom, actorId: string, side: Side): Promise<MockRoom> { return isRealtimeMode ? rpc('cast_vote', { p_room_id: room.code, p_side: side }) : castMockVote(room.code, actorId, side)! }
export async function closeVoting(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('close_voting', { p_room_id: room.code }) : closeMockVoting(room.code, actorId)! }
export async function requestChange(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('request_prompt_change', { p_room_id: room.code }) : requestPromptChange(room.code, actorId)! }
export async function confirmChange(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('confirm_prompt_change', { p_room_id: room.code }) : confirmPromptChange(room.code, actorId)! }
export async function nextRound(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('start_round', { p_room_id: room.code }) : continueMockGame(room.code, actorId)! }
export async function rematch(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rememberViewer(await rpc('rematch', { p_room_id: room.code })) : rematchMockGame(room.code, actorId)! }
export async function changeIntensity(room: MockRoom, actorId: string, intensity: Intensity): Promise<MockRoom> { return isRealtimeMode ? rpc('set_intensity', { p_room_id: room.code, p_intensity: intensity }) : setMockIntensity(room.code, actorId, intensity)! }
export async function addDemo(room: MockRoom): Promise<MockRoom> { return addDemoPlayers(room.code)! }
export async function pause(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('pause_game', { p_room_id: room.code }) : pauseMockGame(room.code, actorId)! }
export async function resume(room: MockRoom, actorId: string): Promise<MockRoom> { return isRealtimeMode ? rpc('resume_game', { p_room_id: room.code }) : resumeMockGame(room.code, actorId)! }

export function subscribeRoom(code: string, playerId: string | null, onChanged: () => void, onPresence?: (playerIds: string[]) => void, onConnection?: (state: 'connected' | 'reconnecting') => void): (() => void) | undefined {
  if (!supabase) return undefined
  const client = supabase
  const channel = client.channel(`room:${code}`, { config: { private: true } })
    .on('broadcast', { event: 'room_changed' }, onChanged)
    .on('presence', { event: 'sync' }, () => {
      const ids = Object.values(channel.presenceState()).flatMap((entries) => entries.map((entry) => String((entry as { playerId?: string }).playerId ?? ''))).filter(Boolean)
      onPresence?.(ids)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') { onConnection?.('connected'); if (playerId) void channel.track({ playerId }) }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onConnection?.('reconnecting')
    })
  return () => { void client.removeChannel(channel) }
}
