import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockRoom } from '../types/game'

const service = vi.hoisted(() => ({
  addDemo: vi.fn(), changeIntensity: vi.fn(), closeVoting: vi.fn(), confirmChange: vi.fn(),
  forgetLocalPlayer: vi.fn(), getRoom: vi.fn(), joinRoom: vi.fn(), localPlayerId: vi.fn(),
  nextRound: vi.fn(), openVoting: vi.fn(), prepareRoomVisit: vi.fn(), rematch: vi.fn(),
  requestChange: vi.fn(), roomAccessError: vi.fn(), startGame: vi.fn(), subscribeRoom: vi.fn(), vote: vi.fn(),
}))

vi.mock('../lib/gameService', () => ({ ...service, isRealtimeMode: true }))

import { RoomPage } from './RoomPage'

const room: MockRoom = {
  code: 'ABCD2345', hostId: 'host', intensity: 'tranqui', phase: 'lobby',
  players: [
    { id: 'host', nickname: 'Host', isHost: true, score: 0, activeFromRound: 1, juryRounds: 0 },
    { id: 'guest', nickname: 'Mili', isHost: false, score: 0, activeFromRound: 1, juryRounds: 0 },
  ],
  rounds: [], decks: { tranqui: { order: [], cursor: 0, history: [], cycle: 1 }, bardo: { order: [], cursor: 0, history: [], cycle: 1 } },
  lastOddExtraSide: null, createdAt: '2026-08-12T00:00:00.000Z', expiresAt: '2030-08-13T00:00:00.000Z', serverNow: '2026-08-12T00:00:00.000Z',
}

function debatingRoom(debateEndsAt: string): MockRoom {
  return {
    ...room,
    phase: 'debating',
    players: [
      { id: 'host', nickname: 'Host', isHost: true, score: 0, activeFromRound: 1, juryRounds: 0 },
      { id: 'guest', nickname: 'Mili', isHost: false, score: 0, activeFromRound: 1, juryRounds: 0 },
      { id: 'third', nickname: 'Tomi', isHost: false, score: 0, activeFromRound: 1, juryRounds: 0 },
    ],
    rounds: [{ number: 1, promptId: 'asado-tarde', prompt: { id: 'asado-tarde', category: 'Asado', intensity: 'tranqui', status: 'active', text: 'Consigna de prueba', sideA: 'A favor', sideB: 'En contra' }, jurorIds: ['third'], assignments: { host: 'A', guest: 'B' }, debateEndsAt, voteEndsAt: null, votes: [], changeRequests: [], result: undefined, wasRandomTiebreak: false }],
  }
}

function renderRoom() {
  return render(<MemoryRouter initialEntries={['/sala/ABCD2345']}><Routes><Route path="/sala/:code" element={<RoomPage />} /><Route path="/" element={<p>Inicio</p>} /></Routes></MemoryRouter>)
}

describe('acceso de invitados a una sala realtime', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.clearAllMocks()
    service.localPlayerId.mockReturnValue(null)
    service.prepareRoomVisit.mockResolvedValue(undefined)
    service.roomAccessError.mockImplementation((error: Error) => ({ message: error.message, terminal: /no encontrada|completa|venció|terminó/i.test(error.message) }))
    service.subscribeRoom.mockReturnValue(undefined)
  })

  it('muestra el ingreso de apodo al visitante nuevo sin pedir el snapshot protegido', async () => {
    renderRoom()

    expect(await screen.findByRole('heading', { name: 'Falta saber cómo te llamamos.' })).toBeInTheDocument()
    expect(service.prepareRoomVisit).toHaveBeenCalledTimes(1)
    expect(service.getRoom).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /unirme a la mesa/i })).toBeInTheDocument()
  })

  it('informa si la sala no existe', async () => {
    service.joinRoom.mockRejectedValueOnce(new Error('Sala no encontrada'))
    renderRoom()
    fireEvent.change(await screen.findByLabelText('Tu apodo'), { target: { value: 'Mili' } })
    fireEvent.click(screen.getByRole('button', { name: /unirme a la mesa/i }))

    expect(await screen.findByRole('heading', { name: 'Sala no encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toBeInTheDocument()
  })

  it('informa si la sala está llena', async () => {
    service.joinRoom.mockRejectedValueOnce(new Error('La sala está completa'))
    renderRoom()
    fireEvent.change(await screen.findByLabelText('Tu apodo'), { target: { value: 'Mili' } })
    fireEvent.click(screen.getByRole('button', { name: /unirme a la mesa/i }))

    expect(await screen.findByText(/sala está completa/i)).toBeInTheDocument()
  })

  it('une una sesión distinta y recién entonces suscribe la sala', async () => {
    let joined = false
    service.localPlayerId.mockImplementation(() => joined ? 'guest' : null)
    service.joinRoom.mockImplementation(async () => { joined = true; return room })
    renderRoom()
    fireEvent.change(await screen.findByLabelText('Tu apodo'), { target: { value: 'Mili' } })
    fireEvent.click(screen.getByRole('button', { name: /unirme a la mesa/i }))

    expect(await screen.findByRole('heading', { name: 'La mesa está servida.' })).toBeInTheDocument()
    await waitFor(() => expect(service.subscribeRoom).toHaveBeenCalledWith('ABCD2345', 'guest', expect.any(Function), expect.any(Function)))
    expect(service.getRoom).not.toHaveBeenCalled()
  })

  it('muestra el adelanto sólo al host y abre automáticamente al llegar a cero', async () => {
    const debate = debatingRoom('2020-01-01T00:00:00.000Z')
    const voting = { ...debate, phase: 'voting' as const, rounds: [{ ...debate.rounds[0], voteEndsAt: new Date(Date.now() + 30_000).toISOString() }] }
    service.localPlayerId.mockReturnValue('host')
    service.getRoom.mockResolvedValue(debate)
    service.openVoting.mockResolvedValue(voting)
    renderRoom()

    await waitFor(() => expect(service.openVoting).toHaveBeenCalledWith(debate, 'host'))
  })

  it('no muestra el adelanto a quien no es host', async () => {
    const debate = debatingRoom(new Date(Date.now() + 50_000).toISOString())
    service.localPlayerId.mockReturnValue('guest')
    service.getRoom.mockResolvedValue(debate)
    renderRoom()

    await screen.findByText('Consigna de prueba')
    expect(screen.queryByRole('button', { name: /abrir votación ahora/i })).not.toBeInTheDocument()
  })
})
