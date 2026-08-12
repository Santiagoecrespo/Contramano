import { describe, expect, it } from 'vitest'
import { promptPreviews } from './prompts'

describe('prompt previews', () => {
  it('includes both MVP intensity options', () => {
    expect(promptPreviews.some((prompt) => prompt.intensity === 'tranqui')).toBe(true)
    expect(promptPreviews.some((prompt) => prompt.intensity === 'bardo')).toBe(true)
  })
})

