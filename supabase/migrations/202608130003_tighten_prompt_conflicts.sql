-- Applies the editorial pass after 202608130002_expand_editorial_prompt_catalog.sql.
-- It only updates copy and vote labels: prompt IDs, status and gameplay history remain intact.
update public.prompts as target
set text = source.text, side_a = source.side_a, side_b = source.side_b
from (values
  ('asado-pan', 'En un asado, el pan con chimichurri se sirve antes que la carne.', 'Se sirve antes', 'Espera carne'),
  ('mate-excusa', 'En una charla larga, cebar mate importa más que tomarlo.', 'Importa más', 'No tanto'),
  ('mate-ronda', 'Si el mate está lavado, quien ceba tiene que avisar antes de pasarlo.', 'Tiene que avisar', 'Se nota solo'),
  ('fila-bar', 'Si un bar tiene fila larga, el grupo debería cambiar de lugar.', 'Cambia', 'Espera'),
  ('playlist-viaje', 'Quien arma la playlist del viaje decide qué temas no se saltean.', 'Decide', 'Se vota'),
  ('grupo-nombre', 'El nombre del grupo de WhatsApp se cambia sólo con aprobación de la mayoría.', 'Mayoría decide', 'Cualquiera cambia'),
  ('plan-sorpresa', 'En un plan sorpresa, una persona del grupo tiene que saberlo de antemano.', 'Tiene que saber', 'Nadie sabe'),
  ('apodo-grupo', 'Un apodo del grupo deja de ser gracioso cuando la persona pide que no lo usen.', 'Se deja', 'Se banca'),
  ('facultad-grupo', 'En un trabajo grupal, quien hace la portada también debería hacer menos del resto.', 'Hace menos', 'Hace igual'),
  ('parcial-descanso', 'La noche antes de un parcial conviene dormir antes que seguir repasando por pánico.', 'Dormir', 'Repasar'),
  ('trabajo-camara', 'En una reunión remota, tener cámara apagada debería obligar a responder cuando te nombran.', 'Obliga', 'No cambia'),
  ('laburo-mate', 'En una oficina, el mate compartido justifica cortar cinco minutos el laburo.', 'Justifica', 'Se toma trabajando'),
  ('mapa-viaje', 'En un viaje, perderse una vez vale si aparece un lugar mejor.', 'Vale', 'No vale'),
  ('manta-sillon', 'Quien siempre usa la manta del sillón tiene prioridad cuando hace frío.', 'Tiene prioridad', 'Es de todos'),
  ('vaquita-redonda', 'En una vaquita, redondear para arriba evita más vueltas que calcular exacto.', 'Se redondea', 'Se calcula'),
  ('oferta-comun', 'Si una promo es para dos, el grupo debería reorganizarse para aprovecharla.', 'Se reorganiza', 'Cada uno pide'),
  ('futbol-asado', 'Durante un partido, la picada se repone en el entretiempo, no cuando se termina.', 'Entretiempo', 'Cuando falta'),
  ('futbol-repeticion', 'Después de un golazo, el grupo puede pedir tres repeticiones.', 'Puede pedir', 'Una alcanza'),
  ('plan-domingo', 'Si no hay plan para el domingo, nadie debería proponer uno a último momento.', 'Nadie propone', 'Siempre se propone'),
  ('cumple-tema', 'En un cumpleaños con temática, quien no se disfraza no puede criticar las fotos.', 'No critica', 'Puede criticar'),
  ('siesta', 'Una siesta después de almorzar debería tener alarma obligatoria.', 'Con alarma', 'Sin alarma'),
  ('asado-ensalada', 'En un asado, quien no come carne debería tener una opción pensada desde el inicio.', 'Se contempla', 'Se arregla'),
  ('salida-guardarropa', 'En una salida con abrigo, pagar guardarropa evita que alguien cargue todo.', 'Se paga', 'Se lleva'),
  ('redes-comentario', 'Comentar una foto de un amigo debería valer más que dejar un like.', 'Vale más', 'Con un like alcanza'),
  ('facultad-cafe', 'En época de parciales, el café cuenta como parte del estudio.', 'Cuenta', 'Es sólo excusa'),
  ('plata-regalo', 'Para un regalo grupal, poner el mismo monto importa más que elegir algo personal.', 'Mismo monto', 'Algo personal'),
  ('amistad-favor', 'Después de hacer un favor grande, está bien recordarlo si te piden otro.', 'Está bien', 'No se cobra'),
  ('tecnologia-notas', 'Anotar todo en el celular hace que dependas demasiado de él.', 'Dependés', 'Te libera'),
  ('mate-celular', 'Quien ceba mate no debería mirar el celular hasta terminar la ronda.', 'No debería', 'Puede mirar'),
  ('mate-prestado', 'Un mate prestado se devuelve limpio aunque nadie lo pida.', 'Se devuelve limpio', 'No hace falta'),
  ('queda-bien', 'Si alguien pregunta cómo le queda algo, la respuesta sincera vale más que quedar bien.', 'Sincera', 'Se cuida'),
  ('musica-dj', 'Quien pide el parlante debería aceptar que le salteen temas.', 'Tiene que aceptar', 'Decide todo'),
  ('desaparece-pide', 'El que desaparece del grupo una semana no puede volver sólo para pedir un favor.', 'No puede', 'Puede volver'),
  ('laburo-responder', 'Responder “lo veo” sin fecha habilita a que te lo recuerden.', 'Habilita', 'No habilita'),
  ('viaje-responsable', 'En un viaje, quien arma el itinerario gana derecho a apurar al grupo.', 'Gana derecho', 'No apura'),
  ('pre-viaje-maleta', 'Hacer la valija la noche anterior justifica olvidarse algo.', 'Justifica', 'No justifica'),
  ('convivencia-lista', 'El que compra para todos no tiene por qué perseguir transferencias.', 'No tiene por qué', 'Le toca insistir'),
  ('baño-ocupado', 'Si hay gente esperando, quien entra al baño debería avisar que va a tardar.', 'Tiene que avisar', 'No hace falta'),
  ('paga-persigue', 'El que paga para todos tiene derecho a recordar transferencias sin quedar pesado.', 'Tiene derecho', 'Es pesado'),
  ('juego-reglas-bardo', 'Antes de empezar un juego, explicar las reglas completas debería ser obligatorio.', 'Obligatorio', 'Se aprende jugando'),
  ('futbol-grito', 'Gritar un gol antes de que entre obliga a bancarse la mufa si no entra.', 'Se banca', 'No existe'),
  ('asado-ensalada-bardo', 'Quien no aportó al asado no puede elegir qué corte se compra.', 'No puede', 'Puede elegir'),
  ('amistad-cumple', 'Olvidarte un cumpleaños exige un gesto, no sólo una excusa.', 'Exige un gesto', 'Con excusa alcanza')
) as source(id, text, side_a, side_b)
where target.id = source.id;

