export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 8

export function generateRoomCode(random: () => number = Math.random): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => {
    const index = Math.floor(random() * ROOM_CODE_ALPHABET.length)
    return ROOM_CODE_ALPHABET[index]
  }).join('')
}

