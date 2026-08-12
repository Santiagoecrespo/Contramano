export type Intensity = 'tranqui' | 'bardo'
export type PromptStatus = 'active' | 'reserve'
export type GamePhase = 'lobby' | 'debating' | 'voting' | 'results' | 'finished'
export type Side = 'A' | 'B'

export type MockPlayer = { id: string; nickname: string; isHost: boolean; score: number; activeFromRound: number; juryRounds: number }
export type PromptPreview = { id: string; category: string; intensity: Intensity; status: PromptStatus; text: string; sideA: string; sideB: string }
export type MockDeck = { order: string[]; cursor: number; history: string[]; cycle: number }
export type MockVote = { playerId: string; side: Side }
export type MockRound = { number: number; promptId: string; prompt: PromptPreview; jurorIds: string[]; assignments: Record<string, Side>; debateEndsAt: string; voteEndsAt: string | null; votes: MockVote[]; changeRequests: string[]; result: Side | undefined; wasRandomTiebreak: boolean }
export type MockRoom = { code: string; hostId: string; intensity: Intensity; phase: GamePhase; players: MockPlayer[]; rounds: MockRound[]; decks: Record<Intensity, MockDeck>; lastOddExtraSide: Side | null; createdAt: string; expiresAt: string; serverNow?: string }