-- Continuation of the audit: same safe copy-only update for existing projects.
update public.prompts as target
set text = source.text, side_a = source.side_a, side_b = source.side_b
from (values
  ('cancion-conocida', 'En una juntada, cantar mal un tema conocido está permitido si todos se suman.', 'Está permitido', 'Se evita'),
  ('memes', 'En el grupo, un meme puede responder una pregunta sin explicaciones extra.', 'Puede responder', 'No alcanza'),
  ('redes-borrar', 'Si alguien borra una historia enseguida, el grupo puede preguntarle qué pasó.', 'Puede preguntar', 'No se pregunta'),
  ('foto-grupal', 'En una salida, sacarse una foto grupal vale aunque quede sólo en el chat.', 'Vale igual', 'Se comparte'),
  ('futbol-relato', 'En un partido importante, el relato de radio debería quedar de fondo aunque haya transmisión.', 'Debería quedar', 'No hace falta'),
  ('pizza-fria', 'La pizza fría del día siguiente se come sin recalentar.', 'Se come fría', 'Se recalienta'),
  ('musica-auriculares', 'Ofrecer un auricular para mostrar un tema debería ser un gesto, no una invasión.', 'Es un gesto', 'Es invasivo'),
  ('amistad-ubicacion', 'En una salida, mandar ubicación en vivo debería ser obligatorio si alguien llega después.', 'Obligatorio', 'No hace falta'),
  ('viaje-fotos', 'En un viaje, sacar fotos de cada parada vale aunque retrase al grupo.', 'Vale la pena', 'Retrasa de más'),
  ('juego-revancha', 'Después de perder, pedir revancha antes de cambiar de juego es válido.', 'Es válido', 'Es capricho'),
  ('futbol-camiseta', 'Para ver un partido importante, ponerse camiseta suma aunque no sea del equipo.', 'Suma', 'Da igual'),
  ('mate-termo', 'Si compartís mate, también deberías poner el termo.', 'Deberías ponerlo', 'No hace falta'),
  ('jajaj-rendirse', 'Después de una discusión, mandar “jajaj” debería cerrar el tema.', 'Debería cerrarlo', 'No alcanza'),
  ('silenciar-grupo', 'Quien silencia el grupo una semana no puede volver pidiendo el resumen.', 'No puede', 'Puede pedirlo'),
  ('jaja-mal', 'Responder “jaja mal” debería obligarte a aportar algo más a la conversación.', 'Debería', 'Alcanza'),
  ('historias-todo', 'En una salida, subir historias todo el tiempo debería hacerte guardar el celular un rato.', 'Debería', 'No cambia nada'),
  ('parcial-grupo', 'Después de un parcial, comparar respuestas debería estar prohibido hasta la nota.', 'Prohibido', 'Hay que comparar'),
  ('viaje-cuentas', 'En un viaje, anotar cada gasto debería ser obligatorio aunque corte el clima.', 'Obligatorio', 'Corta el clima'),
  ('calculadora-salida', 'En una salida, dividir hasta el último peso debería hacerse aunque demore la cuenta.', 'Debería hacerse', 'Se redondea'),
  ('vuelto-chico', 'Cobrar un vuelto mínimo una semana después debería dar vergüenza.', 'Debería darla', 'Se cobra igual'),
  ('futbol-repeticion-bardo', 'Durante una charla, frenar todo para ver una repetición está permitido.', 'Está permitido', 'Es demasiado'),
  ('mate-galletitas', 'En la ronda de mate, poner galletitas debería ser obligatorio.', 'Obligatorio', 'Ensucia'),
  ('futbol-cabala', 'Quien se cambia de lugar por cábala puede pedir que nadie lo mueva.', 'Puede pedirlo', 'No da'),
  ('asado-carbon', 'En un asado, traer carbón debería contar más que traer postre.', 'Carbón cuenta más', 'Postre gana')
) as source(id, text, side_a, side_b)
where target.id = source.id;
