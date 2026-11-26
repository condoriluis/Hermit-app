---
name: video-crimen
description: Hace un video de misterio, true crime o caso real sin resolver, vertical (TikTok, Reels, Shorts) u horizontal (YouTube). Un expediente en video con fotos de expedientes, mapas interactivos, recortes de periódicos de la época, efectos de audio de ambiente tenso, narración misteriosa y preguntas abiertas al público. Úsala cuando pidan un caso real, un misterio o un video de true crime.
---

# Misterio y Crimen

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

El caso real contado como expediente audiovisual: evidencia, cronología y las preguntas que quedan abiertas.

- **Atmósfera inmersiva y fría:** Iluminación en clave baja, tonos fríos o sepia vintage, efecto de grano sutil de película y viñetas oscuras en los bordes — la firma del estilo va sobre todo el material, siempre.
- **Evidencia tangible:** Mapas satelitales con pines que señalan el lugar de los hechos, recortes de noticias reales de la prensa, fotografías de archivo con fechas precisas sobrepuestas.
- **Narrativa de tensión:** Comienza con la última vez que se supo algo ("A las 11:42 PM de un martes de lluvia..."), sigue la cronología y expone las teorías principales.
- **Diseño sonoro inquietante:** Drones graves de fondo, sonido de proyector o máquinas de escribir al mostrar fechas, y silencios repentinos en giros desconcertantes.

## Lo que el usuario pidió y no se negocia

- **Respeto y rigor:** Cero morbo gratuito; los hechos, nombres y fechas deben corresponder a registros periodísticos o judiciales reales, anotados en `fuentes/caso.md`.
- **Efecto cliffhanger:** Termina planteando las preguntas o teorías que siguen abiertas, invitando al debate en los comentarios.
- **Derechos:** nada de imágenes de víctimas ni de personas identificables sin licencia registrada; el material de archivo entra con su fuente, anotada en `fuentes/caso.md`.
- El proyecto va en la carpeta de la línea `Carpeta:` del mensaje (úsala tal cual, no depende de dónde estés). Sin ella, `crimen-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920, TikTok, Reels, Shorts): los mapas y documentos se adaptan en vertical con zoom en los párrafos clave; subtítulos en blanco con contorno marcado y la palabra activa en ámbar. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): tablero de investigación panorámico, líneas de tiempo y documentos a doble página; el karaoke baja a la franja baja al 10 % del alto. La portada no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md) — se hace con `--fuente <base>/assets/fonts/CourierPrime-Bold.ttf --color "#ffb042"`.

## Pasos

1. **Crear el proyecto:** `python -I -B -X utf8 <skill>/scripts/nuevo.py <carpeta> [--vertical]`
   Crea la estructura con plantilla Remotion, enlaza `node_modules` compartido y copia los tokens del estilo (`public/assets/crimen/`).
2. **Investigación y guion:** En `fuentes/caso.md` la cronología comprobada del caso (nombres, fechas y lugares con su fuente). En `guion.md`: gancho con la hora/fecha del incidente, desglose de los hechos y cierre con las interrogantes (las líneas en negrita son textos en pantalla, no narración).
3. **Voz:** La voz se genera en `fuentes/voz/` (o `public/voz.wav`/`voz.wav` como rutas viejas) con `generar_voz` de AI Studio o TTS, masterizada a −14 LUFS (`masterizar.mjs` de video-base). Una voz grave y pausada sienta el expediente.
4. **Escenas:** En `escenas.json`: `formato` y `escenas` — cada escena con la `palabra` del guion donde entra, su `look` y su `material`, una lista de 1 a 4 cosas que se reparten el tramo en partes iguales:
   - `{"foto": "<ruta o referencia>", "pie": "<leyenda>"}` — la foto va como pieza del expediente: marco con borde y sombra, paneo Ken Burns centrado que entra o sale en zoom alternando por tramo, y si trae `pie` (hasta 80 caracteres) la leyenda Courier Prime en ámbar abajo a la izquierda — la fecha y el lugar sobrepuestos, como en los créditos del género. `pie` solo va en `foto`.
   - `{"clip": "<ruta o referencia>", "desde": <segundo>, "velocidad": <n>}` — video con paneo a pantalla completa; `velocidad` 0.6 es cámara lenta.
   - `look`: `frio` (colores apagados y fríos; es el de omisión), `sepia` (archivo vintage) o `color` (sin tratar). Sobre cualquier material van siempre el grano de película y la viñeta — no se apagan.
   - Una escena **sin `material`** es una tarjeta sobre fondo negro con el texto del expediente centrado en ámbar (`titular`, `\n` parte renglones): fechas, sellos o una frase que debe leerse sola. `look` y `titular` no van juntos.
   Las referencias las da `buscar.py` y `hacer.py` las baja con su licencia en `FUENTES.md`; el material va en `fuentes/evidencia/`.
5. **Música:** La cama de suspenso se sintetiza con el script del estilo — `python -I -B -X utf8 <skill>/scripts/musica.py public/musica.wav` desde la raíz del proyecto: toma la duración de la voz sola, es gratis y sin licencias (drone grave + motivo menor + pulso). Si el video lleva otra cama con licencia, va en `public/musica.mp3` (o `musica.mp3`, `public/musica.wav`): suena a bajo volumen debajo de la voz, con entrada y salida en fundido y ducking.
6. **Montaje y render:** `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`.
   - `--revisa`: valida `escenas.json` en un segundo sin red ni voz (forma, `palabra` en orden en el guion, referencias bien formadas).
   - En la corrida completa: baja la evidencia una vez por URL, transcribe la voz (`revision/transcripcion.json`), mezcla la voz con los efectos del estilo y la música masterizada a −14 LUFS en `public/sonido.wav`, escribe `src/edicion.json` con el director —cada tramo de material con su `look`, el grano y la viñeta, las tarjetas ámbar, el karaoke Courier Prime en capas, y el bloque `sonido` de pistas separadas (voz, música en loop con su ducking y cada efecto en su golpe, de los mismos `cues_de()` de la mezcla) para que el monitor en vivo las oiga y la línea de tiempo las muestre por carril— y renderiza con Remotion (`--muted`, cuadros de clips pre-sacados) muxando el audio con FFmpeg hacia `out/crimen-<nombre>.mp4`.
   - Sonido del estilo: `subtone_1` (dron grave) + `riser_1` (subida) al abrir; `clicktrain` rotando (la máquina de escribir) en cada tarjeta de expediente — que además entra como un sello que se clava (escala 1,15→1 en 0,3 s); `tick_1` (el tictac bajo) al entrar cada escena de material; `swish_1` en cada corte y más bajo en cada cambio de material; `impact_1` en la última escena. Sobrios: el peso lo ponen las pausas, no los efectos.
7. **Revisión y entrega:** Se mira `revision/hoja.png`: que la atmósfera se lea fría y polvorienta, que las fechas y sellos respiren en las tarjetas ámbar y que ninguna palabra quede tapada. Se pasa `node <base>/scripts/comprobar.mjs` al video — ojo: las tarjetas de expediente son fondo negro a propósito, así que `comprobar.mjs` marca «cuadros negros» en sus tramos y es lo esperado, no un fallo (mira que el texto de la tarjeta y el karaoke sí estén). El proyecto entregado queda limpio: `out/` solo con el mp4, voz en `fuentes/voz/`, evidencia con licencia en `FUENTES.md`. Los scripts de un solo uso van a `$TEMP` o se borran al usarlos, y nada de `README.md` ni notas de resumen en la raíz — todo lo que el proyecto conserva ya vive en su carpeta (`fuentes/`, `revision/`, `portada/`).
