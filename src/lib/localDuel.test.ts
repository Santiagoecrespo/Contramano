import { describe, expect, it } from 'vitest'
import { createLocalDuelDeck, LOCAL_DUEL_ROUND_COUNT, summarizeLocalDuel } from './localDuel'
import type { LocalDuelRound } from './localDuel'

describe('Cara a cara local', () => {
  it('arma cinco cartas activas, existentes y sin repetir', () => {
    const deck = createLocalDuelDeck(() => 0.42)

    expect(deck).toHaveLength(LOCAL_DUEL_ROUND_COUNT)
    expect(new Set(deck.map((prompt) => prompt.id)).size).toBe(LOCAL_DUEL_ROUND_COUNT)
    expect(deck.every((prompt) => prompt.intensity === 'tranqui' && prompt.status === 'active')).toBe(true)
  })

  it('calcula coincidencias, contramanos y la primera carta que dividió', () => {
    const deck = createLocalDuelDeck(() => 0.17)
    const rounds: LocalDuelRound[] = [
      { prompt: deck[0], playerOneChoice: 'A', playerTwoChoice: 'A' },
      { prompt: deck[1], playerOneChoice: 'A', playerTwoChoice: 'B' },
      { prompt: deck[2], playerOneChoice: 'B', playerTwoChoice: 'B' },
      { prompt: deck[3], playerOneChoice: 'B', playerTwoChoice: 'A' },
      { prompt: deck[4], playerOneChoice: 'A', playerTwoChoice: 'A' },
    ]

    expect(summarizeLocalDuel(rounds)).toEqual({
      totalRounds: 5,
      matches: 3,
      differences: 2,
      agreementPercentage: 60,
      firstDividingPrompt: deck[1],
    })
  })

  it('no inventa un tema divisor cuando todas las elecciones coinciden', () => {
    const [prompt] = createLocalDuelDeck()
    const summary = summarizeLocalDuel([{ prompt, playerOneChoice: 'A', playerTwoChoice: 'A' }])

    expect(summary).toMatchObject({ matches: 1, differences: 0, agreementPercentage: 100 })
    expect(summary.firstDividingPrompt).toBeUndefined()
  })
})
