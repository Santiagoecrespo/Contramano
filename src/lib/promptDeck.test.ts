import { beforeEach, describe, expect, it } from 'vitest'
import { advanceToVoting, castMockVote, confirmPromptChange, continueMockGame, createMockRoom, getMockRoom, joinMockRoom, rematchMockGame, requestPromptChange, saveMockRoom, setMockIntensity, startMockGame } from './mockRoom'

const random = () => 0
beforeEach(() => localStorage.clear())

function roomWithPlayers() {
  const room = createMockRoom('Host', 'tranqui')
  joinMockRoom(room.code, 'Mili'); joinMockRoom(room.code, 'Tomi'); joinMockRoom(room.code, 'Sofi')
  return room
}

function finishRound(code: string, hostId: string) {
  const voting = advanceToVoting(code, hostId)!
  voting.rounds.at(-1)!.jurorIds.forEach((jurorId) => castMockVote(code, jurorId, 'A', random))
  return continueMockGame(code, hostId, random)!
}

describe('mazo local persistente', () => {
  it('sirve cinco rondas distintas sin categorías consecutivas cuando hay alternativas', () => {
    const room = roomWithPlayers(); startMockGame(room.code, room.hostId, random)
    for (let index = 0; index < 4; index += 1) finishRound(room.code, room.hostId)
    const rounds = getMockRoom(room.code)!.rounds
    expect(new Set(rounds.map((round) => round.promptId)).size).toBe(5)
    rounds.slice(1).forEach((round, index) => expect(round.prompt.category).not.toBe(rounds[index].prompt.category))
  })

  it('mantiene el mazo al pedir revancha y sigue con las próximas cinco consignas', () => {
    const room = roomWithPlayers(); startMockGame(room.code, room.hostId, random)
    for (let index = 0; index < 4; index += 1) finishRound(room.code, room.hostId)
    const finished = finishRound(room.code, room.hostId); const firstFive = finished.rounds.map((round) => round.promptId)
    const replay = rematchMockGame(room.code, room.hostId)!; startMockGame(replay.code, replay.hostId, random)
    for (let index = 0; index < 4; index += 1) finishRound(replay.code, replay.hostId)
    const nextFive = getMockRoom(room.code)!.rounds.map((round) => round.promptId)
    expect(nextFive.every((id) => !firstFive.includes(id))).toBe(true)
  })

  it('consume una consigna saltada y no la muestra inmediatamente', () => {
    const room = roomWithPlayers(); const started = startMockGame(room.code, room.hostId, random)!
    const skipped = started.rounds[0].promptId
    requestPromptChange(room.code, started.rounds[0].jurorIds[0])
    const changed = confirmPromptChange(room.code, room.hostId, random)!
    expect(changed.rounds[0].promptId).not.toBe(skipped)
    expect(changed.decks.tranqui.history).toEqual([skipped, changed.rounds[0].promptId])
  })

  it('mantiene ambos mazos separados al cambiar intensidad', () => {
    const room = roomWithPlayers(); const started = startMockGame(room.code, room.hostId, random)!
    const tranquiCursor = started.decks.tranqui.cursor
    advanceToVoting(room.code, room.hostId); getMockRoom(room.code)!.rounds[0].jurorIds.forEach((id) => castMockVote(room.code, id, 'A', random))
    setMockIntensity(room.code, room.hostId, 'bardo'); const next = continueMockGame(room.code, room.hostId, random)!
    expect(next.rounds[1].prompt.intensity).toBe('bardo')
    expect(next.decks.tranqui.cursor).toBe(tranquiCursor)
    expect(next.decks.bardo.cursor).toBe(1)
  })

  it('restaura el cursor, orden e historial desde localStorage', () => {
    const room = roomWithPlayers(); const started = startMockGame(room.code, room.hostId, random)!
    const snapshot = structuredClone(started.decks.tranqui); saveMockRoom(started)
    const restored = getMockRoom(room.code)!
    expect(restored.decks.tranqui).toEqual(snapshot)
  })

  it('remezcla al agotar el mazo y protege las últimas cinco en el nuevo ciclo', () => {
    const original = roomWithPlayers(); const room = getMockRoom(original.code)!; room.decks.tranqui.cursor = room.decks.tranqui.order.length; room.decks.tranqui.history = room.decks.tranqui.order.slice(-5); saveMockRoom(room)
    const started = startMockGame(room.code, room.hostId, random)!
    expect(started.decks.tranqui.cycle).toBe(2)
    expect(started.decks.tranqui.history.slice(-1)[0]).not.toBe(room.decks.tranqui.history[0])
    expect(started.decks.tranqui.order.slice(0, 10).every((id) => !room.decks.tranqui.history.includes(id))).toBe(true)
  })
})
