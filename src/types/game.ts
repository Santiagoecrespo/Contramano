export type Intensity = 'tranqui' | 'bardo'

export type MockPlayer = {
  id: string
  nickname: string
  isHost: boolean
}

export type MockRoom = {
  code: string
  hostId: string
  intensity: Intensity
  players: MockPlayer[]
  createdAt: string
  expiresAt: string
}

export type PromptPreview = {
  category: string
  intensity: Intensity
  text: string
  sideA: string
  sideB: string
}

