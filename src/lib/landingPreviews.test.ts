import { beforeEach, describe, expect, it } from 'vitest'
import { promptsForIntensity } from '../data/prompts'
import { createLocalDuelDeck } from './localDuel'
import { LANDING_PREVIEW_COUNT, LANDING_PREVIEW_STORAGE_KEY, selectLandingPreviews } from './landingPreviews'

beforeEach(() => localStorage.clear())

describe('consignas de muestra de inicio', () => {
  it('elige tres cartas Bardo completas y diferentes', () => {
    const previews = selectLandingPreviews(() => 0.42)

    expect(previews).toHaveLength(LANDING_PREVIEW_COUNT)
    expect(new Set(previews.map((prompt) => prompt.id)).size).toBe(LANDING_PREVIEW_COUNT)
    expect(previews.every((prompt) => (
      prompt.intensity === 'bardo'
      && (prompt.status === 'active' || prompt.status === 'reserve')
      && prompt.text.trim().length > 0
      && prompt.sideA.trim().length > 0
      && prompt.sideB.trim().length > 0
    ))).toBe(true)
  })

  it('baraja en vez de tomar siempre las primeras posiciones del catálogo', () => {
    const previews = selectLandingPreviews(() => 0)
    const firstCatalogIds = promptsForIntensity('bardo').slice(0, LANDING_PREVIEW_COUNT).map((prompt) => prompt.id)

    expect(previews.map((prompt) => prompt.id)).not.toEqual(firstCatalogIds)
  })

  it('mantiene activas y reservas como candidatas de la misma fuente Bardo', () => {
    const previews = Array.from({ length: 32 }, (_, index) => selectLandingPreviews(() => ((index * 29) % 97) / 97, null)).flat()

    expect(previews.some((prompt) => prompt.status === 'active')).toBe(true)
    expect(previews.some((prompt) => prompt.status === 'reserve')).toBe(true)
  })

  it('evita repetir la terna inmediatamente cuando hay alternativas', () => {
    const first = selectLandingPreviews(() => 0.15)
    const second = selectLandingPreviews(() => 0.85)

    expect(second.every((prompt) => !first.some((firstPrompt) => firstPrompt.id === prompt.id))).toBe(true)
    expect(JSON.parse(localStorage.getItem(LANDING_PREVIEW_STORAGE_KEY) ?? '[]')).toEqual(second.map((prompt) => prompt.id))
  })

  it('no modifica los mazos reales de una partida', () => {
    const before = createLocalDuelDeck(() => 0.42).map((prompt) => prompt.id)

    selectLandingPreviews(() => 0.17)

    expect(createLocalDuelDeck(() => 0.42).map((prompt) => prompt.id)).toEqual(before)
  })
})
