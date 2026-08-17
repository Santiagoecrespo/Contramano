-- Contramano V2: catálogo Bardo, mazos persistentes y compatibilidad segura.
-- Ejecutar después de 202608130006_add_launch_events.sql. No borra salas,
-- rondas, votos ni políticas RLS: conserva las cartas históricas archivadas.

alter table public.prompts add column if not exists audience_type text;
update public.prompts set audience_type='neutral' where audience_type is null;
alter table public.prompts alter column audience_type set default 'neutral';
alter table public.prompts alter column audience_type set not null;
alter table public.prompts drop constraint if exists prompts_status_check;
alter table public.prompts add constraint prompts_status_check check (status in ('active','reserve','archived'));
alter table public.prompts drop constraint if exists prompts_audience_type_check;
alter table public.prompts add constraint prompts_audience_type_check check (audience_type in ('neutral','dirigida_a_hombres','dirigida_a_mujeres'));

alter table public.prompt_decks add column if not exists stage text not null default 'active';
alter table public.prompt_decks drop constraint if exists prompt_decks_stage_check;
alter table public.prompt_decks add constraint prompt_decks_stage_check check (stage in ('active','reserve','repeat'));

-- Las cartas Bardo anteriores no se editan: permanecen disponibles para el
-- historial de las rondas ya jugadas, pero dejan de entrar en mazos nuevos.
update public.prompts
set status='archived', audience_type='neutral'
where intensity='bardo' and id not like 'v2-%';

