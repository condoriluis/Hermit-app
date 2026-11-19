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

1. **Investigación.** Se investigan los puntos del top y se redactan en `fuentes/investigacion.md` con sus fuentes.
2. **Guion.** En `guion.md`: gancho de 3 segundos, desglose de cada puesto en cuenta regresiva y remate pidiendo interacción (ej. "¿Cuál te sorprendió más?").
3. **Voz.** La voz se genera de forma autónoma: con `generar_voz` si el mensaje indica una voz de AI Studio, o automáticamente con TTS en `public/voz.wav` sin detener el turno. Se masteriza a −14 LUFS con `node <base>/scripts/masterizar.mjs`.
4. **Montaje declarativo.** En `top.json`: cada escena con la `palabra` del guion donde entra, su `titular`, su `numero` y su `material`. Los `numero` son la cuenta regresiva: enteros que bajan de a uno hasta 1, cada uno en su escena — la tarjeta «NÚMERO N» entra con el golpe seco de `assets/sfx/golpe.wav`. El `material` es una lista de 2 a 4 cosas que se reparten el tramo en partes iguales: `{"foto": "<ruta o referencia>"}` (paneo Ken Burns) o `{"clip": "<ruta o referencia>", "desde": <segundo>, "velocidad": <n>}` — `desde` es el segundo de entrada del clip y `velocidad` lo estira o lo apura (0.6 = cámara lenta). Una escena **sin `material`** es una tarjeta sobre fondo negro con el texto centrado: sirve para el título del video o el cierre de interacción; solo lleva `numero` y/o `titular`. Las referencias las da `buscar.py` y `hacer.py` las baja con su licencia en `FUENTES.md`.
5. **Render.** Se corre `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`. Valida el proyecto en un segundo (`--revisa`, sin red ni voz), baja el material una vez por URL, y hace el resto: las tarjetas de puesto, los tramos de material (o la tarjeta sola), la voz masterizada, los subtítulos karaoke en Anton con la palabra activa amarilla (`subtitulos.py --estilo top`) y la portada de primer fotograma en vertical. Si el proyecto trae `public/musica.mp3` (o `musica.mp3`, `public/musica.wav`), suena a bajo volumen debajo de la voz. Deja `revision/hoja.png` y `revision/tiempos.json`.
6. **Revisión.** Se mira `revision/hoja.png`: que la tarjeta del puesto se lea en el tercio superior, los subtítulos en la franja baja sin tapar la interfaz de TikTok y Reels, y que el número 1 cierre con más fuerza.
7. **Final.** El video queda en `out/top-<nombre>.mp4` (el `-base.mp4` de la misma carpeta es el video sin subtítulos, por si hay que re-subtitular). Se pasa `node <base>/scripts/comprobar.mjs`. En horizontal, `portada.png` es la miniatura de YouTube según [`PORTADA.md`](../video-base/PORTADA.md) con `--fuente <base>/assets/fonts/Anton-Regular.ttf --color "#ffe600"`.

