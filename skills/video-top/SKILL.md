---
name: video-top
description: Hace un video de top o ranking (Top 3, 5 o 10 curiosidades, lugares, misterios o datos asombrosos), vertical (TikTok, Reels, Shorts) u horizontal (YouTube). Formato faceless con cuenta regresiva, tarjetas numeradas, clips e imágenes reales de archivo para cada puesto, efectos de sonido de cambio de puesto y narración ágil. Úsala cuando pidan un top, un ranking, curiosidades o datos que no sabías.
---

# Top curiosidades

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

La cuenta regresiva crea anticipación: el espectador quiere llegar al número 1.

- **Estructura de cuenta regresiva:** Cada elemento tiene su tarjeta numerada clara ("Número 5", "Número 4"...), con sonido de golpe seco y un titular intrigante.
- **Ritmo constante:** Cada puesto dura entre 10 y 18 segundos en formato vertical (total ~60 s), o entre 45 y 90 segundos en formato horizontal largo.
- **Material visual dinámico:** Por cada puesto se muestran de 2 a 4 fotos o clips de video reales con paneos y zoom lentos, nunca imágenes estáticas aburridas.
- **El golpe del formato:** Cada puesto entra con el número en slam (escala + shake de pantalla + flash amarillo) en el mismo instante del golpe seco; el #1 golpea más fuerte. Entre cortes de material hay un punch-in y, en sonido, click por corte, whoosh por escena, un riser antes del #1 y un cierre con `outro`. Los efectos de sonido están en `sfx/` y los pone `audio()` de `hacer.py`; los visuales, el director en `components/director.py`.

## Lo que el usuario pidió y no se negocia

- **Datos comprobables:** Los datos deben ser ciertos, de fuentes confiables (anotadas en `fuentes/investigacion.md`).
- **El número 1 debe ser el más impactante:** La lista se ordena de menor a mayor sorpresa para evitar abandono prematuro.
- **Derechos:** el material entra con licencia registrada en `FUENTES.md` (las referencias son las de [`../video-base/MATERIAL.md`](../video-base/MATERIAL.md): `mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de video; los bancos los busca `video-documental/scripts/buscar.py`); nada de personas reales generadas con IA.
- El proyecto va en `<nombre>` (la ruta completa de la línea `Carpeta:` del mensaje: úsala tal cual, no depende de dónde estés). Sin ella, `top-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920): las tarjetas de número van en el tercio superior o central superior, con subtítulos en la franja baja cuidando no tapar la interfaz de TikTok y Reels. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): pantalla completa 16:9 con espacio para gráficos laterales o números de diseño limpio. La portada no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md).

## Pasos

