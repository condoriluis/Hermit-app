---
name: publicidad
description: Hace un video de publicidad o anuncio profesional para cualquier empresa o producto (telecomunicaciones, tiendas, apps, servicios, eventos, lanzamientos), vertical (TikTok, Reels, Shorts) u horizontal (YouTube). Anatomía de anuncio real —gancho, problema, solución, beneficios, prueba, oferta y tarjeta de marca con logo, eslogan y llamada a la acción— con motion design de comercial (slam del gancho, flashes de marca, sticker de oferta, CTA con brillo), efectos de sonido, material real, voz, música y subtítulos karaoke. Úsala cuando pidan un anuncio, una publicidad, un comercial o un video para una marca o empresa.
---

# Publicidad

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md),
[`PORTADA.md`](../video-base/PORTADA.md) y [`MATERIAL.md`](../video-base/MATERIAL.md) antes de empezar.

## La esencia

Un anuncio no es un resumen: es una promesa que se demuestra y se firma. La anatomía es la de los comerciales
profesionales, en este orden:

- **Gancho (los primeros 3 segundos):** la promesa, la pregunta o el problema del espectador, dicho directo.
  Si no detiene el pulgar, nada de lo demás importa. En pantalla entra con un *slam* (cae con escala y
  tembleque) y un whoosh: es el pattern interrupt del anuncio.
- **Problema:** el dolor o la necesidad, en una o dos escenas, sin dramatizar lo que no es.
- **Solución:** el producto o servicio como respuesta, con material real de lo que se ofrece.
- **Beneficios:** qué gana el cliente, en frases cortas — una escena `beneficios` si el anuncio los necesita.
- **Prueba:** por qué creerle — datos, cifras, demostración o testimonio. Cada claim con su fuente en
  `fuentes/investigacion.md`.
- **Oferta:** precio, descuento o ventaja concreta si existe — escena `oferta` con su `oferta` (el sticker
  del color de marca: «-30% HOY», «2X1», «ENVÍO GRATIS»).
- **Cierre:** la tarjeta de marca — logo oficial con su halo del color de marca, eslogan y llamada a la
  acción (CTA) en píldora con brillo, más el `sitio` si `marca.json` lo trae. Es el único momento donde la
  marca manda sola en pantalla.

El anuncio entero dura lo que la voz dice (típico 20–40 s en vertical): cada escena es un beat del guion, no un
capítulo. Una escena es un `tipo` del anuncio; las del medio pueden ser `problema`, `solucion`, `beneficios`,
`prueba` u `oferta`, en el orden que pida la historia — un anuncio de 15 segundos combina beats y no necesita
todos. Lo que no se negocia es gancho primero y cierre último.

## El motion design del anuncio

La plantilla ya trae el lenguaje de los comerciales verticales — no hay que inventar animaciones:

- **Gancho:** el titular cae con escala 1,45→1, giro leve y tembleque de pantalla; whoosh en el corte.
- **Cada escena:** flash del `color` de la marca al entrar (0,14 s), **velo de lectura** (degradados
  oscuros detrás de la zona de textos y del karaoke — lo que hace legible el texto blanco sobre material
  claro: leche, cielo, paredes blancas; las tarjetas y el cierre no lo llevan porque tienen fondo propio),
  barra de progreso fina arriba durante todo el video, marca en marca de agua abajo a la izquierda y el
  tipo del beat en fantasma gigante detrás cuando la escena es tarjeta.
- **Textos:** titular en Anton y `sub` en Inter entran escalonados (sub ~0,12 s después) y «rebotan» en cada
  corte de material; debajo del titular un filete del color de marca lo subraya.
- **Subtítulos:** karaoke palabra a palabra en la franja baja, la palabra activa en `color` de la marca y
  creciendo; cortados donde empieza la tarjeta de marca.
- **Tipografía (tres voces, todas OFL):** Anton para titulares, eslogan y karaoke (la voz del anuncio);
  **Bebas Neue** para la píldora del CTA, el sticker de la oferta y el tipo fantasma (la voz «de oferta»:
  condensada, de póster y etiqueta de precio); Inter para `sub`, marca de agua y sitio (la voz de apoyo).
