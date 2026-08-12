export type Intensity = 'tranqui' | 'bardo'
export type GamePhase = 'lobby' | 'debating' | 'voting' | 'results' | 'finished'
export type Side = 'A' | 'B'

export type MockPlayer = {
  id: string
  nickname: string
  isHost: boolean
  score: number
  activeFromRound: number
}

export type PromptPreview = {
  id: string
  category: string
  intensity: Intensity
  text: string
  sideA: string
  sideB: string
}

export type MockVote = {
  playerId: string
  side: Side
}

export type MockRound = {
  number: number
  promptId: string
  prompt: PromptPreview
  assignments: Record<string, Side>
  debateEndsAt: string
  voteEndsAt: string | null
  votes: MockVote[]
  changeRequests: string[]
  result: Side | null | undefined
}

export type MockRoom = {
  code: string
  hostId: string
  intensity: Intensity
  phase: GamePhase
  players: MockPlayer[]
  rounds: MockRound[]
  lastOddExtraSide: Side | null
  createdAt: string
  expiresAt: string
}

