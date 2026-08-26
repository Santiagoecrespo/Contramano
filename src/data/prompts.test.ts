import { describe, expect, it } from 'vitest'
import { bardoCategories, bardoV3Prompts } from './bardoV3'
import { activePrompts, findPrompt, promptPreviews, promptsForIntensity } from './prompts'

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-AR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

describe('catálogo editorial Bardo normalizado', () => {
  it('mantiene IDs únicos y preserva las cartas históricas como archivadas', () => {
    expect(promptPreviews).toHaveLength(487)
    expect(new Set(promptPreviews.map((prompt) => prompt.id)).size).toBe(promptPreviews.length)
    expect(promptPreviews.filter((prompt) => prompt.intensity === 'bardo' && prompt.status === 'archived')).toHaveLength(211)
    expect(findPrompt('jajaj-rendirse')).toMatchObject({ status: 'archived' })
    expect(findPrompt('v2-pareja-ubicacion')).toMatchObject({ status: 'archived' })
    expect(findPrompt('bardo-v3-citas-instagram')).toMatchObject({ status: 'archived' })
  })

  it('carga las 197 cartas completas y excluye la carta editorial incompleta', () => {
    expect(activePrompts('tranqui')).toHaveLength(60)
    expect(promptsForIntensity('tranqui').filter((prompt) => prompt.status === 'reserve')).toHaveLength(20)
    expect(bardoV3Prompts).toHaveLength(197)
    expect(activePrompts('bardo')).toHaveLength(99)
    expect(promptsForIntensity('bardo').filter((prompt) => prompt.status === 'reserve')).toHaveLength(97)
    expect(promptsForIntensity('bardo')).toHaveLength(196)
    expect(bardoV3Prompts.filter((prompt) => prompt.status === 'archived')).toHaveLength(1)
    expect(bardoV3Prompts.some((prompt) => prompt.text === '¿Un transexual debe ir al baño de hombres o de mujer?')).toBe(false)
  })

  it('incluye las diez categorías válidas del catálogo normalizado', () => {
    expect(bardoCategories).toEqual([
      'Pareja y celos',
      'Chamuyo, citas y límites',
      'Amistades y códigos',
      'WhatsApp, Instagram, privacidad y redes',
      'Gym, imagen, ropa y validación',
      'Salidas, previa, boliche y plata',
      'Convivencia, facultad, trabajo, viajes y vida adulta',
      'Deporte, competencia y fandom',
      'Sociedad, identidad y debate público',
      'Valores, decisiones y dilemas personales',
    ])

    const counts = bardoV3Prompts.reduce<Record<string, number>>((all, prompt) => ({
      ...all,
      [prompt.category]: (all[prompt.category] ?? 0) + 1,
    }), {})

    expect(counts).toEqual({
      'Pareja y celos': 36,
      'Chamuyo, citas y límites': 35,
      'Amistades y códigos': 26,
      'WhatsApp, Instagram, privacidad y redes': 19,
      'Gym, imagen, ropa y validación': 14,
      'Salidas, previa, boliche y plata': 27,
      'Convivencia, facultad, trabajo, viajes y vida adulta': 23,
      'Sociedad, identidad y debate público': 6,
      'Deporte, competencia y fandom': 4,
      'Valores, decisiones y dilemas personales': 7,
    })
  })

  it('conserva las audiencias editoriales sin afectar la elegibilidad', () => {
    const counts = bardoV3Prompts.reduce<Record<string, number>>((all, prompt) => ({
      ...all,
      [prompt.audienceType]: (all[prompt.audienceType] ?? 0) + 1,
    }), {})

    expect(counts).toEqual({
      neutral: 179,
      dirigida_a_hombres: 6,
      dirigida_a_mujeres: 6,
      archive: 3,
      revisar: 3,
    })
  })

  it('valida formato, lados completos y duplicados textuales normalizados', () => {
    bardoV3Prompts.forEach((prompt) => {
      expect(prompt.id).toMatch(/^[a-z0-9-]+$/)
      expect(prompt.category.trim()).not.toHaveLength(0)
      expect(prompt.text.length).toBeGreaterThan(0)
      expect(prompt.sideA.trim()).not.toHaveLength(0)
      expect(prompt.sideB.trim()).not.toHaveLength(0)
      expect(normalize(prompt.sideA)).not.toBe(normalize(prompt.sideB))
    })

    const normalized = bardoV3Prompts.map((prompt) => normalize(prompt.text))
    expect(new Set(normalized).size).toBe(normalized.length)
  })
})
