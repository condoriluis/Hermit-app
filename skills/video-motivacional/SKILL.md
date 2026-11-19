---
name: video-motivacional
description: Hace un video motivacional o de desarrollo y disciplina, vertical (TikTok, Reels, Shorts) u horizontal (YouTube). En lote, con clips cinematográficos en cámara lenta (entrenamiento, paisajes desérticos o urbanos oscuros, estatuas clásicas, lluvia), voz grave y pausada, música épica o de piano progresivo, y citas contundentes con subtítulos minimalistas. Úsala cuando pidan un video motivacional, de estoicismo o mentalidad.
---

# Motivacional

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

Un formato centrado en la emoción pura, la pausa dramática y la estética cinematográfica sobria.

- **Cadencia reflexiva:** La voz no habla rápido; hace pausas de 0,5 a 1 s entre reflexiones para permitir que la música y la imagen calen.
- **Visual cinematográfico sombrío:** Imágenes en blanco y negro o desaturadas con alto contraste (estatuas de mármol, figuras solitarias en la niebla, entrenamiento silencioso).
- **Música que construye:** Una pista de piano o ambiente orquestal que empieza sutil y alcanza un clímax en la última frase.
- **Tipografía sobria:** Subtítulos limpios, sin colores estridentes; blanco puro sobre fondo oscuro, con palabras clave en mayúsculas sutiles.

## Lo que el usuario pidió y no se negocia

- **Cero clichés vacíos:** El mensaje debe transmitir peso emocional y psicológico real, inspirado en estoicismo, disciplina o superación genuina.
- **Audio cinematográfico:** Mezcla impecable donde la voz se sienta profunda y presente por encima de la música.
- **Derechos:** el material entra con licencia registrada: las referencias son las de [`../video-base/MATERIAL.md`](../video-base/MATERIAL.md) (`mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de video; los bancos los busca `video-documental/scripts/buscar.py`); nada de personas reales generadas con IA.
- El proyecto va en `<nombre>` (la ruta completa de la línea `Carpeta:` del mensaje: úsala tal cual, no depende de dónde estés). Sin ella, `motivacional-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920): encuadre centrado o en tercios verticales, subtítulos al tercio inferior con margen de seguridad respecto a los botones laterales de las redes. Portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): cinematografía 16:9 con espacio para barras sutiles o encuadres anamórficos. La portada no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md).

## Pasos

1. **Tema.** Se define el ángulo o la enseñanza estoica/motivacional en `fuentes/tema.md`.
2. **Guion.** En `guion.md`: frases de impacto, pausas anotadas y remate contundente (las líneas en negrita son textos en pantalla, no narración).
3. **Voz.** La voz se genera de forma autónoma: con `generar_voz` si el mensaje indica una voz de AI Studio, o automáticamente con TTS en `public/voz.wav` sin detener el turno. Se masteriza con `node <base>/scripts/masterizar.mjs` a −14 LUFS.
4. **Escenas.** En `escenas.json`: cada escena con la `palabra` del guion donde entra, su `look` y su `material` — una lista de 1 a 4 cosas que se reparten el tramo en partes iguales: `{"foto": "<ruta o referencia>"}` (paneo Ken Burns) o `{"clip": "<ruta o referencia>", "desde": <segundo>, "velocidad": <n>}` (0.6 = cámara lenta). El `look` es el tratamiento de color: `bn` (blanco y negro de contraste), `desaturado` (el de serie: colores apagados y contraste alto; es el de omisión) o `color` (sin tratar). Una escena **sin `material`** es una tarjeta sobre fondo negro con la cita centrada (`titular`, `\n` parte renglones): sirve para el gancho o una frase que debe leerse sola. Las referencias las da `buscar.py` y `hacer.py` las baja con su licencia en `FUENTES.md`; el material va en `fuentes/material/` con tratamiento de color oscuro ya aplicado o lo pone el `look`.
5. **Música.** Si el video la lleva, el tema épico o de piano progresivo va en `public/musica.mp3` (o `musica.mp3`, `public/musica.wav`): suena a bajo volumen debajo de la voz, con entrada y salida en fundido.
6. **Render.** Se corre `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`. Valida el proyecto en un segundo (`--revisa`, sin red ni voz), baja el material una vez por URL, y hace el resto: los tramos con su `look`, la voz masterizada con la música, los subtítulos karaoke en **Bebas Neue** (`subtitulos.py --estilo minimal`, blanco puro palabra a palabra) y la portada de primer fotograma en vertical. Deja `revision/hoja.png` y `revision/tiempos.json`.
7. **Revisión y Final.** Se mira `revision/hoja.png`: ritmo de las pausas, que el look se lea (sombrío, nunca chillón) y que los subtítulos respiren en la franja baja. El video queda en `out/motivacional-<nombre>.mp4` (el `-base.mp4` de la misma carpeta es el video sin subtítulos, por si hay que re-subtitular). Se pasa `node <base>/scripts/comprobar.mjs`. En horizontal, `portada.png` es la miniatura de YouTube según [`PORTADA.md`](../video-base/PORTADA.md) con `--fuente <base>/assets/fonts/BebasNeue-Regular.ttf --color "#fff4e6"`.

