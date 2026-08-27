import { describe, expect, it } from 'vitest'
import { bardoV3Prompts } from '../data/bardoV3'
import { createLocalDuelDeck, LOCAL_DUEL_ROUND_COUNT, summarizeLocalDuel } from './localDuel'
import type { LocalDuelRound } from './localDuel'

describe('Cara a cara local', () => {
  it('arma cinco cartas Bardo completas, existentes y sin repetir', () => {
    const deck = createLocalDuelDeck(() => 0.42)

    expect(deck).toHaveLength(LOCAL_DUEL_ROUND_COUNT)
    expect(new Set(deck.map((prompt) => prompt.id)).size).toBe(LOCAL_DUEL_ROUND_COUNT)
    expect(new Set(deck.map((prompt) => prompt.text)).size).toBe(LOCAL_DUEL_ROUND_COUNT)
    expect(deck.every((prompt) => (
      prompt.intensity === 'bardo'
      && (prompt.status === 'active' || prompt.status === 'reserve')
      && prompt.text.trim().length > 0
      && prompt.sideA.trim().length > 0
      && prompt.sideB.trim().length > 0
    ))).toBe(true)
  })

  it('arma cinco categorías Bardo diferentes cuando el catálogo las tiene disponibles', () => {
    const deck = createLocalDuelDeck(() => 0.42)

    expect(new Set(deck.map((prompt) => prompt.category)).size).toBe(LOCAL_DUEL_ROUND_COUNT)
  })

  it('permite que aparezcan cartas activas y de reserva sin incluir archivadas', () => {
    const decks = Array.from({ length: 32 }, (_, index) => createLocalDuelDeck(() => ((index * 37) % 101) / 101))
    const selected = decks.flat()

    expect(selected.some((prompt) => prompt.status === 'active')).toBe(true)
    expect(selected.some((prompt) => prompt.status === 'reserve')).toBe(true)
    expect(selected.every((prompt) => prompt.status !== 'archived')).toBe(true)
  })

  it('no altera el catálogo Bardo original al armar una partida', () => {
    const catalogBefore = bardoV3Prompts.map((prompt) => ({ ...prompt }))

    createLocalDuelDeck(() => 0.42)

    expect(bardoV3Prompts).toEqual(catalogBefore)
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
