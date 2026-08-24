import { activePrompts } from '../data/prompts'
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
 * El duelo usa el mazo Tranqui activo tal como ya existe. No escribe ni altera
 * el catálogo y devuelve una mano nueva sin cartas repetidas para cada partida.
 */
export function createLocalDuelDeck(random: () => number = Math.random): PromptPreview[] {
  const availablePrompts = activePrompts('tranqui')

  if (availablePrompts.length < LOCAL_DUEL_ROUND_COUNT) {
    throw new Error('No hay suficientes consignas activas para iniciar Cara a cara.')
  }

  return shuffled(availablePrompts, random).slice(0, LOCAL_DUEL_ROUND_COUNT)
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
