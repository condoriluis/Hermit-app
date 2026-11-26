---
name: video-motivacional
description: Hace un video motivacional o de desarrollo y disciplina, vertical (TikTok, Reels, Shorts) u horizontal (YouTube). En lote, con clips cinematográficos en cámara lenta (entrenamiento, paisajes desérticos o urbanos oscuros, estatuas clásicas, lluvia), voz grave y pausada, música épica o de piano progresivo, y citas contundentes con subtítulos minimalistas. Úsala cuando pidan un video motivacional, de estoicismo o mentalidad.
---

# Motivacional

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md), [`MATERIAL.md`](../video-base/MATERIAL.md)
y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

Un formato centrado en la emoción pura, la pausa dramática y la estética cinematográfica sobria.

- **Cadencia reflexiva:** La voz no habla rápido; hace pausas de 0,5 a 1 s entre reflexiones para permitir que la música y la imagen calen.
- **Visual cinematográfico sombrío:** Imágenes en blanco y negro o desaturadas con alto contraste (estatuas de mármol, figuras solitarias en la niebla, entrenamiento silencioso).
- **Música que construye:** Una pista de piano o ambiente orquestal que empieza sutil y alcanza un clímax en la última frase.
- **Tipografía sobria:** Subtítulos limpios, sin colores estridentes; blanco puro sobre fondo oscuro, con la palabra activa en un blanco apenas más cálido.

## Lo que el usuario pidió y no se negocia

- **Cero clichés vacíos:** El mensaje debe transmitir peso emocional y psicológico real, inspirado en estoicismo, disciplina o superación genuina.
- **Audio cinematográfico:** Mezcla impecable donde la voz se sienta profunda y presente por encima de la música.
- **Derechos:** el material entra con licencia registrada: las referencias son las de [`../video-base/MATERIAL.md`](../video-base/MATERIAL.md) (`mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de video; los bancos los busca `video-documental/scripts/buscar.py`); nada de personas reales generadas con IA.
- El proyecto va en la carpeta de la línea `Carpeta:` del mensaje (úsala tal cual, no depende de dónde estés). Sin ella, `motivacional-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920, TikTok, Reels, Shorts): encuadre centrado o en tercios verticales, karaoke al 21 % de la altura desde abajo con margen de seguridad respecto a los botones laterales de las redes. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): cinematografía 16:9 con espacio para encuadres anamórficos; el karaoke baja a la franja baja al 10 % del alto. La portada no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md).

## Pasos

1. **Crear el proyecto:** `python -I -B -X utf8 <skill>/scripts/nuevo.py <carpeta> [--vertical]`
   Crea la estructura con plantilla Remotion, enlaza `node_modules` compartido y copia los tokens del estilo (`public/assets/motivacional/`).
2. **Tema y guion:** En `fuentes/tema.md` el ángulo o la enseñanza estoica/motivacional. En `guion.md`: frases de impacto, pausas anotadas y remate contundente (las líneas en negrita son textos en pantalla, no narración).
3. **Voz:** La voz se genera en `fuentes/voz/` (o `public/voz.wav`/`voz.wav` como rutas viejas) con `generar_voz` de AI Studio o TTS, masterizada a −14 LUFS (`masterizar.mjs` de video-base).
4. **Escenas:** En `escenas.json`: `formato` y `escenas` — cada escena con la `palabra` del guion donde entra, su `look` y su `material`, una lista de 1 a 4 cosas que se reparten el tramo en partes iguales:
   - `{"foto": "<ruta o referencia>"}` — paneo Ken Burns centrado que entra o sale en zoom, alternando por tramo.
   - `{"clip": "<ruta o referencia>", "desde": <segundo>, "velocidad": <n>}` — video con paneo; `velocidad` 0.6 es cámara lenta.
   - `look`: `bn` (blanco y negro de contraste), `desaturado` (colores apagados y contraste alto; es el de omisión) o `color` (sin tratar).
   - Una escena **sin `material`** es una tarjeta sobre fondo negro con la cita centrada (`titular`, `\n` parte renglones): sirve para el gancho o una frase que debe leerse sola. `look` y `titular` no van juntos.
   Las referencias las da `buscar.py` y `hacer.py` las baja con su licencia en `FUENTES.md`; el material va en `fuentes/material/`.
5. **Música:** Si el video la lleva, el tema épico o de piano progresivo va en `public/musica.mp3` (o `musica.mp3`, `public/musica.wav`): suena a bajo volumen debajo de la voz, con entrada y salida en fundido y ducking.
6. **Montaje y render:** `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`.
   - `--revisa`: valida `escenas.json` en un segundo sin red ni voz (forma, `palabra` en orden en el guion, referencias bien formadas).
   - En la corrida completa: baja el material una vez por URL, transcribe la voz (`revision/transcripcion.json`), mezcla la voz con los efectos del estilo (`sfx/`) y la música masterizada a −14 LUFS en `public/sonido.wav`, escribe `src/edicion.json` con el director —cada tramo de material con su `look`, las tarjetas de cita, el karaoke en capas, y el bloque `sonido` de pistas separadas (voz, música en loop con su ducking y cada efecto en su golpe, de los mismos `cues_de()` de la mezcla) para que el monitor en vivo las oiga y la línea de tiempo las muestre por carril— y renderiza con Remotion (`--muted`, cuadros de clips pre-sacados) muxando el audio con FFmpeg hacia `out/motivacional-<nombre>.mp4`.
   - Sonido del estilo: `swish_1` en cada corte de escena y, más bajo, en cada cambio de material; `subboom_1` al entrar cada tarjeta de cita. Sobrios: el formato se juega en las pausas, no en los efectos.
7. **Revisión y entrega:** Se mira `revision/hoja.png`: ritmo de las pausas, que el `look` se lea (sombrío, nunca chillón), que las citas respiren centradas y que el karaoke no tape nada. Se pasa `node <base>/scripts/comprobar.mjs` al video — ojo: las tarjetas de cita son fondo negro a propósito, así que `comprobar.mjs` marca «cuadros negros» en sus tramos y es lo esperado, no un fallo (mira que el texto de la cita y el karaoke sí estén). El proyecto entregado queda limpio: `out/` solo con el mp4, voz en `fuentes/voz/`, material con licencia en `FUENTES.md`. Los scripts de un solo uso van a `$TEMP` o se borran al usarlos, y nada de `README.md` ni notas de resumen en la raíz — todo lo que el proyecto conserva ya vive en su carpeta (`fuentes/`, `revision/`, `portada/`).
