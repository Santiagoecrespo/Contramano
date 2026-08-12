import type { PromptPreview } from '../types/game'

export const promptPreviews: PromptPreview[] = [
  { id: 'asado-tarde', category: 'Asado', intensity: 'tranqui', text: 'Llegar media hora tarde a un asado no cuenta como llegar tarde.', sideA: 'Cuenta', sideB: 'No cuenta' },
  { id: 'previa-boliche', category: 'Previa', intensity: 'tranqui', text: 'Una buena previa es mejor que ir al boliche.', sideA: 'Sí', sideB: 'No' },
  { id: 'mate-lavado', category: 'Mate', intensity: 'tranqui', text: 'El mate lavado se toma igual.', sideA: 'Se toma', sideB: 'Se cambia' },
  { id: 'delivery-mismo', category: 'Delivery', intensity: 'tranqui', text: 'Pedir siempre lo mismo es la decisión más inteligente.', sideA: 'Sí', sideB: 'No' },
  { id: 'musica-prioridad', category: 'Música', intensity: 'tranqui', text: 'Quien pone música tiene prioridad para elegir.', sideA: 'Tiene', sideB: 'No tiene' },
  { id: 'truco-falta', category: 'Truco', intensity: 'tranqui', text: 'Cantar falta envido sin cartas es una estrategia válida.', sideA: 'Vale', sideB: 'No vale' },
  { id: 'series-dobladas', category: 'Series', intensity: 'tranqui', text: 'Ver una serie doblada no la arruina.', sideA: 'No arruina', sideB: 'Arruina' },
  { id: 'previa-horario', category: 'Salidas', intensity: 'tranqui', text: 'La previa debería empezar cuando dice la invitación.', sideA: 'Sí', sideB: 'No' },
  { id: 'ya-salgo', category: 'Puntualidad', intensity: 'tranqui', text: 'Decir “ya estoy saliendo” desde la casa es aceptable.', sideA: 'Aceptable', sideB: 'Chamuyo' },
  { id: 'viaje-improvisar', category: 'Viajes', intensity: 'tranqui', text: 'En un viaje, improvisar el plan es mejor que organizarlo.', sideA: 'Improvisar', sideB: 'Organizar' },
  { id: 'facultad-leer', category: 'Facultad', intensity: 'tranqui', text: 'Llegar sin haber leído igual cuenta como ir a clase.', sideA: 'Cuenta', sideB: 'No cuenta' },
  { id: 'juego-reglas', category: 'Juegos', intensity: 'tranqui', text: 'Explicar las reglas demasiado en serio arruina el juego.', sideA: 'Arruina', sideB: 'Ayuda' },
  { id: 'cancelar-multa', category: 'Planes', intensity: 'bardo', text: 'Cancelar el mismo día debería tener multa.', sideA: 'Sí', sideB: 'No' },
  { id: 'tarde-suspension', category: 'Puntualidad', intensity: 'bardo', text: 'El grupo puede suspender al que siempre llega último.', sideA: 'Puede', sideB: 'No puede' },
  { id: 'fuego-chamuyo', category: 'Redes', intensity: 'bardo', text: 'Responder una historia sólo con fuego es chamuyo.', sideA: 'Es', sideB: 'No es' },
  { id: 'parlante-opinar', category: 'Música', intensity: 'bardo', text: 'Quien monopoliza el parlante pierde derecho a opinar.', sideA: 'Pierde', sideB: 'No pierde' },
  { id: 'viaje-responsable', category: 'Viajes', intensity: 'bardo', text: 'En un viaje alguien debe ser responsable aunque nadie lo elija.', sideA: 'Debe', sideB: 'No debe' },
  { id: 'silenciar-grupo', category: 'Grupos', intensity: 'bardo', text: 'Silenciar el grupo una semana es completamente válido.', sideA: 'Válido', sideB: 'Exagerado' },
  { id: 'dividir-peso', category: 'Salidas', intensity: 'bardo', text: 'El que propone dividir exacto cada peso puede bajar el ánimo.', sideA: 'Sí', sideB: 'No' },
  { id: 'sin-contestar', category: 'Amistades', intensity: 'bardo', text: 'No contestar durante un día entero no requiere explicación.', sideA: 'No requiere', sideB: 'Requiere' },
  { id: 'irse-temprano', category: 'Boliche', intensity: 'bardo', text: 'Irse temprano de una salida puede ser una victoria.', sideA: 'Victoria', sideB: 'Derrota' },
  { id: 'historias-todo', category: 'Redes', intensity: 'bardo', text: 'Subir todo lo que hacés a historias le saca gracia al plan.', sideA: 'La saca', sideB: 'No' },
  { id: 'apuntes-explicar', category: 'Facultad', intensity: 'bardo', text: 'Compartir apuntes no obliga a explicar todo después.', sideA: 'No obliga', sideB: 'Obliga' },
  { id: 'mejores-amigos', category: 'Celos cotidianos', intensity: 'bardo', text: 'Tener “mejores amigos” en redes es innecesario.', sideA: 'Innecesario', sideB: 'Normal' },
]

