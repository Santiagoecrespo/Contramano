import { promptsForIntensity } from '../data/prompts'
import type { PromptPreview, Side } from '../types/game'

export const LOCAL_DUEL_ROUND_COUNT = 5

export type LocalDuelRound = {
  prompt: PromptPreview
  playerOneChoice: Side
  playerTwoChoice: Side
}

export type LocalDuelSummary = {
  totalRounds: number
  matches: number
  differences: number
  agreementPercentage: number
  firstDividingPrompt?: PromptPreview
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }

  return copy
}

/**
 * Cara a cara usa exclusivamente el catálogo Bardo vigente. Las cartas activas
 * y de reserva participan con la misma prioridad; las archivadas, incompletas
 * o de cualquier otra intensidad quedan afuera.
 *
 * Mientras haya cinco categorías disponibles, cada partida toma una carta de
 * cinco categorías distintas. El segundo recorrido es un fallback defensivo:
 * sólo permite repetir categoría si un catálogo futuro tuviera menos de cinco.
 */
export function createLocalDuelDeck(random: () => number = Math.random): PromptPreview[] {
  const availablePrompts = promptsForIntensity('bardo').filter((prompt) => (
    (prompt.status === 'active' || prompt.status === 'reserve')
    && prompt.text.trim().length > 0
    && prompt.sideA.trim().length > 0
    && prompt.sideB.trim().length > 0
  ))

  if (availablePrompts.length < LOCAL_DUEL_ROUND_COUNT) {
    throw new Error('No hay suficientes consignas Bardo para iniciar Cara a cara.')
  }

  const shuffledPrompts = shuffled(availablePrompts, random)
  const selected: PromptPreview[] = []
  const selectedCategories = new Set<string>()

  for (const prompt of shuffledPrompts) {
    if (selectedCategories.has(prompt.category)) continue
    selected.push(prompt)
    selectedCategories.add(prompt.category)
    if (selected.length === LOCAL_DUEL_ROUND_COUNT) return selected
  }

  for (const prompt of shuffledPrompts) {
    if (selected.some((selectedPrompt) => selectedPrompt.id === prompt.id)) continue
    selected.push(prompt)
    if (selected.length === LOCAL_DUEL_ROUND_COUNT) return selected
  }

  throw new Error('No hay suficientes consignas Bardo distintas para iniciar Cara a cara.')
}

export function summarizeLocalDuel(rounds: readonly LocalDuelRound[]): LocalDuelSummary {
  const matches = rounds.filter((round) => round.playerOneChoice === round.playerTwoChoice).length
  const firstDividingRound = rounds.find((round) => round.playerOneChoice !== round.playerTwoChoice)

  return {
    totalRounds: rounds.length,
    matches,
    differences: rounds.length - matches,
    agreementPercentage: rounds.length === 0 ? 0 : Math.round((matches / rounds.length) * 100),
    firstDividingPrompt: firstDividingRound?.prompt,
  }
}
