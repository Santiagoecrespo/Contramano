import { describe, expect, it } from 'vitest'
import { generateRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './roomCode'

describe('generateRoomCode', () => {
  it('uses eight non-ambiguous characters', () => {
    const code = generateRoomCode(() => 0)
    expect(code).toHaveLength(ROOM_CODE_LENGTH)
    expect([...code].every((character) => ROOM_CODE_ALPHABET.includes(character))).toBe(true)
  })
})

