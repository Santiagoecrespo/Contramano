import type { PromptPreview } from '../types/game'

export const promptPreviews: PromptPreview[] = [
  { category: 'Asado', intensity: 'tranqui', text: 'Llegar media hora tarde a un asado no cuenta como llegar tarde.', sideA: 'Cuenta', sideB: 'No cuenta' },
  { category: 'Previa', intensity: 'tranqui', text: 'Una buena previa es mejor que ir al boliche.', sideA: 'Sí', sideB: 'No' },
  { category: 'Mate', intensity: 'tranqui', text: 'El mate lavado se toma igual.', sideA: 'Se toma', sideB: 'Se cambia' },
  { category: 'Viajes', intensity: 'tranqui', text: 'En un viaje, improvisar el plan es mejor que organizarlo.', sideA: 'Improvisar', sideB: 'Organizar' },
  { category: 'Planes', intensity: 'bardo', text: 'Cancelar el mismo día debería tener multa.', sideA: 'Sí', sideB: 'No' },
  { category: 'Puntualidad', intensity: 'bardo', text: 'El grupo puede suspender al que siempre llega último.', sideA: 'Puede', sideB: 'No puede' },
  { category: 'Redes', intensity: 'bardo', text: 'Responder una historia sólo con fuego es chamuyo.', sideA: 'Es', sideB: 'No es' },
  { category: 'Boliche', intensity: 'bardo', text: 'Irse temprano de una salida puede ser una victoria.', sideA: 'Victoria', sideB: 'Derrota' },
]

