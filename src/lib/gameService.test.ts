import { beforeEach, describe, expect, it } from 'vitest'
import { createRoom, getRoom, isRealtimeMode, joinRoom, localPlayerId } from './gameService'

describe('game service fallback', () => {
  beforeEach(() => localStorage.clear())

  it('uses the persisted mock adapter when Supabase variables are absent', async () => {
    expect(isRealtimeMode).toBe(false)
    const created = await createRoom('Host', 'tranqui')
    const joined = await joinRoom(created.code, 'Mili')

    expect(localPlayerId(created.code)).toBe(joined.players.find((player) => player.nickname === 'Mili')?.id)
    expect((await getRoom(created.code))?.players).toHaveLength(2)
  })
})
