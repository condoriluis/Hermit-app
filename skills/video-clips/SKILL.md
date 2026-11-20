---
name: video-clips
description: Saca clips verticales u horizontales de un video largo (propio o con permiso), para TikTok, Reels, Shorts o YouTube. Cada clip es un momento exacto del video — con su tarjeta de gancho, reencuadre al formato y subtítulos karaoke palabra a palabra— y cae en `out/redes/` listo para la cola de publicación. Úsala cuando pidan clips, cortos o momentos de un video, o cuando la sección Clips de Hermit manda un video a cortar.
---

# Clips de un video largo

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

El mejor momento del video largo, vestido como clip: un corte exacto en borde de palabra, la tarjeta del gancho
leyéndose los primeros segundos, el reencuadre al formato de la red y los subtítulos karaoke que se siguen sin
desviarse. Varias salidas del mismo video, cada una con su nombre.

- **El corte manda:** `desde` y `hasta` salen de la transcripción palabra a palabra — nunca a ojo ni a la mitad de una frase.
- **El gancho se lee:** si el momento lo pide, `gancho` pone el texto sobre el video los primeros 2,5 s (Archivo Black, se apaga solo).
- **Mismo sello en todos:** misma tipografía de subtítulos, mismo loudness (−14 LUFS), mismo reencuadre — el canal se reconoce.
- **Permiso opcional:** si el usuario declara de quién es el video y por qué puede cortarlo, queda en `permiso.txt`; si no lo declara, el clip se hace igual — el permiso es decisión del usuario, no de la skill.

## Lo que el usuario pidió y no se negocia

