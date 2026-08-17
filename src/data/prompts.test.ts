import { describe, expect, it } from 'vitest'
import { bardoV3Prompts } from './bardoV3'
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

describe('catálogo editorial de consignas Bardo V3', () => {
  it('mantiene IDs únicos y preserva las cartas históricas como archivadas', () => {
    expect(promptPreviews).toHaveLength(420)
    expect(new Set(promptPreviews.map((prompt) => prompt.id)).size).toBe(promptPreviews.length)
    expect(promptPreviews.filter((prompt) => prompt.intensity === 'bardo' && prompt.status === 'archived')).toHaveLength(210)
    expect(findPrompt('jajaj-rendirse')).toMatchObject({ status: 'archived' })
    expect(findPrompt('v2-pareja-ubicacion')).toMatchObject({ status: 'archived' })
    expect(findPrompt('panera')?.status).toBe('reserve')
    promptPreviews.filter((prompt) => prompt.intensity === 'bardo' && prompt.status === 'archived').forEach((prompt) => {
      expect(findPrompt(prompt.id)).toBeDefined()
    })
  })

  it('carga sólo las 130 cartas Bardo V3 en los mazos nuevos', () => {
    expect(activePrompts('tranqui')).toHaveLength(60)
    expect(promptsForIntensity('tranqui').filter((prompt) => prompt.status === 'reserve')).toHaveLength(20)
    expect(bardoV3Prompts).toHaveLength(130)
    expect(activePrompts('bardo')).toHaveLength(100)
    expect(promptsForIntensity('bardo').filter((prompt) => prompt.status === 'reserve')).toHaveLength(30)
    expect(promptsForIntensity('bardo').every((prompt) => prompt.id.startsWith('bardo-v3-'))).toBe(true)
  })

  it('reparte las 100 activas en las siete categorías acordadas', () => {
    const counts = activePrompts('bardo').reduce<Record<string, number>>((all, prompt) => ({
      ...all,
      [prompt.category]: (all[prompt.category] ?? 0) + 1,
    }), {})

    expect(Object.keys(counts).sort()).toEqual([...bardoCategories].sort())
    expect(counts).toEqual({
      'Pareja y celos': 16,
      'Chamuyo, citas y límites': 16,
      'Amistades y códigos': 16,
      'WhatsApp, Instagram, privacidad y redes': 14,
      'Gym, imagen, ropa y validación': 12,
      'Salidas, previa, boliche y plata': 14,
      'Convivencia, facultad, trabajo, viajes y vida adulta': 12,
    })
  })

  it('mantiene el balance editorial de género en Bardo', () => {
    const counts = promptsForIntensity('bardo').reduce<Record<string, number>>((all, prompt) => ({
      ...all,
      [prompt.audienceType]: (all[prompt.audienceType] ?? 0) + 1,
    }), {})

    expect(counts.neutral).toBe(118)
    expect(counts.dirigida_a_hombres).toBe(6)
    expect(counts.dirigida_a_mujeres).toBe(6)
  })

  it('valida formato, lados breves y duplicados textuales normalizados', () => {
    bardoV3Prompts.forEach((prompt) => {
      expect(prompt.id).toMatch(/^[a-z0-9-]+$/)
      expect(prompt.category.trim()).not.toHaveLength(0)
      expect(prompt.text.length).toBeGreaterThan(0)
      expect(prompt.sideA.trim()).not.toHaveLength(0)
      expect(prompt.sideB.trim()).not.toHaveLength(0)
      // V3 conserva literalmente las etiquetas editoriales aprobadas; la más
      // larga entra en el diseño responsive sin truncarse.
      expect(prompt.sideA.length).toBeLessThanOrEqual(32)
      expect(prompt.sideB.length).toBeLessThanOrEqual(32)
      expect(normalize(prompt.sideA)).not.toBe(normalize(prompt.sideB))
    })

    const normalized = bardoV3Prompts.map((prompt) => normalize(prompt.text))
    expect(new Set(normalized).size).toBe(normalized.length)
  })
})
