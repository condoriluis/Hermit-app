---
name: video-reddit
description: Hace un video de historia de Reddit o relato de internet, vertical (TikTok, Reels, Shorts) u horizontal (YouTube). La narración de un hilo viral con voz IA sobre fondo inmersivo (gameplay de parkour, Minecraft, cocina relajante o tomas aéreas), la tarjeta del post de Reddit al inicio, subtítulos dinámicos palabra por palabra al centro y música sutil de fondo. Úsala cuando pidan un video de Reddit, una historia de internet o un relato narrado en lote.
---

# Historia de Reddit

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

Formato faceless en lote. Tres elementos lo sostienen:

- **El gancho visual y contextual:** Los primeros 3 segundos enseñan la tarjeta exacta del post de Reddit (subreddit, usuario, título y votos) con sonido de pop/notificación mientras se lee la primera frase de impacto.
- **Fondo hipnótico continuo:** Un video de fondo agradable y sin distracciones (gameplay fluido, satisfacción visual, tomas aéreas) que no compite con el relato pero mantiene la vista atrapada.
- **Subtítulos palabra por palabra:** En **Varela Round** (la redonda del hilo), texto animado al centro con la palabra que se dice en **naranja Reddit #FF4500**, sincronizado con la voz narrada. La portada usa la misma letra: `--fuente <base>/assets/fonts/VarelaRound-Regular.ttf --color "#ff4500"` en `portada_sin_ia.mjs` (o la describe igual quien la genere con IA).

## Lo que el usuario pidió y no se negocia

- **Autónomo y en lote:** Todo se genera y ensambla de principio a fin. La voz sale de AI Studio (o TTS) y el fondo de la biblioteca de clips con licencia de [`../video-base/MATERIAL.md`](../video-base/MATERIAL.md).
- **El fondo se declara:** `material.json` con `{"fondo": "<referencia>"}` (`mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de video; las referencias las da `video-documental/scripts/buscar.py`). `hacer.py` lo baja con su licencia anotada en `FUENTES.md`; también vale un `public/fondo.mp4` ya puesto.
- **El gancho no se salta:** La primera frase debe plantear el dilema ("¿Hice mal al cancelar la boda de mi hermana?", "Descubrí el secreto de mi jefe").
- **Derechos:** el fondo y las imágenes entran con licencia registrada; nada de personas reales generadas con IA.
- El proyecto va en la ruta completa de la línea `Carpeta:` del mensaje (úsala tal cual, no depende de dónde estés). Sin ella, `reddit-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920, TikTok, Reels, Shorts): el video de fondo llena la pantalla en 9:16. La tarjeta de Reddit aparece al centro superior (o centrada) los primeros 3 segundos y luego se desvanece suavemente para dar paso a los subtítulos grandes centrados. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): el fondo ocupa los 16:9 completos. La tarjeta de Reddit se ubica en el tercio izquierdo o centrada al inicio, y los subtítulos van en la franja inferior o central con tipografía legible a 480×270. La portada no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md).

## Pasos

1. **Fuentes.** Si el usuario mandó un enlace o texto de Reddit, se extrae a `fuentes/tema/post.json`. Si no, se formula o busca un relato viral estructurado con conflicto, desarrollo y remate en `fuentes/tema/post.json`.
2. **Guion.** En `guion.md`: el título del post, subreddit ficticio o real, y la narración pulida para ser leída de corrido (entre 45 y 75 s para vertical, o más de 3 min para horizontal).
3. **Voz.** La voz se genera de forma autónoma: si el mensaje trae `Voz: genérala tú en AI Studio con la voz <Nombre>`, se genera con `generar_voz` del MCP `voz`; si no trae esa línea, se genera automáticamente con TTS (o la voz por defecto de AI Studio) en `public/voz.wav` sin detener el turno ni pedir la voz. Solo si el mensaje dice explícitamente `Voz: la manda el usuario` se espera su audio. Se masteriza con `node <base>/scripts/masterizar.mjs` a −14 LUFS.
4. **Montaje.** Se corre `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`. Valida el proyecto en un segundo (`--revisa`, sin red ni voz), baja el fondo de `material.json` con su licencia, y delega en `montar.py` el montaje: transcribe `public/voz.wav` a `work/tx/words.json` con los modelos de Hermit (Whisper / VoxPopuli) para sincronía perfecta palabra por palabra, genera los subtítulos dinámicos en `work/captions.ass` y renderiza el video final. Deja `revision/tiempos.json` con lo que tardó cada paso.
5. **Revisión.** `hacer.py` ya deja `revision/hoja.png` (hoja de contacto del video final) para verificar que los subtítulos sean legibles y no se tapen con la interfaz de las redes.
6. **Final y Portada.** `montar.py` (vía `hacer.py`) deja el video en `out/reddit-<nombre>.mp4` con la masterización y la portada de primer cuadro ya aplicadas en vertical; en horizontal `portada.png` es la miniatura de YouTube. Se pasa `node <base>/scripts/comprobar.mjs`.