- **Solo momentos con sentido:** un clip es una idea completa que engancha sola; no se corta por duración, se corta por momento.
- **Sin inventar el contenido:** los tiempos salen de la transcripción real del video, no de lo que parece que se dijo.
- **La fuente se queda:** el video completo no se toca ni se borra; los clips son copias de momentos.
- El proyecto va en `<nombre>` (la ruta completa de la línea `Carpeta:` del mensaje: úsala tal cual). Sin ella, `clips-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical (lo normal para clips). Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920): reencuadre 9:16 cubriendo el cuadro y cortando al centro; subtítulos en la franja baja con margen de seguridad. Es el formato de TikTok, Reels y Shorts.
- **`Formato: horizontal`** (1920×1080, para YouTube): reencuadre 16:9 igual. La portada no aplica: el clip abre con su imagen.

## Pasos

1. **Fuente.** Si el mensaje trae una URL, se baja y transcribe de una vez:
   `python -B <base>/scripts/fuente.py <url> fuentes/tema` — deja `video.mp4` (hasta 1080p), `video.info.json`
   (título, canal, fecha, duración), `voz.wav` y `transcripcion.json`/`.txt` con los tiempos de cada frase. Sirve
   para YouTube, X e Instagram; si YouTube pide «confirm you're not a bot» el script ya reintenta solo. Si el video
   no es del usuario, se le pregunta una vez por el permiso: si lo declara queda en `permiso.txt`; si no, se sigue
   igual (el permiso es opcional, decisión del usuario). Si la URL falla del todo, se lo dices; no se inventa el
   contenido. La fuente de `cortes.json` apunta a ese `video.mp4`.
2. **Momentos.** Con la transcripción delante se proponen los cortes al usuario: cada candidato con `desde`/`hasta`
   en segundos (borde de frase, nunca a media palabra), el `nombre` en slug y por qué engancha. El usuario elige;
   los descartados no se cortan. Un video largo suele dar de 3 a 8 clips buenos; no se fuerza el número.
   **Los tiempos se escriben siempre en el chat como `m:ss`** (minutos:segundos, segundos de 00 a 59): `0:18–0:39`,
   `1:05–1:47`. Nunca `mm:ss` con segundos de dos cifras inventados ni decimales sueltos: un `39:80` no existe y
   confunde. En `cortes.json` sí van en segundos con decimal (`39.8`), tal cual salen de la transcripción.
3. **Cortes.** Primero `guion.md`: el plan ya aprobado, en prosa legible — una tabla o lista con cada momento,
   su tiempo en `m:ss`, su `gancho` y por qué funciona (es lo que se ve en la pestaña Guion del estudio). Se escribe con la herramienta de archivos, no por consola: por consola se pierden los acentos (`?`). Después,
   `cortes.json`: cada clip elegido con `desde`/`hasta` en segundos, `nombre`, `gancho` opcional (≤ 80
   caracteres, lo que se lee al abrir) y `subtitulos` (`minimal`, `top`, `centro`, `crimen` o `ninguno`; `minimal` por omisión; `centro` es el minimal en el centro del cuadro). `portada_titulo` es el titular de la portada en vertical (2 a 5 palabras, hasta 60 caracteres) y se escribe
   como un gancho, no como un resumen: la cifra, el nombre o la promesa que obliga a ver el clip. Nada de
   «explicado», «análisis» ni «todo sobre» — eso describe el contenido en vez de venderlo. Con el video de la
   caída de Microsoft: «80 % en 2 horas» y «Un correo que intoxicó a 15» enganchan; «Explicación del efecto
   dominó» no. En vertical se escribe siempre; sin él, la portada usa el gancho limpio. `ninguno` es para cuando la fuente ya trae sus subtítulos quemados: los nuestros se cruzarían con los suyos — se ve en las hojas de la revisión.
   **El acento del clip** (`acento`, opcional): el golpe de color que lo viste — `amarillo` (#ffe600), `rojo`,
   `naranja`, `verde`, `cyan`, `azul`, `morado`, `rosa` o un #RRGGBB. Se elige por tema, no al azar: noticias y
   caídas → `rojo`; dinero, ofertas y logros → `amarillo` o `verde`; tecnología e IA → `cyan`; misterio y true
   crime → `morado`; historia o empatía → `naranja`; nada que ver → se omite y el clip queda en blanco. El mismo
   acento pinta la palabra activa de los subtítulos karaoke. Para la portada (solo vertical): `portada_resaltar`
   es la palabra o frase del título que va en el acento — el número o la promesa («80 %», «en 2 horas», «sin
   permiso») — y `portada_fuente` la letra: `anton` (potente, para cifras y noticias), `archivo` (la del gancho,
   por omisión), `bebas` (directa), `courier` (investigación, expediente) o `varela` (cercana, historias).
   `reencuadre` es `auto` (el motor mide las caras del tramo y elige solo: cara grande la mayor parte del tiempo → `persona`; si no → `difuminado`; sin datos → `centrado`), `centrado` (recorte al centro: para quien habla quieto en el medio), `difuminado` (el cuadro entero nítido sobre su imagen borrosa de fondo: para videos que enseñan pantallas, tablas o slides — recortar ahí perdería la mitad del contenido) o `persona` (la cámara sigue a quien habla: el motor detecta las caras del tramo y panea suave con zona muerta — para presentadores que se mueven o están a un lado; si no detecta caras o el Python no lleva OpenCV, sale `centrado`). Se elige por corte, mirando las hojas. `formato` del JSON manda sobre `--formato`. Los tiempos van en segundos del video fuente.
4. **Permiso (opcional).** Si el usuario lo declara, `permiso.txt` con de quién es el video y por qué se puede cortar. Si no lo declara, se corta igual: la decisión es suya.
5. **Render.** Se corre `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`. Valida en un segundo (`--revisa`, sin red ni voz), y por cada corte: lo corta y reencuadra, lo masteriza a −14 LUFS, le quema los subtítulos karaoke de su estilo y le hace su hoja en `revision/`. Los clips quedan en `out/redes/<n>-<nombre>.mp4` — la carpeta que la cola de redes publica, un video por corte. En vertical cada clip lleva portada ([`PORTADA.md`](../video-base/PORTADA.md)): la suya en `portada/<n>-<nombre>.png` si la pones, la compartida del proyecto, o una que el motor genera del propio clip con su gancho.
6. **Revisión.** Se miran las hojas: que el corte abra donde tiene que abrir, que el gancho se lea entero y se apague, y que ninguna palabra quede cortada ni tapada. El clip que no convence se corrige en `cortes.json` y se vuelve a correr: los que ya salieron no se repiten.