- **Oferta:** el sticker inclinado hace pop elástico al entrar la escena.
- **Cierre:** logo con halo del color de marca, eslogan, píldora del CTA con un brillo que la cruza una vez
  y el `sitio` debajo; riser antes, impacto+subgrave en la tarjeta y outro al final — todo en `sfx/` de la
  skill, mezclado con la voz/música por `hacer.py` en los tres modos de `sonido`.

## Lo que el usuario pidió y no se negocia

- **La marca es real o no es.** `marca.json` lleva lo que el usuario dio o lo que está verificado en la web
  oficial de la empresa: nombre, eslogan, CTA, colores y el **logo oficial en archivo** (png/jpg/webp)
  en `marca/`. Si el usuario no lo dio, se busca el logo oficial y los colores de la
  marca en su sitio — nunca se inventan ni se le pide a la IA que los redibuje: un logo deformado por IA es
  peor que ninguno. Sin logo ni eslogan verificados, el cierre lleva el nombre y el claim en texto; se dice.
- **Los claims se demuestran.** Precios, coberturas, «el mejor», «#1», fechas y cifras solo entran si están
  en `fuentes/investigacion.md` con su fuente. Si el usuario no los verificó, se proponen y se marcan como
  «a confirmar» en vez de afirmarlos.
- **Derechos y personas.** El material entra con licencia registrada en `FUENTES.md` (las referencias son las
  de [`../video-base/MATERIAL.md`](../video-base/MATERIAL.md)). No se usan fotos ni videos de personas reales
  (actores, influencers, clientes) sin permiso; el logo y la marca del cliente o del sponsor de la campaña sí
  se usan, porque son suyos. La voz nunca imita a una persona real.
- **El cierre cierra.** Un anuncio termina con marca + eslogan + CTA, no con otra escena de contenido.
- **La música puede ser la protagonista.** Si el anuncio va sobre una canción (la oficial de una campaña, un
  jingle, la que trajo el usuario), `sonido: "musica"` en `publicidad.json`: no hay voz ni subtítulos de
  karaoke — los textos en pantalla (`titular`/`sub`) cargan el mensaje y cada escena lleva `t`, el segundo
  exacto donde entra, sincronizado a mano con los golpes de la pista. Con locución encima de la canción,
  `sonido: "ambos"` (la música suena a volumen real, no de fondo). Sin `sonido`, es `"voz"` como siempre.