insert into public.prompts(id,category,intensity,status,audience_type,text,side_a,side_b) values
('v2-pareja-ubicacion', 'Pareja y celos', 'bardo', 'active', 'neutral', 'Tener ubicación compartida con tu pareja es control.', 'Es control', 'Es cuidado'),
  ('v2-pareja-like-ex', 'Pareja y celos', 'bardo', 'active', 'neutral', 'Dar like a fotos de tu ex teniendo pareja es buscar lío.', 'Busca lío', 'No significa nada'),
  ('v2-pareja-clave', 'Pareja y celos', 'bardo', 'active', 'neutral', 'Saber la clave del celular no prueba confianza.', 'No prueba nada', 'Es confianza'),
  ('v2-pareja-fotos-ex', 'Pareja y celos', 'bardo', 'active', 'neutral', 'Guardar fotos con tu ex no tiene nada de inocente.', 'No es inocente', 'Es pasado'),
  ('v2-pareja-plan-cancelado', 'Pareja y celos', 'bardo', 'active', 'neutral', 'Cancelar un plan de pareja por una salida cae mal con razón.', 'Cae mal con razón', 'Puede pasar'),
  ('v2-pareja-close-friends', 'Pareja y celos', 'bardo', 'active', 'neutral', 'Ocultar historias a tu pareja es peor que no subirlas.', 'Es peor', 'Es privado'),
  ('v2-pareja-ex-cumple', 'Pareja y celos', 'bardo', 'active', 'neutral', 'Saludar a tu ex a las doce de la noche no es de amigos.', 'No es de amigos', 'Es educación'),
  ('v2-pareja-hombre-exes', 'Pareja y celos', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que sigue a todas sus ex no cerró nada.', 'No cerró nada', 'No significa eso'),
  ('v2-pareja-hombre-historias', 'Pareja y celos', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que responde historias ajenas a escondidas busca problemas.', 'Busca problemas', 'Es inocente'),
  ('v2-pareja-hombre-esconde', 'Pareja y celos', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que nunca muestra a su novia en redes la está escondiendo.', 'La está escondiendo', 'Cuida su privacidad'),
  ('v2-pareja-hombre-intensa', 'Pareja y celos', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que dice “sos intensa” para zafar se hace el boludo.', 'Se hace el boludo', 'Pone un límite'),
  ('v2-pareja-mujer-aviso', 'Pareja y celos', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que sale sin avisar a su pareja no le debe explicaciones.', 'No le debe nada', 'Se conversa'),
  ('v2-pareja-mujer-ex', 'Pareja y celos', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que habla todos los días con su ex no cerró esa historia.', 'No la cerró', 'Pueden ser amigos'),
  ('v2-pareja-mujer-like-ex', 'Pareja y celos', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que le comenta todo a su ex está dejando una puerta abierta.', 'Deja una puerta', 'Es buena onda'),
  ('v2-pareja-ultima-conexion', 'Pareja y celos', 'bardo', 'reserve', 'neutral', 'Mirar la última conexión de tu pareja te arruina solo.', 'Te arruina', 'Te aclara'),
  ('v2-pareja-borrar-chat', 'Pareja y celos', 'bardo', 'reserve', 'neutral', 'Borrar un chat para evitar una pelea ya dice bastante.', 'Dice bastante', 'Evita un drama'),
  ('v2-pareja-hombre-silencia', 'Pareja y celos', 'bardo', 'reserve', 'dirigida_a_hombres', 'Un hombre que silencia a su pareja para salir busca que no le reclamen.', 'Busca zafar', 'Necesita aire'),
  ('v2-pareja-mujer-close-friends', 'Pareja y celos', 'bardo', 'reserve', 'dirigida_a_mujeres', 'Una mujer que deja a su ex en mejores amigos no cerró del todo.', 'No cerró del todo', 'No tiene relación'),
  ('v2-citas-no-serio', 'Chamuyo, citas y límites', 'bardo', 'active', 'neutral', 'Decir “no busco nada serio” y actuar como pareja es hacer perder tiempo.', 'Hace perder tiempo', 'Fue claro'),
  ('v2-citas-ghosting', 'Chamuyo, citas y límites', 'bardo', 'active', 'neutral', 'El ghosting es más honesto que inventar excusas.', 'Más honesto', 'Más cobarde'),
  ('v2-citas-exclusividad', 'Chamuyo, citas y límites', 'bardo', 'active', 'neutral', 'Pedir exclusividad sin hablarla es jugar sucio.', 'Es jugar sucio', 'Se sobreentiende'),
  ('v2-citas-cancela', 'Chamuyo, citas y límites', 'bardo', 'active', 'neutral', 'Cancelar una cita dos horas antes merece una explicación.', 'Merece explicación', 'No la debe'),
  ('v2-citas-primera-cuenta', 'Chamuyo, citas y límites', 'bardo', 'active', 'neutral', 'Pagar todo en la primera cita también puede ser chamuyo.', 'Puede ser chamuyo', 'Es un gesto'),
  ('v2-citas-doble-chat', 'Chamuyo, citas y límites', 'bardo', 'active', 'neutral', 'Hablar con cinco personas a la vez no es estar disponible.', 'No es estar disponible', 'Es conocer gente'),
  ('v2-citas-sin-responder', 'Chamuyo, citas y límites', 'bardo', 'active', 'neutral', 'Dejar de responder después de una cita ya es una respuesta.', 'Ya respondió', 'Se puede retomar'),
  ('v2-citas-quimica', 'Chamuyo, citas y límites', 'bardo', 'active', 'neutral', 'Decir “no sentí química” por WhatsApp es mejor que desaparecer.', 'Es mejor', 'Es de frío'),
  ('v2-citas-hombre-madrugada', 'Chamuyo, citas y límites', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que responde sólo de madrugada no busca conocerte.', 'No busca nada', 'Tiene sus tiempos'),
  ('v2-citas-hombre-fluir', 'Chamuyo, citas y límites', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que dice “fluimos” quiere no hacerse cargo.', 'No se hace cargo', 'Va tranquilo'),
  ('v2-citas-hombre-viernes', 'Chamuyo, citas y límites', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que propone planes sólo los viernes deja claro el plan.', 'Lo deja claro', 'Es coincidencia'),
  ('v2-citas-mujer-vemos', 'Chamuyo, citas y límites', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que dice “vemos” hasta el mismo día ya dijo que no.', 'Ya dijo que no', 'Todavía decide'),
  ('v2-citas-mujer-celos', 'Chamuyo, citas y límites', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que no quiere nada pero cela está pidiendo exclusividad.', 'La está pidiendo', 'Sólo le importa'),
  ('v2-citas-mujer-plan', 'Chamuyo, citas y límites', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que acepta planes y nunca propone uno no tiene tanto interés.', 'No tiene interés', 'Es su forma'),
  ('v2-citas-segunda', 'Chamuyo, citas y límites', 'bardo', 'reserve', 'neutral', 'No proponer una segunda cita también es una decisión.', 'Ya decidió', 'No necesariamente'),
  ('v2-citas-mensaje-largo', 'Chamuyo, citas y límites', 'bardo', 'reserve', 'neutral', 'Cortar por mensaje largo es mejor que estirar algo muerto.', 'Es mejor', 'Es de cobarde'),
  ('v2-citas-hombre-visto', 'Chamuyo, citas y límites', 'bardo', 'reserve', 'dirigida_a_hombres', 'Un hombre que deja en visto y vuelve con un meme está tanteando.', 'Está tanteando', 'Es su humor'),
  ('v2-citas-mujer-reserva', 'Chamuyo, citas y límites', 'bardo', 'reserve', 'dirigida_a_mujeres', 'Una mujer que sólo acepta planes de último momento se guarda opciones.', 'Se guarda opciones', 'Es espontánea'),
  ('v2-amigos-encara-gusto', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'Si un amigo encara a alguien que sabés que te gusta, rompió un código.', 'Rompió un código', 'Nadie es de nadie'),
  ('v2-amigos-capturas', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'Guardar capturas de una pelea para mostrarlas después es jugar sucio.', 'Es jugar sucio', 'Es cuidarse'),
  ('v2-amigos-secretos', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'Contar un secreto al grupo porque “ya se sabía” es traicionar.', 'Es traicionar', 'No era secreto'),
  ('v2-amigos-pareja', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'Desaparecer por una pareja nueva merece cargada del grupo.', 'Merece cargada', 'Es normal'),
  ('v2-amigos-cumple', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'Olvidarte el cumpleaños de un amigo pide más que un sticker.', 'Pide más', 'Con eso alcanza'),
  ('v2-amigos-prestamo', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'Un amigo que sólo aparece para pedir favores no es tan amigo.', 'No es tan amigo', 'Pasa una mala'),
  ('v2-amigos-defender', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'No defender a tu amigo cuando lo bardean también es tomar postura.', 'También cuenta', 'No te metas'),
  ('v2-amigos-grupo-vacaciones', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'Bajarte de un viaje grupal a último momento deja al grupo pagando.', 'Deja pagando', 'Puede pasar'),
  ('v2-amigos-invitado', 'Amistades y códigos', 'bardo', 'active', 'neutral', 'Llevar a alguien nuevo sin avisar no es un detalle.', 'No es detalle', 'No cambia nada'),
  ('v2-amigos-hombre-canchero', 'Amistades y códigos', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que se hace el canchero con todas las amigas busca validación.', 'Busca validación', 'Es sociable'),
  ('v2-amigos-hombre-presta', 'Amistades y códigos', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que promete ayudar y desaparece deja al grupo pagando.', 'Deja pagando', 'No pudo'),
  ('v2-amigos-mujer-ex-amigo', 'Amistades y códigos', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que le escribe al mejor amigo de su ex cruza un código.', 'Cruza un código', 'Es libre'),
  ('v2-amigos-mujer-cumple', 'Amistades y códigos', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que no invita a una amiga por celos del grupo se pasa.', 'Se pasa', 'Elige su fiesta'),
  ('v2-amigos-mujer-secreto', 'Amistades y códigos', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que cuenta un secreto “por preocupación” igual lo contó.', 'Igual lo contó', 'Era necesario'),
  ('v2-amigos-audio', 'Amistades y códigos', 'bardo', 'reserve', 'neutral', 'Mandar un audio de diez minutos al grupo es secuestrar la charla.', 'La secuestra', 'Se escucha igual'),
  ('v2-amigos-cancelar', 'Amistades y códigos', 'bardo', 'reserve', 'neutral', 'Cancelar tres veces seguidas te baja de prioridad para el próximo plan.', 'Te baja prioridad', 'No es para tanto'),
  ('v2-amigos-hombre-revancha', 'Amistades y códigos', 'bardo', 'reserve', 'dirigida_a_hombres', 'Un hombre que se enoja por perder no sabe jugar con amigos.', 'No sabe jugar', 'Es competitivo'),
  ('v2-amigos-mujer-grupo', 'Amistades y códigos', 'bardo', 'reserve', 'dirigida_a_mujeres', 'Una mujer que silencia al grupo y pide resumen no puede reclamar.', 'No puede reclamar', 'Puede pedirlo'),
  ('v2-redes-indirectas', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'neutral', 'Tirar indirectas por historias es no animarse a hablar.', 'No se anima', 'Es descargarse'),
  ('v2-redes-visto', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'neutral', 'Clavar visto después de proponer un plan es cancelar sin decirlo.', 'Es cancelar', 'No cuenta'),
  ('v2-redes-historia-mensaje', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'neutral', 'Mirar quién vio tu historia antes de responder mensajes es jugar a dos puntas.', 'Es jugar', 'Es normal'),
  ('v2-redes-cuenta-secundaria', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'neutral', 'Tener una cuenta secundaria para stalkear gente es una red flag.', 'Es red flag', 'Es curiosidad'),
  ('v2-redes-ubicacion', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'neutral', 'Mandar ubicación en vivo sin que te la pidan es invadir.', 'Es invadir', 'Es cuidar'),
  ('v2-redes-captura', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'neutral', 'Sacar captura de un chat sin avisar habilita a usarla después.', 'La habilita', 'Es privado'),
  ('v2-redes-close-friends', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'neutral', 'Sacar a alguien de mejores amigos también es un mensaje.', 'Es un mensaje', 'No significa nada'),
  ('v2-redes-comentario', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'neutral', 'Borrar un comentario para evitar preguntas genera más preguntas.', 'Genera más', 'Evita lío'),
  ('v2-redes-hombre-follows', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que llena Instagram de follows nuevos busca que lo miren.', 'Busca miradas', 'Usa la red'),
  ('v2-redes-hombre-fuego', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que responde historias sólo con fuego está chamuyando.', 'Está chamuyando', 'Es un emoji'),
  ('v2-redes-hombre-comentario', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que comenta fotos ajenas teniendo pareja busca atención.', 'Busca atención', 'Es buena onda'),
  ('v2-redes-mujer-historia', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que sube una historia sólo para que le respondan busca atención.', 'Busca atención', 'Comparte igual'),
  ('v2-redes-mujer-borrar', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que borra una historia por pocas vistas estaba esperando reacción.', 'Esperaba reacción', 'Cambió de idea'),
  ('v2-redes-mujer-stalk', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que stalkea con cuenta falsa no está tan desinteresada.', 'No está distante', 'Es curiosidad'),
  ('v2-redes-mujer-estado', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que sube indirectas y niega destinatario se hace la distraída.', 'Se hace la distraída', 'Se descarga'),
  ('v2-redes-ultima-conexion', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'reserve', 'neutral', 'Ocultar la última conexión hace que todos la miren más.', 'La miran más', 'Da paz'),
  ('v2-redes-responder-meme', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'reserve', 'neutral', 'Responder una discusión con un meme es esquivar el tema.', 'Lo esquiva', 'Baja tensión'),
  ('v2-redes-foto-grupo', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'reserve', 'neutral', 'Subir una foto grupal sin preguntar no necesita permiso.', 'No necesita', 'Se pregunta'),
  ('v2-redes-hombre-visto', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'reserve', 'dirigida_a_hombres', 'Un hombre que ve todo y nunca responde quiere seguir ahí.', 'Quiere seguir', 'No le importa'),
  ('v2-redes-mujer-like', 'WhatsApp, Instagram, privacidad y redes', 'bardo', 'reserve', 'dirigida_a_mujeres', 'Una mujer que da likes selectivos sabe el mensaje que manda.', 'Sabe el mensaje', 'No calcula tanto'),
  ('v2-gym-perfume', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'neutral', 'Ir al gym perfumado también es ir a mostrarse.', 'También es mostrarse', 'Es para uno'),
  ('v2-gym-espejo', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'neutral', 'Usar el espejo del gym más para fotos que para entrenar da cuenta.', 'Da cuenta', 'Es parte del gym'),
  ('v2-gym-rutina-historia', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'neutral', 'Subir cada rutina vuelve al gym una performance.', 'Lo vuelve show', 'Motiva a otros'),
  ('v2-gym-consejo', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'neutral', 'Dar consejos de gym sin que te los pidan es querer figurar.', 'Quiere figurar', 'Quiere ayudar'),
  ('v2-gym-ropa', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'neutral', 'Vestirse para levantar en el gym no tiene nada de malo.', 'No tiene nada malo', 'Desubica'),
  ('v2-gym-progreso', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'neutral', 'Mostrar un cambio físico pide validación aunque sea merecida.', 'Pide validación', 'Comparte progreso'),
  ('v2-gym-ausencia', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'neutral', 'Decir que vas al gym y no ir merece que te carguen.', 'Merece cargada', 'No es asunto ajeno'),
  ('v2-gym-hombre-series', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que graba cada serie quiere público.', 'Quiere público', 'Registra progreso'),
  ('v2-gym-hombre-musculosa', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que se saca la remera para entrenar sabe que lo miran.', 'Sabe que lo miran', 'Está cómodo'),
  ('v2-gym-hombre-consejo', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que corrige la técnica ajena sin permiso se agranda.', 'Se agranda', 'Está ayudando'),
  ('v2-gym-hombre-selfie', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que sube selfie de gym todos los días se mide por likes.', 'Se mide por likes', 'Le gusta el progreso'),
  ('v2-gym-mujer-arregla', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que se arregla para entrenar también quiere que la miren.', 'Quiere miradas', 'Se arregla para ella'),
  ('v2-gym-mujer-historia', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que filma toda su rutina está más para contenido que para gym.', 'Está para contenido', 'Comparte su proceso'),
  ('v2-gym-mujer-ropa', 'Gym, imagen, ropa y validación', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que estrena outfit de gym espera que se note.', 'Espera que se note', 'Le gusta vestirse'),
  ('v2-gym-auriculares', 'Gym, imagen, ropa y validación', 'bardo', 'reserve', 'neutral', 'Entrenar con auriculares es una forma válida de no socializar.', 'Es válida', 'Es cortante'),
  ('v2-gym-foto-ajena', 'Gym, imagen, ropa y validación', 'bardo', 'reserve', 'neutral', 'Sacar fotos en el gym obliga a cuidar que no salga nadie atrás.', 'Obliga a cuidar', 'No es para tanto'),
  ('v2-gym-hombre-peso', 'Gym, imagen, ropa y validación', 'bardo', 'reserve', 'dirigida_a_hombres', 'Un hombre que avisa cuánto levanta antes de entrenar compite con todos.', 'Compite con todos', 'Comparte logro'),
  ('v2-gym-mujer-espejo', 'Gym, imagen, ropa y validación', 'bardo', 'reserve', 'dirigida_a_mujeres', 'Una mujer que tarda más en la foto que en la serie prioriza la foto.', 'Prioriza la foto', 'Es su descanso'),
  ('v2-salida-tarde-hielo', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'Llegar una hora tarde a la previa obliga a poner para el hielo.', 'Le toca poner', 'No compensa'),
  ('v2-salida-centavos', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'Cobrar hasta el último peso después de una salida baja el ánimo.', 'Baja el ánimo', 'Es justo'),
  ('v2-salida-cancela', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'Cancelar el mismo día debería tener multa social.', 'Debería', 'Exageran'),
  ('v2-salida-se-va', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'El que se va temprano del boliche no se la banca.', 'No se la banca', 'Sabe irse'),
  ('v2-salida-cuenta', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'El que propone irse debería ayudar a cerrar la cuenta.', 'Debería ayudar', 'No le toca'),
  ('v2-salida-extra', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'Caer con alguien extra sin avisar cambia el plan para todos.', 'Lo cambia', 'No tanto'),
  ('v2-salida-destino', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'Quien organiza la previa gana un voto extra para elegir destino.', 'Gana un voto', 'Se vota igual'),
  ('v2-salida-bar-caro', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'Elegir un bar caro sabiendo que alguien no llega es mala leche.', 'Es mala leche', 'Cada uno decide'),
  ('v2-salida-pedido', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'Pedir lo más caro en una cuenta compartida se avisa antes.', 'Se avisa', 'No hace falta'),
  ('v2-salida-foto-irse', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'neutral', 'Pedir foto grupal cuando todos se quieren ir es abuso.', 'Es abuso', 'Es tradición'),
  ('v2-salida-hombre-cuenta', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que se hace el distraído con la cuenta es cómodo.', 'Es cómodo', 'No le toca pagar'),
  ('v2-salida-hombre-billetera', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que siempre “se olvidó la billetera” ya lo planeó.', 'Ya lo planeó', 'Le pasa'),
  ('v2-salida-hombre-llega', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que llega tarde y pide el mejor lugar se pasa.', 'Se pasa', 'Es práctico'),
  ('v2-salida-mujer-boliche', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que llega tarde y quiere elegir el boliche se pasa.', 'Se pasa', 'Tiene derecho'),
  ('v2-salida-mujer-pedido', 'Salidas, previa, boliche y plata', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que pide caro y después divide exacto no se puede quejar.', 'No se puede quejar', 'Es su plata'),
  ('v2-salida-uber', 'Salidas, previa, boliche y plata', 'bardo', 'reserve', 'neutral', 'Quien pide el Uber debería esperar a que todos estén listos.', 'Debería esperar', 'Que se suban'),
  ('v2-salida-lista', 'Salidas, previa, boliche y plata', 'bardo', 'reserve', 'neutral', 'Llegar primero no te da derecho a guardar toda la mesa.', 'No te da derecho', 'Llegó primero'),
  ('v2-salida-previa-casa', 'Salidas, previa, boliche y plata', 'bardo', 'reserve', 'neutral', 'Hacer previa en casa ajena obliga a dejar algo en orden.', 'Obliga', 'Es una juntada'),
  ('v2-salida-hombre-propina', 'Salidas, previa, boliche y plata', 'bardo', 'reserve', 'dirigida_a_hombres', 'Un hombre que discute la propina por monedas quiere tener razón.', 'Quiere tener razón', 'Cuida su plata'),
  ('v2-salida-mujer-foto', 'Salidas, previa, boliche y plata', 'bardo', 'reserve', 'dirigida_a_mujeres', 'Una mujer que frena al grupo por fotos decide por todos.', 'Decide por todos', 'Pide dos minutos'),
  ('v2-vida-home-office', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'Pedir home office y no responder en todo el día es abusarse.', 'Es abusarse', 'Trabaja igual'),
  ('v2-vida-trabajo-grupo', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'El que no apareció en el trabajo grupal no puede corregir al final.', 'No puede', 'Puede opinar'),
  ('v2-vida-cocina', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'El que cocina no debería lavar ni un plato.', 'No debería', 'Lava igual'),
  ('v2-vida-viaje-itinerario', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'Armar un viaje minuto a minuto mata la improvisación.', 'Mata el viaje', 'Evita caos'),
  ('v2-vida-platos', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'Dejar platos en remojo no cuenta como lavar.', 'No cuenta', 'Cuenta igual'),
  ('v2-vida-alquiler', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'En convivencia, quien usa más el living no paga más alquiler.', 'No paga más', 'Debería aportar'),
  ('v2-vida-parcial', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'Estudiar toda la noche antes de un parcial es puro pánico.', 'Es puro pánico', 'Es necesario'),
  ('v2-vida-viaje-demora', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'Demorar una excursión obliga a invitar algo después.', 'Obliga', 'No compensa'),
  ('v2-vida-camara', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'neutral', 'Tener cámara apagada obliga a responder cuando te nombran.', 'Obliga', 'No cambia nada'),
  ('v2-vida-hombre-ultimo', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que deja todo para último momento espera que alguien lo salve.', 'Espera rescate', 'Funciona así'),
  ('v2-vida-hombre-casa', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'dirigida_a_hombres', 'Un hombre que usa “estoy ocupado” para no colaborar se hace el boludo.', 'Se hace el boludo', 'Tiene sus tiempos'),
  ('v2-vida-mujer-itinerario', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que arma un viaje minuto a minuto mata la improvisación.', 'Mata el viaje', 'Evita caos'),
  ('v2-vida-mujer-grupo', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que hace toda la portada no debería hacer menos del resto.', 'Debería hacer menos', 'Hace igual'),
  ('v2-vida-mujer-platos', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'active', 'dirigida_a_mujeres', 'Una mujer que ordena cosas ajenas sin preguntar cruza una línea.', 'Cruza una línea', 'Está ayudando'),
  ('v2-vida-mudanza', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'reserve', 'neutral', 'Ayudar en una mudanza da derecho a elegir la comida.', 'Da derecho', 'No tiene relación'),
  ('v2-vida-vacaciones', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'reserve', 'neutral', 'Despertar temprano a todos en vacaciones es abuso.', 'Es abuso', 'Hay que aprovechar'),
  ('v2-vida-compras', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'reserve', 'neutral', 'El que compra para todos no tiene que perseguir transferencias.', 'No tiene que', 'Le toca insistir'),
  ('v2-vida-reunion', 'Convivencia, facultad, trabajo, viajes y vida adulta', 'bardo', 'reserve', 'neutral', 'Mandar un mensaje de trabajo fuera de horario puede esperar.', 'Puede esperar', 'Se responde')
on conflict (id) do update set
  category=excluded.category,
  intensity=excluded.intensity,
  status=excluded.status,
  audience_type=excluded.audience_type,
  text=excluded.text,
  side_a=excluded.side_a,
  side_b=excluded.side_b;

-- La semilla combina sala, ciclo e ID: la posición en un archivo no decide
-- qué carta aparece. Los cinco IDs más recientes quedan al final si existen
-- alternativas y se usan primero activas, luego reserva y finalmente repetición.
create or replace function public.build_prompt_deck(
  p_room uuid,
  p_intensity text,
  p_stage text,
  p_history text[] default '{}'::text[],
  p_cycle integer default 1
) returns text[] language sql stable security definer set search_path=public as $$
  with candidates as (
    select p.id,
      case when p.id=any(coalesce(p_history,'{}'::text[])) then 1 else 0 end as delayed,
      md5(p_room::text||':'||p_intensity||':'||p_stage||':'||p_cycle::text||':'||p.id) as sort_key
    from public.prompts p
    where p.intensity=p_intensity
      and p.status<>'archived'
      and (
        (p_stage='active' and p.status='active')
        or (p_stage='reserve' and p.status='reserve')
        or (p_stage='repeat' and p.status in ('active','reserve'))
      )
  )
  select coalesce(array_agg(id order by delayed,sort_key),array[]::text[]) from candidates
$$;

create or replace function public.deal_prompt(p_room uuid,p_intensity text) returns text language plpgsql security definer set search_path=public as $$
declare d public.prompt_decks; chosen text; chosen_position integer; last_category text; recent text[]; displaced text; has_playable boolean; exhausted boolean;
begin
  select * into d from public.prompt_decks where room_id=p_room and intensity=p_intensity for update;
  if not found then
    insert into public.prompt_decks(room_id,intensity,deck,cursor,history,cycle,stage)
      values(p_room,p_intensity,public.build_prompt_deck(p_room,p_intensity,'active','{}'::text[],1),0,'{}'::text[],1,'active')
      returning * into d;
  end if;

  loop
    select exists(
      select 1 from generate_subscripts(d.deck,1) i
      join public.prompts p on p.id=d.deck[i]
      where i>d.cursor and p.status<>'archived'
    ) into has_playable;
    exit when has_playable;

    exhausted:=d.cursor>=coalesce(array_length(d.deck,1),0);
    if exhausted then
      d.stage:=case when d.stage='active' then 'reserve' else 'repeat' end;
      d.cycle:=d.cycle+1;
    end if;
    d.deck:=public.build_prompt_deck(p_room,p_intensity,d.stage,d.history,d.cycle);
    d.cursor:=0;
    if coalesce(array_length(d.deck,1),0)=0 then
      if d.stage='active' then d.stage:='reserve'; d.cycle:=d.cycle+1;
      elsif d.stage='reserve' then d.stage:='repeat'; d.cycle:=d.cycle+1;
      else raise exception 'No hay consignas disponibles para %',p_intensity;
      end if;
      d.deck:=public.build_prompt_deck(p_room,p_intensity,d.stage,d.history,d.cycle);
    end if;
    update public.prompt_decks set deck=d.deck,cursor=d.cursor,history=d.history,cycle=d.cycle,stage=d.stage where room_id=p_room and intensity=p_intensity;
  end loop;

  recent:=case when coalesce(array_length(d.history,1),0)>0
    then d.history[greatest(array_length(d.history,1)-4,1):array_length(d.history,1)] else array[]::text[] end;
  select category into last_category from public.prompts where id=d.history[array_length(d.history,1)];

  select d.deck[i],i into chosen,chosen_position
  from generate_subscripts(d.deck,1) i join public.prompts p on p.id=d.deck[i]
  where i>d.cursor and p.status<>'archived' and not(d.deck[i]=any(recent)) and p.category is distinct from last_category
  order by i limit 1;
  if chosen is null then
    select d.deck[i],i into chosen,chosen_position
    from generate_subscripts(d.deck,1) i join public.prompts p on p.id=d.deck[i]
    where i>d.cursor and p.status<>'archived' and not(d.deck[i]=any(recent))
    order by i limit 1;
  end if;
  if chosen is null then
    select d.deck[i],i into chosen,chosen_position
    from generate_subscripts(d.deck,1) i join public.prompts p on p.id=d.deck[i]
    where i>d.cursor and p.status<>'archived'
    order by i limit 1;
  end if;
  if chosen is null then raise exception 'No hay consignas disponibles para %',p_intensity; end if;

  displaced:=d.deck[d.cursor+1];
  d.deck[d.cursor+1]:=chosen;
  d.deck[chosen_position]:=case when chosen_position=d.cursor+1 then chosen else displaced end;
  d.cursor:=d.cursor+1;
  d.history:=array_append(d.history,chosen);
  update public.prompt_decks set deck=d.deck,cursor=d.cursor,history=d.history,cycle=d.cycle,stage=d.stage where room_id=p_room and intensity=p_intensity;
  return chosen;
end $$;

-- Revancha conserva las rondas anteriores y evita las cinco consignas recién
-- jugadas cuando el catálogo ofrece alternativas suficientes.
create or replace function public.rematch(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; pid uuid; new_room uuid; generated text; attempts integer:=0; previous_five text[];
begin
  select * into r from public.assert_live_room(rid);
  select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'Sólo el host puede pedir revancha'; end if;
  if r.phase<>'finished' then raise exception 'La revancha se habilita al terminar'; end if;
  update public.players set last_seen_at=now() where id=pid;
  select coalesce(array_agg(prompt_id order by number),array[]::text[]) into previous_five
  from (select prompt_id,number from public.rounds where room_id=rid order by number desc limit 5) recent;
  loop
    generated:=array_to_string(array(select substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',floor(random()*32)::integer+1,1) from generate_series(1,8)), '');
    begin insert into public.rooms(code,intensity) values(generated,r.intensity) returning id into new_room; exit;
    exception when unique_violation then attempts:=attempts+1; if attempts>=5 then raise exception 'No se pudo generar un código único'; end if;
    end;
  end loop;
  insert into public.players(room_id,auth_user_id,nickname,is_host,score,jury_rounds,active_from_round,last_seen_at)
    select new_room,p.auth_user_id,p.nickname,p.id=pid,0,0,1,now() from public.players p
    where p.room_id=rid and p.last_seen_at>=now()-interval '20 seconds';
  update public.rooms set host_player_id=(select id from public.players where room_id=new_room and auth_user_id=auth.uid()) where id=new_room;
  insert into public.prompt_decks(room_id,intensity,deck,cursor,history,cycle,stage)
    select new_room,x,public.build_prompt_deck(new_room,x,'active',previous_five,1),0,previous_five,1,'active'
    from unnest(array['tranqui','bardo']) x;
  update public.rooms set successor_room_id=new_room where id=rid;
  insert into public.events(room_id,player_id,name,metadata) values(rid,pid,'rematch_started',jsonb_build_object('new_room_code',generated));
  perform public.notify_room(rid);
  return public.get_room_snapshot(generated);
end $$;

-- Sobrescribe las RPC de Hito 5 con las mismas métricas, evitando depender de
-- una instalación previa de un archivo mal pegado y sin abrir RLS.
create or replace function public.start_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; pid uuid;
begin
  select * into r from public.assert_live_room(rid); select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'Sólo el host puede empezar'; end if;
  if r.phase<>'lobby' then raise exception 'La partida ya empezó'; end if;
  if (select count(*) from public.players where room_id=rid) not between 3 and 8 then raise exception 'Se necesitan entre tres y ocho jugadores'; end if;
  perform public.start_new_round(rid);
  insert into public.events(room_id,player_id,name,metadata) values(rid,pid,'game_started',jsonb_build_object('player_count',(select count(*) from public.players where room_id=rid),'intensity',r.intensity));
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.start_round(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current_phase text; pid uuid;
begin
  select * into r from public.assert_live_room(rid); select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'Sólo el host puede continuar'; end if;
  if r.phase<>'playing' then raise exception 'La partida no está activa'; end if;
  select phase into current_phase from public.rounds where room_id=rid order by number desc limit 1;
  if current_phase is distinct from 'results' then raise exception 'Primero terminá la ronda actual'; end if;
  if r.round_count>=5 then
    update public.rooms set phase='finished' where id=rid;
    insert into public.events(room_id,player_id,name) values(rid,pid,'game_finished');
    perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
  end if;
  perform public.start_new_round(rid); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.track_event(p_room_id text,p_name text) returns void language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); pid uuid;
begin
  perform public.assert_live_room(rid);
  if p_name<>'whatsapp_share_clicked' then raise exception 'Evento no permitido'; end if;
  select public.viewer_player(rid) into pid;
  insert into public.events(room_id,player_id,name) values(rid,pid,p_name);
end $$;

create or replace function public.confirm_prompt_change(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current_round public.rounds; next_prompt text; skipped_prompt text;
begin
  select * into r from public.assert_live_room(rid);
  if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host confirma el cambio'; end if;
  select * into current_round from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current_round.phase<>'debating' then raise exception 'No hay un debate activo'; end if;
  if not exists(select 1 from public.prompt_change_requests where round_id=current_round.id) then raise exception 'No hay solicitud pendiente'; end if;
  skipped_prompt:=current_round.prompt_id;
  next_prompt:=public.deal_prompt(rid,r.intensity);
  update public.rounds set prompt_id=next_prompt,ends_at=now()+interval '60 seconds' where id=current_round.id;
  delete from public.prompt_change_requests where round_id=current_round.id;
  insert into public.events(room_id,name,metadata) values(rid,'prompt_skipped',jsonb_build_object('prompt_id',skipped_prompt));
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

revoke execute on function public.build_prompt_deck(uuid,text,text,text[],integer),public.deal_prompt(uuid,text) from public, anon, authenticated;
grant execute on function public.rematch(text),public.start_game(text),public.start_round(text),public.track_event(text,text),public.confirm_prompt_change(text) to authenticated;
