import { describe, expect, it } from 'vitest'
import { activePrompts, findPrompt, promptPreviews, promptsForIntensity } from './prompts'

const bardoCategories = [
  'Pareja y celos',
  'Chamuyo, citas y límites',
  'Amistades y códigos',
  'WhatsApp, Instagram, privacidad y redes',
  'Gym, imagen, ropa y validación',
  'Salidas, previa, boliche y plata',
  'Convivencia, facultad, trabajo, viajes y vida adulta',
]

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-AR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

describe('catálogo editorial de consignas V2', () => {
  it('mantiene IDs únicos y preserva las cartas históricas como archivadas', () => {
    expect(promptPreviews).toHaveLength(290)
    expect(new Set(promptPreviews.map((prompt) => prompt.id)).size).toBe(promptPreviews.length)
    expect(promptPreviews.filter((prompt) => prompt.intensity === 'bardo' && prompt.status === 'archived')).toHaveLength(80)
    expect(findPrompt('jajaj-rendirse')).toMatchObject({ status: 'archived' })
    expect(findPrompt('panera')?.status).toBe('reserve')
  })

  it('cumple los volúmenes V2 sin mezclar cartas archivadas en el mazo', () => {
    expect(activePrompts('tranqui')).toHaveLength(60)
    expect(promptsForIntensity('tranqui').filter((prompt) => prompt.status === 'reserve')).toHaveLength(20)
    expect(activePrompts('bardo')).toHaveLength(100)
    expect(promptsForIntensity('bardo').filter((prompt) => prompt.status === 'reserve')).toHaveLength(30)
    expect(promptsForIntensity('bardo').every((prompt) => prompt.id.startsWith('v2-'))).toBe(true)
  })

  it('reparte Bardo entre las siete categorías sin dominancia', () => {
    const counts = activePrompts('bardo').reduce<Record<string, number>>((all, prompt) => ({
      ...all,
      [prompt.category]: (all[prompt.category] ?? 0) + 1,
    }), {})

    expect(Object.keys(counts).sort()).toEqual([...bardoCategories].sort())
    Object.values(counts).forEach((count) => {
      expect(count).toBeGreaterThanOrEqual(10)
      expect(count).toBeLessThanOrEqual(16)
    })
  })

  it('mantiene el balance editorial de género en Bardo', () => {
    const counts = promptsForIntensity('bardo').reduce<Record<string, number>>((all, prompt) => ({
      ...all,
      [prompt.audienceType]: (all[prompt.audienceType] ?? 0) + 1,
    }), {})

    expect(counts.neutral).toBe(76)
    expect(counts.dirigida_a_hombres).toBe(27)
    expect(counts.dirigida_a_mujeres).toBe(27)
    expect(counts.neutral).toBeGreaterThanOrEqual(65)
    expect(Math.abs(counts.dirigida_a_hombres - counts.dirigida_a_mujeres)).toBeLessThanOrEqual(1)
  })

  it('valida formato, lados breves y duplicados textuales normalizados', () => {
    const playable = promptPreviews.filter((prompt) => prompt.status !== 'archived')
    playable.forEach((prompt) => {
      expect(prompt.id).toMatch(/^[a-z0-9-]+$/)
      expect(prompt.category.trim()).not.toHaveLength(0)
      expect(prompt.text.length).toBeLessThanOrEqual(118)
      expect(prompt.sideA.trim()).not.toHaveLength(0)
      expect(prompt.sideB.trim()).not.toHaveLength(0)
      expect(prompt.sideA.length).toBeLessThanOrEqual(24)
      expect(prompt.sideB.length).toBeLessThanOrEqual(24)
      expect(normalize(prompt.sideA)).not.toBe(normalize(prompt.sideB))
    })

    const normalized = playable.map((prompt) => normalize(prompt.text))
    expect(new Set(normalized).size).toBe(normalized.length)
  })
})
