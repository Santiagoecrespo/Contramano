import { describe, expect, it } from 'vitest'
import { activePrompts, promptPreviews } from './prompts'

describe('prompt previews', () => {
  it('has 30 active and 10 reserve prompts in each intensity with distributed categories', () => {
    ;(['tranqui', 'bardo'] as const).forEach((intensity) => {
      expect(activePrompts(intensity)).toHaveLength(30)
      expect(promptPreviews.filter((prompt) => prompt.intensity === intensity && prompt.status === 'reserve')).toHaveLength(10)
      expect(new Set(activePrompts(intensity).map((prompt) => prompt.category)).size).toBeGreaterThanOrEqual(10)
      const categoryCounts = Object.values(activePrompts(intensity).reduce<Record<string, number>>((counts, prompt) => ({ ...counts, [prompt.category]: (counts[prompt.category] ?? 0) + 1 }), {}))
      expect(Math.max(...categoryCounts)).toBeLessThanOrEqual(6)
    })
  })
})