0. **Proyecto.** Se crea con `python -I -B -X utf8 <skill>/scripts/nuevo.py <nombre> [--vertical]` (el `--vertical` sale de la línea `Formato:` del mensaje): copia la plantilla de Remotion (`src/`, `package.json`…), pone las fuentes del estilo en `public/assets/top/` y enlaza el `node_modules` compartido. Queda la carpeta del proyecto con `fuentes/material/`, `public/material/`, `work/`, `out/` y `revision/`.
1. **Investigación.** Se investigan los puntos del top y se redactan en `fuentes/investigacion.md` con sus fuentes.
2. **Guion.** En `guion.md`: gancho de 3 segundos, desglose de cada puesto en cuenta regresiva y remate pidiendo interacción (ej. "¿Cuál te sorprendió más?").
3. **Voz.** La voz se genera de forma autónoma: con `generar_voz` si el mensaje indica una voz de AI Studio, o automáticamente con TTS en `fuentes/voz/` sin detener el turno (VOZ.md de video-base: ahí la deja `generar_voz`, como en el documental). Se masteriza a −14 LUFS con `node <base>/scripts/masterizar.mjs`.
4. **Montaje declarativo.** En `top.json`: cada escena con la `palabra` del guion donde entra, su `titular`, su `numero` y su `material`. Los `numero` son la cuenta regresiva: enteros que bajan de a uno hasta 1, cada uno en su escena — la tarjeta «NÚMERO N» entra con el golpe seco de `assets/sfx/golpe.wav`. El `material` es una lista de 2 a 4 cosas que se reparten el tramo en partes iguales: `{"foto": "<ruta o referencia>"}` (paneo Ken Burns) o `{"clip": "<ruta o referencia>", "desde": <segundo>, "velocidad": <n>}` — `desde` es el segundo de entrada del clip y `velocidad` lo estira o lo apura (0.6 = cámara lenta). Una escena **sin `material`** es una tarjeta sobre fondo negro con el texto centrado: sirve para el título del video o el cierre de interacción; solo lleva `numero` y/o `titular`. Las referencias las da `buscar.py` y `hacer.py` las baja con su licencia en `FUENTES.md`.
5. **Render.** Se corre `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`. Valida el proyecto en un segundo (`--revisa`, sin red ni voz), baja el material una vez por URL, y hace el resto: la voz con el golpe seco por puesto y la música incidental masterizada a `public/sonido.wav`, la edición de Remotion en `src/edicion.json` (el director pone cada tramo de material —foto con paneo suave, clip con su `desde` y `velocidad`—, las tarjetas «NÚMERO N» y los titulares con su entrada, y las escenas), el render sin audio con los cuadros de los clips ya sacados (`cuadros_render.cjs`, `--muted` como en el documental: `sonido.wav` entra después por ffmpeg, no por el `<Audio>` del render), las pistas del sonido por separado en el bloque `sonido` de `edicion.json` —la voz, la música en loop y cada efecto en su golpe, calculadas de los mismos `cues()` de la mezcla— para que el monitor en vivo las oiga y la línea de tiempo las muestre por carril, los subtítulos karaoke en Anton con la palabra activa amarilla —capas dentro de la composición, con los tiempos de palabra de la transcripción, como en el documental— y la portada de primer fotograma en vertical. Deja `revision/hoja.png` y `revision/tiempos.json`.
6. **Revisión.** Se mira `revision/hoja.png`: que la tarjeta del puesto se lea en el tercio superior, los subtítulos en la franja baja sin tapar la interfaz de TikTok y Reels, y que el número 1 cierre con más fuerza.
7. **Final.** El video queda en `out/top-<nombre>.mp4`, solo él: los subtítulos van dentro del video desde el render y `sonido.wav` entra por ffmpeg, así que no hay base ni `.ass` que reenviar (como en el documental). Se pasa `node <base>/scripts/comprobar.mjs`. En horizontal, `portada.png` es la miniatura de YouTube según [`PORTADA.md`](../video-base/PORTADA.md) con `--fuente <base>/assets/fonts/Anton-Regular.ttf --color "#ffe600"`.

**El proyecto entregado queda limpio.** Al terminar bien, `hacer.py` borra las mezclas de `revision/`
(`mezcla.wav`, `audio_master.wav`: ya son el video final y se regeneran en cada corrida), las `*.huella` del
proyecto (marcas de dedup del servidor, fuera de `node_modules`) y `portada.jpg` cuando ya está `portada.png`.
Se quedan a propósito `revision/hoja.png`, `revision/tiempos.json` y `revision/transcripcion.json` (caché de la
voz), `fuentes/` (investigación, material con licencia y voz), `fuentes/` (investigación, material con licencia y la voz en `fuentes/voz/`), `public/` (`sonido.wav`,
`material/` con
los enlaces del render, `assets/top/` con las fuentes), `src/edicion.json` y la línea GSAP (la edición, para el
monitor en vivo), `out/` (solo el mp4 final), `node_modules` (enlace compartido) y `FUENTES.md`.
No dejes scripts ni logs sueltos en la raíz ni en `fuentes/`: lo de un solo uso va a `$TEMP`.

