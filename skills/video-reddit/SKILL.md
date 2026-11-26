---
name: video-reddit
description: Hace un video de historia de Reddit o relato de internet, vertical (TikTok, Reels, Shorts) u horizontal (YouTube). La narración de un hilo viral con voz IA sobre fondo inmersivo (gameplay de parkour, Minecraft, cocina relajante o tomas aéreas), la tarjeta vectorial nativa de Reddit al inicio animada con sonido pop, subtítulos dinámicos palabra por palabra al centro en Varela Round con acento naranja (#FF4500) y música sutil de fondo. Úsala cuando pidan un video de Reddit, una historia de internet o un relato narrado en lote.
---

# Historia de Reddit

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

Formato faceless en lote con identidad visual de Reddit. Tres elementos lo sostienen:

- **El gancho visual y contextual:** Los primeros 3 segundos enseñan la tarjeta exacta y nativa del post de Reddit (subreddit, usuario, tiempo, título y votos) animada con escala y sonido pop/notificación mientras se lee la primera frase de impacto.
- **Fondo hipnótico continuo:** Un video de fondo agradable y sin distracciones (gameplay fluido, satisfacción visual, tomas aéreas) que no compite con el relato pero mantiene la vista atrapada, complementado con una viñeta suave para contraste óptimo.
- **Subtítulos palabra por palabra:** En **Varela Round** (la tipografía redonda del hilo), texto animado al centro con la palabra activa que se enciende en **naranja Reddit #FF4500** y micro-escala, sincronizado cuadro a cuadro con la voz narrada. Sin archivos `.ass` externos: los subtítulos y la tarjeta se renderizan como capas nativas dentro de la composición Remotion.

## Lo que el usuario pidió y no se negocia

- **Autónomo y en lote:** Todo se genera y ensambla de principio a fin. La voz sale de AI Studio (o TTS) y el fondo de la biblioteca de clips con licencia de [`../video-base/MATERIAL.md`](../video-base/MATERIAL.md).
- **El fondo se declara:** `material.json` con `{"fondo": "<referencia>"}` (`mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de video; las referencias las da `video-documental/scripts/buscar.py`). `hacer.py` lo baja con su licencia anotada en `FUENTES.md`; también vale un `public/fondo.mp4` ya puesto.
- **La tarjeta es nativa:** Se declara en `post.json` (o `fuentes/tema/post.md`). La plantilla Remotion dibuja la tarjeta exacta en HTML/SVG con su icono oficial, subreddit, autor, título y la barra de acciones de Reddit (upvote/downvote con votos, comentarios, compartir y guardar). `post.json` admite además `tema` (`"claro"` para la tarjeta con la paleta clara de la app; sin él o `"oscuro"` va la oscura) y `verificado` (`true` pone la insignia azul de cuenta verificada junto al autor).
- **El gancho no se salta:** La primera frase debe plantear el dilema ("¿Hice mal al cancelar la boda de mi hermana?", "Descubrí el secreto de mi jefe").
- **Derechos:** El fondo entra con licencia registrada; nada de personas reales generadas con IA.
- El proyecto va en la ruta completa de la línea `Carpeta:` del mensaje (úsala tal cual, no depende de dónde estés). Sin ella, `reddit-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920, TikTok, Reels, Shorts): El video de fondo llena la pantalla en 9:16. La tarjeta de Reddit aparece centrada en el tercio superior los primeros 3 segundos con su sonido pop; los subtítulos van en la franja baja mientras la tarjeta está en pantalla y suben al centro con gran tamaño en cuanto la tarjeta se desvanece. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): El fondo ocupa los 16:9 completos. La tarjeta de Reddit se ubica centrada cerca del borde superior (14% del alto) los primeros 3 segundos, y los subtítulos van centrados en el cuadro con la letra al 108% — el mismo estilo, el director acomoda cada pieza a cada medida. La portada no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md).

## Pasos

1. **Crear el proyecto:** `python -I -B -X utf8 <skill>/scripts/nuevo.py <carpeta> [--vertical]`
   Crea la estructura con plantilla Remotion, enlaza `node_modules` compartido y copia los tokens del estilo (`public/assets/reddit/`).
2. **Fuentes y Guion:**
   - En `post.json` (o `fuentes/tema/post.md`): `subreddit`, `autor`, `tiempo`, `titulo`, `votos`, `comentarios`, y opcionales `tema` (`"claro"`/`"oscuro"`) y `verificado` (`true`). Los datos del post son los del encargo: es ficticio salvo que el usuario pase el hilo real; nunca busques el post en Reddit ni en la web por tu cuenta.
   - En `guion.md`: El título del post y la narración pulida para ser leída de corrido (45–75 s en vertical), escrita por ti a partir del encargo.
   - En `material.json`: `{"fondo": "<referencia>"}`.
3. **Voz:**
   La voz se genera en `fuentes/voz/` (o `public/voz.wav`) con `generar_voz` de AI Studio o TTS.
   Si hay música propia, va en `public/musica.mp3` (se mezcla como cama a bajo volumen con ducking).
4. **Montaje y Render:**
   Se corre `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`.
   - `--revisa`: Valida el proyecto en un segundo sin red ni voz.
   - En la corrida completa: Descarga el fondo registrando su licencia en `FUENTES.md`, transcribe la voz (`revision/transcripcion.json`), mezcla la pista de audio con efectos (`sfx/pop.wav`, `sfx/upvote.wav`, `sfx/whoosh.wav`, `sfx/outro.wav`) masterizados a −14 LUFS en `public/sonido.wav`, escribe `src/edicion.json` —con el bloque `sonido` de pistas separadas (voz, música en loop con su ducking y cada efecto en su golpe, de los mismos `cues()` de la mezcla) para que el monitor en vivo las oiga y la línea de tiempo las muestre por carril— y renderiza con Remotion (`--muted` + extracción acelerada de cuadros) muxando el audio con FFmpeg hacia `out/reddit-<nombre>.mp4`.
5. **Revisión y Entrega:**
   `hacer.py` genera `revision/hoja.png` para verificar legibilidad y sincronía.

**El proyecto entregado queda limpio.** Al terminar bien, `hacer.py` borra los intermedios de render (`mezcla.wav`, `audio_master.wav`, `_cuadros/`), las `*.huella` del proyecto (fuera de `node_modules`) y `portada.jpg` cuando ya está `portada.png`. Se conservan a propósito `fuentes/` (post, licencia en `FUENTES.md`, voz en `fuentes/voz/`), `public/` (`sonido.wav`, `fondo.mp4`), `revision/` (`hoja.png`, `transcripcion.json`), `post.json`, `material.json`, `guion.md` y `out/reddit-<nombre>.mp4`.
