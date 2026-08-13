import { beforeEach, describe, expect, it } from 'vitest'
import { advanceToVoting, assignPostures, castMockVote, closeMockVoting, confirmPromptChange, continueMockGame, createMockRoom, getMockRoom, joinMockRoom, jurorCountFor, rematchMockGame, requestPromptChange, saveMockRoom, selectJurors, setMockIntensity, startMockGame } from './mockRoom'
import type { MockPlayer } from '../types/game'

const lowRandom = () => 0
const highRandom = () => 0.99
const players = (count: number): MockPlayer[] => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, nickname: `P${index + 1}`, isHost: index === 0, score: 0, activeFromRound: 1, juryRounds: 0 }))

beforeEach(() => localStorage.clear())

describe('jurado y equipos', () => {
  it.each([[3, 1], [4, 1], [5, 1], [6, 2], [7, 2], [8, 2]])('elige %i jugadores con %i jurado(s)', (playerCount, jurors) => {
    expect(jurorCountFor(playerCount)).toBe(jurors)
    expect(selectJurors(players(playerCount), [], lowRandom)).toHaveLength(jurors)
  })

  it('excluye jurados y balancea equipos pares e impares', () => {
    const six = selectJurors(players(6), [], lowRandom)
    const sixTeams = assignPostures(players(6).filter((player) => !six.some((juror) => juror.id === player.id)), {}, null, lowRandom)
    expect(Object.values(sixTeams.assignments)).toHaveLength(4)
    expect(Object.values(sixTeams.assignments).filter((side) => side === 'A')).toHaveLength(2)
    const five = selectJurors(players(5), [], lowRandom)
    const fiveTeams = assignPostures(players(5).filter((player) => !five.some((juror) => juror.id === player.id)), {}, null, lowRandom)
    expect(Object.values(fiveTeams.assignments).filter((side) => side === 'A')).toHaveLength(2)
    expect(Object.values(fiveTeams.assignments).filter((side) => side === 'B')).toHaveLength(2)
  })

  it('alterna el extra cuando los debatientes son impares y no cambia el registro cuando son pares', () => {
    const first = assignPostures(players(3), {}, null, lowRandom)
    const second = assignPostures(players(3), first.assignments, first.lastOddExtraSide, lowRandom)
    const even = assignPostures(players(4), second.assignments, second.lastOddExtraSide, lowRandom)
    expect(first.lastOddExtraSide).toBe('A'); expect(second.lastOddExtraSide).toBe('B'); expect(even.lastOddExtraSide).toBe('B')
  })

  it('minimiza postura repetida y jurado consecutivo cuando existen alternativas', () => {
    const previous = { p1: 'A', p2: 'A', p3: 'B', p4: 'B' } as const
    expect(assignPostures(players(4), previous, null, lowRandom).assignments).toEqual({ p1: 'B', p2: 'B', p3: 'A', p4: 'A' })
    const roster = players(5); roster[0].juryRounds = 1
    const jurors = selectJurors(roster, ['p1'], lowRandom)
    expect(jurors[0].id).not.toBe('p1')
  })
})

