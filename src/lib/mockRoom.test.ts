import { beforeEach, describe, expect, it } from 'vitest'
import { assignPostures, castMockVote, confirmPromptChange, continueMockGame, createMockRoom, getMockRoom, joinMockRoom, rematchMockGame, requestPromptChange, saveMockRoom, startMockGame, advanceToVoting } from './mockRoom'
import type { MockPlayer } from '../types/game'

const random = () => 0
const players = (count: number): MockPlayer[] => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, nickname: `P${index + 1}`, isHost: index === 0, score: 0, activeFromRound: 1 }))

beforeEach(() => localStorage.clear())

describe('assignPostures', () => {
  it('creates equal teams for an even number of players', () => {
    const result = assignPostures(players(4), {}, null, random)
    expect(Object.values(result.assignments).filter((side) => side === 'A')).toHaveLength(2)
    expect(Object.values(result.assignments).filter((side) => side === 'B')).toHaveLength(2)
  })

  it('alternates the extra side across odd rounds and preserves it in an even round', () => {
    const first = assignPostures(players(3), {}, null, random)
    const second = assignPostures(players(3), first.assignments, first.lastOddExtraSide, random)
    const even = assignPostures(players(4), second.assignments, second.lastOddExtraSide, random)
    expect(Object.values(first.assignments).filter((side) => side === 'A')).toHaveLength(2)
    expect(Object.values(first.assignments).filter((side) => side === 'B')).toHaveLength(1)
    expect(first.lastOddExtraSide).toBe('A')
    expect(second.lastOddExtraSide).toBe('B')
    expect(even.lastOddExtraSide).toBe('B')
  })

  it('minimizes consecutive sides whenever balanced slots allow it', () => {
    const previous = { p1: 'A', p2: 'A', p3: 'B', p4: 'B' } as const
    const result = assignPostures(players(4), previous, null, random)
    expect(result.assignments).toEqual({ p1: 'B', p2: 'B', p3: 'A', p4: 'A' })
  })
})

describe('local game flow', () => {
  function readyRoom() {
    const room = createMockRoom('Host', 'tranqui')
    joinMockRoom(room.code, 'Mili')
    joinMockRoom(room.code, 'Tomi')
    return startMockGame(room.code, room.hostId, random)!
  }

  it('activates a late player only in the next round', () => {
    const room = readyRoom()
    joinMockRoom(room.code, 'Lolo')
    const joined = getMockRoom(room.code)!
    expect(joined.players.find((player) => player.nickname === 'Lolo')?.activeFromRound).toBe(2)
    const voting = advanceToVoting(room.code, room.hostId)!
    Object.keys(voting.rounds[0].assignments).forEach((playerId) => castMockVote(room.code, playerId, 'A'))
    const next = continueMockGame(room.code, room.hostId, random)!
    expect(next.rounds[1].assignments[next.players.find((player) => player.nickname === 'Lolo')!.id]).toBeDefined()
  })

  it('only records one vote per player and automatically closes when everyone voted', () => {
    const room = readyRoom()
    const voting = advanceToVoting(room.code, room.hostId)!
    const ids = Object.keys(voting.rounds[0].assignments)
    const firstVote = castMockVote(room.code, ids[0], 'A')!
    const duplicateVote = castMockVote(room.code, ids[0], 'B')!
    expect(duplicateVote.rounds[0].votes).toHaveLength(1)
    expect(duplicateVote.rounds[0].votes[0].side).toBe('A')
    ids.slice(1).forEach((playerId) => castMockVote(room.code, playerId, 'B'))
    const result = getMockRoom(room.code)!
    expect(firstVote.phase).toBe('voting')
    expect(result.phase).toBe('results')
  })

  it('returns a tie without awarding points', () => {
    const room = createMockRoom('Host', 'tranqui')
    joinMockRoom(room.code, 'Mili'); joinMockRoom(room.code, 'Tomi'); joinMockRoom(room.code, 'Sofi')
    const started = startMockGame(room.code, room.hostId, random)!
    const voting = advanceToVoting(room.code, room.hostId)!
    const ids = Object.keys(voting.rounds[0].assignments)
    castMockVote(room.code, ids[0], 'A'); castMockVote(room.code, ids[1], 'A'); castMockVote(room.code, ids[2], 'B'); const result = castMockVote(room.code, ids[3], 'B')!
    expect(result.rounds[0].result).toBeNull()
    expect(result.players.every((player) => player.score === 0)).toBe(true)
    expect(started.phase).toBe('debating')
  })

  it('records a request and lets only the host confirm a prompt change', () => {
    const room = readyRoom()
    const playerId = room.players.find((player) => !player.isHost)!.id
    const requested = requestPromptChange(room.code, playerId)!
    const originalPrompt = requested.rounds[0].promptId
    const denied = confirmPromptChange(room.code, playerId)!
    expect(denied.rounds[0].promptId).toBe(originalPrompt)
    const confirmed = confirmPromptChange(room.code, room.hostId)!
    expect(confirmed.rounds[0].promptId).not.toBe(originalPrompt)
    expect(confirmed.rounds[0].changeRequests).toHaveLength(0)
  })

  it('resets a finished room for a rematch', () => {
    const room = readyRoom()
    room.phase = 'finished'; room.players[0].score = 4; room.lastOddExtraSide = 'A'; saveMockRoom(room)
    const rematch = rematchMockGame(room.code, room.hostId)!
    expect(rematch.phase).toBe('lobby')
    expect(rematch.rounds).toHaveLength(0)
    expect(rematch.lastOddExtraSide).toBeNull()
    expect(rematch.players.every((player) => player.score === 0 && player.activeFromRound === 1)).toBe(true)
  })
})
