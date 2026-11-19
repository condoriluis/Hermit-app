---
name: video-crimen
description: Hace un video de misterio, true crime o caso real sin resolver, vertical (TikTok, Reels, Shorts) u horizontal (YouTube). Un expediente en video con fotos de expedientes, mapas interactivos, recortes de periódicos de la época, efectos de audio de ambiente tenso, narración misteriosa y preguntas abiertas al público. Úsala cuando pidan un caso real, un misterio o un video de true crime.
---

# Misterio y Crimen

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

El caso real contado como expediente audiovisual: evidencia, cronología y las preguntas que quedan abiertas.

- **Atmósfera inmersiva y fría:** Iluminación en clave baja, tonos fríos o sepia vintage, efecto de grano sutil de película y viñetas oscuras en los bordes.
- **Evidencia tangible:** Mapas satelitales con pines que señalan el lugar de los hechos, recortes de noticias reales de la prensa, fotografías de archivo con fechas precisas sobrepuestas.
- **Narrativa de tensión:** Comienza con la última vez que se supo algo ("A las 11:42 PM de un martes de lluvia..."), sigue la cronología y expone las teorías principales.
- **Diseño sonoro inquietante:** Drones graves de fondo, sonido de proyector o máquinas de escribir al mostrar fechas, y silencios repentinos en giros desconcertantes.

## Lo que el usuario pidió y no se negocia

- **Respeto y rigor:** Cero morbo gratuito; los hechos, nombres y fechas deben corresponder a registros periodísticos o judiciales reales, anotados en `fuentes/caso.md`.
- **Efecto cliffhanger:** Termina planteando las preguntas o teorías que siguen abiertas, invitando al debate en los comentarios.
- **Derechos:** nada de imágenes de víctimas ni de personas identificables sin licencia registrada; el material de archivo entra con su fuente, anotada en `fuentes/caso.md`.
- El proyecto va en `<nombre>` (la ruta completa de la línea `Carpeta:` del mensaje: úsala tal cual, no depende de dónde estés). Sin ella, `crimen-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920): los mapas y documentos se adaptan en vertical con zoom en los párrafos clave; subtítulos en amarillo o blanco con sombra marcada. Portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): tablero de investigación panorámico, líneas de tiempo y documentos a doble página. La portada no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md).

## Pasos

1. **Investigación.** Se compila la cronología del caso en `fuentes/caso.md` con nombres, fechas y ubicaciones comprobadas y su fuente.
2. **Guion.** En `guion.md`: gancho con la hora/fecha del incidente, desglose de los hechos y cierre con las interrogantes (las líneas en negrita son textos en pantalla, no narración).
3. **Voz.** La voz se genera de forma autónoma: con `generar_voz` si el mensaje indica una voz de AI Studio, o automáticamente con TTS en `public/voz.wav` sin detener el turno. Se masteriza con `node <base>/scripts/masterizar.mjs` a −14 LUFS.
4. **Escenas.** En `escenas.json`: cada escena con la `palabra` del guion donde entra, su `look` y su `material` — una lista de 1 a 4 cosas que se reparten el tramo en partes iguales: `{"foto": "<ruta o referencia>"}` (paneo Ken Burns) o `{"clip": "<ruta o referencia>", "desde": <segundo>, "velocidad": <n>}` (0.6 = cámara lenta). El `look` es el tratamiento de color: `frio` (el de expediente: colores apagados y fríos; es el de omisión), `sepia` (archivo vintage) o `color` (sin tratar); sobre cualquier material van siempre el grano de película y la viñeta. Los documentos, recortes de prensa y fotos de archivo van en `fuentes/evidencia/` y entran como rutas; las referencias de banco (`mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de video) las da `buscar.py` y `hacer.py` las baja con su licencia en `FUENTES.md`. Una escena **sin `material`** es una tarjeta sobre fondo negro con el texto del expediente centrado en ámbar (`titular`, `\n` parte renglones): fechas, sellos o una frase que debe leerse sola.
5. **Música.** Si el video la lleva, el ambiente de tensión (dron grave, máquina de escribir, silencio que pesa) va en `public/musica.mp3` (o `musica.mp3`, `public/musica.wav`): suena a bajo volumen debajo de la voz, con entrada y salida en fundido.
6. **Render.** Se corre `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`. Valida el proyecto en un segundo (`--revisa`, sin red ni voz), baja el material una vez por URL, y hace el resto: los tramos con su `look` y el ambiente visual, la voz masterizada con la música, los subtítulos karaoke en **Courier Prime** (`subtitulos.py --estilo crimen`, blanco con contorno y la palabra activa en ámbar) y la portada de primer fotograma en vertical. Deja `revision/hoja.png` y `revision/tiempos.json`.
7. **Revisión y Final.** Se mira `revision/hoja.png`: que la atmósfera se lea fría y polvorienta, que las fechas y sellos respiren en las tarjetas y que ninguna palabra quede tapada. El video queda en `out/crimen-<nombre>.mp4` (el `_crimen-<nombre>-base.mp4` de la misma carpeta es el video sin subtítulos, por si hay que re-subtitular). En horizontal, `portada.png` es la miniatura de YouTube según [`PORTADA.md`](../video-base/PORTADA.md) con `--fuente <base>/assets/fonts/CourierPrime-Bold.ttf --color "#ffb042"`.