describe('flujo local con jurado', () => {
  function roomWith(count: number) {
    const room = createMockRoom('Host', 'tranqui')
    Array.from({ length: count - 1 }, (_, index) => `P${index + 2}`).forEach((nickname) => joinMockRoom(room.code, nickname))
    return startMockGame(room.code, room.hostId, lowRandom)!
  }

  function assertRoundShape(room: NonNullable<ReturnType<typeof getMockRoom>>, playerCount: number) {
    const round = room.rounds.at(-1)!
    const jurors = room.players.filter((player) => round.jurorIds.includes(player.id))
    const debaterIds = Object.keys(round.assignments)
    const sideA = debaterIds.filter((id) => round.assignments[id] === 'A')
    const sideB = debaterIds.filter((id) => round.assignments[id] === 'B')
    expect(jurors).toHaveLength(playerCount >= 6 ? 2 : 1)
    expect(new Set([...round.jurorIds, ...debaterIds]).size).toBe(playerCount)
    expect([...round.jurorIds, ...debaterIds]).toHaveLength(playerCount)
    expect(jurors.every((player) => round.assignments[player.id] === undefined)).toBe(true)
    expect(debaterIds.every((id) => !round.jurorIds.includes(id) && ['A', 'B'].includes(round.assignments[id]))).toBe(true)
    expect(Math.abs(sideA.length - sideB.length)).toBeLessThanOrEqual(1)
  }

  function finishRound(room: NonNullable<ReturnType<typeof getMockRoom>>) {
    const voting = advanceToVoting(room.code, room.hostId)!
    voting.rounds.at(-1)!.jurorIds.forEach((jurorId) => castMockVote(room.code, jurorId, 'A', lowRandom))
    return getMockRoom(room.code)!
  }

  it.each([3, 4, 5, 6, 7, 8])('inicia y crea una ronda válida para %i jugadores', (playerCount) => {
    const room = roomWith(playerCount)
    assertRoundShape(room, playerCount)
    expect(room.phase).toBe('debating')
  })

  it('impide entrar cuando la sala tiene ocho jugadores', () => {
    const room = roomWith(8)
    const full = joinMockRoom(room.code, 'Novena')!
    expect(full.players).toHaveLength(8)
    expect(full.players.some((player) => player.nickname === 'Novena')).toBe(false)
  })

  it('sólo permite votar a jurados y cierra al recibir todos los votos', () => {
    const room = roomWith(6)
    const voting = advanceToVoting(room.code, room.hostId)!
    const debaterId = Object.keys(voting.rounds[0].assignments)[0]
    castMockVote(room.code, debaterId, 'A')
    expect(getMockRoom(room.code)!.rounds[0].votes).toHaveLength(0)
    const jurors = voting.rounds[0].jurorIds
    castMockVote(room.code, jurors[0], 'A')
    castMockVote(room.code, jurors[0], 'B')
    expect(getMockRoom(room.code)!.rounds[0].votes).toHaveLength(1)
    castMockVote(room.code, jurors[1], 'A')
    const result = getMockRoom(room.code)!
    expect(result.phase).toBe('results')
    expect(result.rounds[0].result).toBe('A')
    expect(result.players.filter((player) => result.rounds[0].assignments[player.id] === 'A').every((player) => player.score === 1)).toBe(true)
    expect(result.players.filter((player) => result.rounds[0].jurorIds.includes(player.id)).every((player) => player.score === 0)).toBe(true)
  })

  it.each([3, 5, 6, 8])('completa cinco rondas con %i jugadores sin repetir jurado cuando hay alternativa', (playerCount) => {
    let room = roomWith(playerCount)
    const jurorHistory: string[][] = [room.rounds[0].jurorIds]
    for (let roundNumber = 1; roundNumber <= 5; roundNumber += 1) {
      expect(room.phase).toBe('debating')
      assertRoundShape(room, playerCount)
      room = finishRound(room)
      expect(room.phase).toBe('results')
      if (roundNumber < 5) {
        room = continueMockGame(room.code, room.hostId, lowRandom)!
        jurorHistory.push(room.rounds.at(-1)!.jurorIds)
      }
    }
    expect(room.phase).toBe('results')
    const finished = continueMockGame(room.code, room.hostId, lowRandom)!
    expect(finished.phase).toBe('finished')
    jurorHistory.slice(1).forEach((jurors, index) => {
      if (playerCount > jurors.length) expect(jurors.some((id) => !jurorHistory[index].includes(id))).toBe(true)
    })
  })

  it('resuelve empate de jurados con desempate aleatorio informado', () => {
    const room = roomWith(6)
    const voting = advanceToVoting(room.code, room.hostId)!
    castMockVote(room.code, voting.rounds[0].jurorIds[0], 'A', highRandom)
    const result = castMockVote(room.code, voting.rounds[0].jurorIds[1], 'B', highRandom)!
    expect(result.rounds[0].wasRandomTiebreak).toBe(true)
    expect(result.rounds[0].result).toBe('B')
  })

  it('incorpora tarde a alguien en la ronda siguiente y rota jurados', () => {
    const room = roomWith(4)
    const firstJuror = room.rounds[0].jurorIds[0]
    joinMockRoom(room.code, 'Tarde')
    const voting = advanceToVoting(room.code, room.hostId)!
    castMockVote(room.code, voting.rounds[0].jurorIds[0], 'A')
    const next = continueMockGame(room.code, room.hostId, lowRandom)!
    expect(next.rounds[1].jurorIds).not.toContain(firstJuror)
    expect(next.rounds[1].jurorIds.some((id) => next.players.find((player) => player.nickname === 'Tarde')?.id === id || Boolean(next.rounds[1].assignments[next.players.find((player) => player.nickname === 'Tarde')?.id ?? '']))).toBe(true)
  })

  it('registra solicitud de cambio de cualquier rol y sólo el host puede confirmarla', () => {
    const room = roomWith(4)
    const jurorId = room.rounds[0].jurorIds[0]
    const original = room.rounds[0].promptId
    requestPromptChange(room.code, jurorId)
    expect(confirmPromptChange(room.code, jurorId)!.rounds[0].promptId).toBe(original)
    const confirmed = confirmPromptChange(room.code, room.hostId)!
    expect(confirmed.rounds[0].promptId).not.toBe(original)
    expect(confirmed.rounds[0].changeRequests).toHaveLength(0)
  })

  it('cambia intensidad entre rondas y activa al jugador tardío sólo en la siguiente', () => {
    const room = roomWith(3)
    const late = joinMockRoom(room.code, 'Tarde')!
    const latePlayer = late.players.find((player) => player.nickname === 'Tarde')!
    expect(latePlayer.activeFromRound).toBe(2)
    expect(late.rounds[0].jurorIds.includes(latePlayer.id) || late.rounds[0].assignments[latePlayer.id]).toBeFalsy()
    const result = finishRound(late)
    setMockIntensity(result.code, result.hostId, 'bardo')
    const next = continueMockGame(result.code, result.hostId, lowRandom)!
    expect(next.intensity).toBe('bardo')
    expect(next.rounds[1].jurorIds.includes(latePlayer.id) || next.rounds[1].assignments[latePlayer.id]).toBeTruthy()
  })

  it('permite al host cerrar votación incompleta y reinicia jurados y puntajes en revancha', () => {
    const room = roomWith(6)
    advanceToVoting(room.code, room.hostId)
    const closed = closeMockVoting(room.code, room.hostId, lowRandom)!
    closed.phase = 'finished'; closed.players[0].score = 3; saveMockRoom(closed)
    const rematch = rematchMockGame(room.code, room.hostId)!
    expect(rematch.phase).toBe('lobby'); expect(rematch.rounds).toHaveLength(0)
    expect(rematch.players.every((player) => player.score === 0 && player.juryRounds === 0)).toBe(true)
  })
})