- El proyecto va en `<nombre>` (la ruta completa de la línea `Carpeta:` del mensaje: úsala tal cual, no depende
  de dónde estés). Sin ella, `publicidad-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los
estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920): los titulares van en el tercio superior sobre el material, el `sub`
  debajo, los subtítulos en la franja baja cuidando no tapar la interfaz de TikTok y Reels. La tarjeta de marca
  apila: logo arriba, eslogan al centro-bajo, píldora del CTA abajo. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): el titular ocupa el ancho sin encogerse, el material
  llena el cuadro y la tarjeta de marca reparte logo, eslogan y CTA en vertical con aire a los lados. La portada
  no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según
  [`PORTADA.md`](../video-base/PORTADA.md).

## Pasos

0. **Proyecto.** Se crea con `python -I -B -X utf8 <skill>/scripts/nuevo.py <nombre> [--vertical]` (el
   `--vertical` sale de la línea `Formato:` del mensaje): copia la plantilla de Remotion (`src/`,
   `package.json`…), pone las fuentes del estilo en `public/assets/pub/` y enlaza el `node_modules` compartido.
   Queda la carpeta del proyecto con `fuentes/material/`, `fuentes/flow/`, `fuentes/voz/`, `public/material/`,
   `public/marca/`, `material/`, `marca/`, `work/`, `out/` y `revision/`.
1. **Marca.** Antes de escribir nada: `marca.json` con lo verificado — nombre, eslogan, CTA, `color` y
   `fondo` (hex), `logo` (la ruta del archivo oficial) y `sitio`. Si falta algo esencial (sobre todo el logo o
   el eslogan), se pregunta al usuario en un solo mensaje con lo que ya se encontró propuesto. Los colores de
   la marca solo se ponen si están verificados en su sitio o guía de marca; sin ellos, el CTA sale blanco
   sobre oscuro. Los colores y textos de la marca entran en la edición como variables CSS: la píldora del CTA
   toma `color` con su tinta calculada, la tarjeta de marca toma `fondo` y el karaoke enciende la palabra
   activa con `color` (amarillo si la marca no trae color).
2. **Investigación.** En `fuentes/investigacion.md`: qué se vende, a quién, qué lo prueba (datos, demos,
   comparaciones honestas) y qué claims hay que confirmar. Si el anuncio es de una campaña con reglas (un
   concurso, un hashtag, una mención obligatoria), las bases y condiciones van anotadas aquí.
3. **Guion.** En `guion.md`: la narración entera con la anatomía gancho → problema → solución → prueba →
   cierre. Las líneas en negrita son los textos en pantalla (`titular`, `sub`, CTA), no se narran. El cierre se
   narra como los demás (la voz puede decir el eslogan y el CTA) y su escena no lleva `titular` si ya está en
   `marca.json`.
4. **Voz y música.** La voz se genera de forma autónoma: con `generar_voz` si el mensaje indica una voz de
   AI Studio, Fish Audio o ElevenLabs (la del mensaje manda, no se cambia por TTS), o automáticamente con TTS
   en `fuentes/voz/` sin detener el turno. Se masteriza a −14 LUFS con `node <base>/scripts/masterizar.mjs`.
   - Si el usuario trajo su propia canción o audio de campaña, va en `public/musica.mp3` (o `musica.mp3`/`.wav`).
   - Con `sonido: "musica"` no hay voz: la canción es la pista entera y los cortes de `publicidad.json` se
     marcan a mano en `t` (segundos), escuchándola — cada escena entra en un golpe o cambio de la música.
   - Con `sonido: "ambos"` la canción suena a volumen real debajo de la locución.
5. **Montaje declarativo.** En `publicidad.json`: `formato`, `sonido` si no es `"voz"`, y `escenas` — la
   primera `gancho`, la última `cierre`, el resto `problema`/`solucion`/`beneficios`/`prueba`/`oferta`
   según la historia. Cada escena con su ancla de tiempo — `palabra` del guion donde entra (con voz) o `t`
   en segundos (en modo música) —, `titular` (hasta 90 caracteres) y `sub` (hasta 80) si hacen falta,
   `oferta` (el texto del sticker, hasta 30, solo en `tipo: oferta`) si hay precio o descuento, y `material`:
   una lista de
   1 a 4 cosas que reparten su tramo, `{"foto": "<ruta o referencia>"}` (paneo Ken Burns) o `{"clip":
   "<ruta o referencia>", "desde": <segundo>, "velocidad": <n>}` (0.6 = cámara lenta). Las referencias las da
   `buscar.py` y `hacer.py` las baja con su licencia en `FUENTES.md`.
   - **Dónde vive el material.** `hacer.py` baja lo con licencia a `fuentes/material/`; lo generado en
     Flow a `fuentes/flow/`; lo que traiga el usuario o salga por otro camino, a `material/`. En
     `publicidad.json` se referencia siempre por ruta relativa al proyecto, y la etapa «Material» de la
     card muestra todo lo que haya en esas carpetas.
   - **Material generado (Flow):** si el mensaje trae `Clips: genéralos en Google Flow…` o el usuario pide
     escenas cinematográficas, los clips se generan con `generar_video` ([`../video-base/FLOW.md`](../video-base/FLOW.md))
     y se guardan en `fuentes/flow/`; en `publicidad.json` se referencian como ruta local, p. ej.
     `{"clip": "fuentes/flow/gancho.mp4", "desde": 0}`. Reglas de dirección de arte: **una sola descripción de
     estilo** escrita una vez y repetida en todos los prompts (los mismos colores de `marca.color`, la misma
     luz, el mismo tipo de cámara) para que las escenas parezcan del mismo comercial; el logo oficial **nunca**
     va dentro de un clip generado — se compone en el cierre, donde sale exacto. El audio de los clips no se
     usa: la pista del proyecto es la que manda. Si `generar_video` deja el pedido en fila, no lo esperes
     consultando: sigue con lo que no lo necesita y cierra avisando (FLOW.md).
   - Escenas sin `material`: tarjetas sobre fondo con los textos centrados (el gancho de texto puro vale).
6. **Render.** Se corre `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto>
   [--formato vertical|horizontal] [--revisa]`. Valida el proyecto en un segundo (`--revisa`, sin red ni voz):
   la anatomía, las palabras del guion en orden (o los `t` crecientes en modo música), el logo declarado y el
   material. Después hace todo: baja el material una vez por URL, la voz masterizada con la música según el
   `sonido` a `public/sonido.wav`, la edición de Remotion en `src/edicion.json` (el director pone cada tramo
   de material —foto con paneo suave, clip con su `desde` y `velocidad`—, los textos del anuncio que entran
   con fundido y subida en cada corte, la tarjeta de marca del cierre con el logo en su caja sin deformar, el
   eslogan ajustado al ancho y la píldora del CTA en el color de la marca, todo con entradas escalonadas,
   y los subtítulos karaoke en Anton con la palabra activa del `color` de la marca —capas dentro de la
   composición, cortados donde empieza la tarjeta de marca; en modo música no hay—), las pistas del sonido
   por separado en el bloque `sonido` de `edicion.json` —la voz, la música y cada efecto en su golpe, de los
   mismos `cues_de()` de la mezcla— para que el monitor en vivo las oiga y la línea de tiempo las muestre por
   carril, el render sin audio con
   los cuadros de los clips ya sacados (`cuadros_render.cjs`, `--muted`: `sonido.wav` entra después por
   ffmpeg, no por el `<Audio>` del render), la portada de primer
   fotograma en vertical y la hoja de revisión. Deja `revision/hoja.png` y `revision/tiempos.json`.
7. **Revisión.** Se mira `revision/hoja.png`: que el gancho se lea en el primer cuadro, que el titular no tape
   la cara o el producto clave del material, que la tarjeta de marca cierre con fuerza (logo nítido, eslogan
   legible, píldora del CTA que se distingue) y que en horizontal todo se lea a 480×270.
8. **Final.** El video queda en `out/publicidad-<nombre>.mp4`, solo él: los subtítulos van dentro del video
   desde el render y `sonido.wav` entra por ffmpeg, así que no hay base ni `.ass` que reenviar (como en el
   top y el documental). Se pasa `node <base>/scripts/comprobar.mjs`. En horizontal, `portada.png` es la
   miniatura de YouTube según [`PORTADA.md`](../video-base/PORTADA.md).

**El proyecto entregado queda limpio.** Al terminar bien, `hacer.py` borra las mezclas de `revision/`
(`mezcla.wav`, `audio_master.wav`, y los restos del pipeline viejo `seg-*.mp4`, `visual.mp4`, `concat.txt`,
`txt/`, `cierre-txt/` si el proyecto venía de antes: ya son el video final y se regeneran en cada corrida),
las `*.huella` del proyecto (marcas de dedup del servidor, fuera de `node_modules`) y `portada.jpg` cuando ya
está `portada.png`. La voz queda solo en `fuentes/voz/` (las copias viejas de `public/` y la raíz se mudan o
borran). Se quedan a propósito `revision/hoja.png`, `revision/tiempos.json` y `revision/transcripcion.json`
(caché de la voz), `fuentes/` (investigación, material con licencia y voz), `fuentes/flow/` (lo generado),
`material/` y `marca/` (lo traído por el usuario), `public/` (`sonido.wav`, `material/` y `marca/` con los
enlaces del render, `assets/pub/` con las fuentes), `src/edicion.json` y la línea GSAP (la edición, para el
monitor en vivo), `out/` (solo el mp4 final), `node_modules` (enlace compartido), `marca.json`,
`publicidad.json` y `FUENTES.md`. No dejes scripts ni logs sueltos en la raíz ni en `fuentes/`: lo de un solo
uso va a `$TEMP`.
