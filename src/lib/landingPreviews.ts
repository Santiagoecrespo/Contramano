import { promptsForIntensity } from '../data/prompts'
import type { PromptPreview } from '../types/game'

export const LANDING_PREVIEW_COUNT = 3
export const LANDING_PREVIEW_STORAGE_KEY = 'contramano:landing-preview-ids'

type PreviewStorage = Pick<Storage, 'getItem' | 'setItem'>

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomValue = Math.min(Math.max(random(), 0), 0.999_999_999)
    const swapIndex = Math.floor(randomValue * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }

  return copy
}

function readPreviousIds(storage: PreviewStorage | null): string[] {
  if (!storage) return []

  try {
    const stored = JSON.parse(storage.getItem(LANDING_PREVIEW_STORAGE_KEY) ?? '[]')
    return Array.isArray(stored) && stored.every((id) => typeof id === 'string') ? stored : []
  } catch {
    return []
  }
}

function writePreviewIds(storage: PreviewStorage | null, prompts: readonly PromptPreview[]) {
  if (!storage) return

  try {
    storage.setItem(LANDING_PREVIEW_STORAGE_KEY, JSON.stringify(prompts.map((prompt) => prompt.id)))
  } catch {
    // El modo privado o un storage bloqueado no impiden que se vea la landing.
  }
}

function browserStorage(): PreviewStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * La vista previa de inicio usa el mismo Bardo vigente que Cara a cara: sólo
 * cartas completas active/reserve. La selección no modifica los mazos de juego.
 */
export function selectLandingPreviews(
  random: () => number = Math.random,
  storage: PreviewStorage | null = browserStorage(),
): PromptPreview[] {
  const eligible = promptsForIntensity('bardo').filter((prompt) => (
    (prompt.status === 'active' || prompt.status === 'reserve')
    && prompt.text.trim().length > 0
    && prompt.sideA.trim().length > 0
    && prompt.sideB.trim().length > 0
  ))
  const previousIds = new Set(readPreviousIds(storage))
  const alternatives = eligible.filter((prompt) => !previousIds.has(prompt.id))
  const pool = alternatives.length >= LANDING_PREVIEW_COUNT ? alternatives : eligible
  const previews = shuffled(pool, random).slice(0, LANDING_PREVIEW_COUNT)

  writePreviewIds(storage, previews)
  return previews
}
