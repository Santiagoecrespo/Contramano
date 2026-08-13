import { describe, expect, it } from 'vitest'
import { activePrompts, editorialReviewedPairs, findPrompt, promptPreviews } from './prompts'

describe('catálogo editorial de consignas', () => {
  it('tiene 60 activas y 20 de reserva por modo, con IDs únicos', () => {
    expect(promptPreviews).toHaveLength(160)
    expect(new Set(promptPreviews.map((prompt) => prompt.id)).size).toBe(promptPreviews.length)
    ;(['tranqui', 'bardo'] as const).forEach((intensity) => {
      expect(activePrompts(intensity)).toHaveLength(60)
      expect(promptPreviews.filter((prompt) => prompt.intensity === intensity && prompt.status === 'reserve')).toHaveLength(20)
    })
  })

  it('evita dominancia de categorías: cuatro activas por situación y modo', () => {
    ;(['tranqui', 'bardo'] as const).forEach((intensity) => {
      const counts = activePrompts(intensity).reduce<Record<string, number>>((all, prompt) => ({ ...all, [prompt.category]: (all[prompt.category] ?? 0) + 1 }), {})
      expect(Object.keys(counts)).toHaveLength(15)
      expect(Object.values(counts).every((count) => count <= 5)).toBe(true)
    })
  })

  it('mantiene lados breves, presentes y no duplica textos activos literalmente', () => {
    const active = promptPreviews.filter((prompt) => prompt.status === 'active')
    active.forEach((prompt) => {
      expect(prompt.sideA.trim()).not.toHaveLength(0)
      expect(prompt.sideB.trim()).not.toHaveLength(0)
      expect(prompt.sideA.length).toBeLessThanOrEqual(18)
      expect(prompt.sideB.length).toBeLessThanOrEqual(18)
      expect(prompt.sideA).not.toBe(prompt.sideB)
    })
    const normalized = active.map((prompt) => prompt.text.toLocaleLowerCase('es-AR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
    expect(new Set(normalized).size).toBe(normalized.length)
  })

  it('reemplaza las formulaciones vagas por conflictos concretos', () => {
    const retiredCopy = [
      'El pan con chimichurri merece protagonismo propio.',
      'El mate es más excusa para charlar que bebida.',
      'La lista de compras compartida sólo sirve si alguien la persigue.',
      'El que se ofrece a pagar y después persigue transferencias se contradice.',
      'Tardar demasiado en el baño cuando hay gente esperando es egoísmo.',
      'En un viaje siempre aparece alguien que se cree responsable sin votación.',
      'Decir “yo pongo música” sin que nadie lo pida es una advertencia.',
    ]
    retiredCopy.forEach((text) => expect(promptPreviews.some((prompt) => prompt.text === text)).toBe(false))

    expect(findPrompt('convivencia-lista')).toMatchObject({
      text: 'El que compra para todos no tiene por qué perseguir transferencias.',
      sideA: 'No tiene por qué',
      sideB: 'Le toca insistir',
    })
  })

  it('documenta los pares cercanos revisados para evitar duplicados semánticos', () => {
    expect(editorialReviewedPairs.length).toBeGreaterThanOrEqual(8)
    editorialReviewedPairs.forEach(([first, second, reason]) => {
      expect(first).not.toBe(second)
      expect(promptPreviews.some((prompt) => prompt.id === first)).toBe(true)
      expect(promptPreviews.some((prompt) => prompt.id === second)).toBe(true)
      expect(reason.length).toBeGreaterThan(12)
    })
  })

  it('conserva una ruta de lectura para cartas retiradas de mazos mock ya existentes', () => {
    expect(findPrompt('panera')?.status).toBe('reserve')
    expect(findPrompt('cumple-invitar')?.status).toBe('reserve')
    expect(activePrompts('tranqui').some((prompt) => prompt.id === 'panera')).toBe(false)
  })
})
