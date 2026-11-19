---
name: video-propio
description: Hace un video profesional con las fotos y los videos del usuario (viajes, eventos, familia, producto, cualquier tema), vertical (TikTok, Reels, Shorts) u horizontal (YouTube). El agente revisa el material adjunto, elige qué va y en qué orden, y lo monta como un recap animado — collage de fotos en marcos, paneos en las imágenes, clips recortados, títulos cinéticos palabra a palabra y música de fondo. Si el usuario pide narración, la voz se genera y se queman subtítulos. Úsala cuando alguien sube sus fotos o videos y pide un video con ellos.
---

# Video con tu material

Todo el material es del usuario: sus fotos y sus videos. Tú escribes **un archivo** (`plan.json`: qué va, en qué
orden, cuánto dura cada momento y qué título lleva) y corres **un comando** (`hacer.py`), que prepara el material,
mezcla el sonido, renderiza, mide y deja la hoja para mirar. **No escribas código ni abras `plantilla/` ni
`components/`**: el collage, los paneos, los títulos, los fundidos y las tarjetas los pone la plantilla; lo tuyo es
la edición.

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de
empezar. Si el video lleva voz narrada, también [`VOZ.md`](../video-base/VOZ.md). Los scripts van con
`python -I -B -X utf8` desde la raíz del proyecto (la carpeta de la línea `Carpeta:`).

## Lo que no se negocia

- **Solo material del usuario.** Nada de stock, nada generado, nada de internet: el video es suyo. Si falta material
  para lo que pidió, se lo dices; no se rellena con lo de otros.
- **No inventes lo que hay en los archivos.** Las fotos las ves directo (llegan como imagen); de cada video sacas
  fotogramas con `marcos.py` y eliges por lo que se ve. Si un archivo no se puede leer, se lo dices.
- **Los derechos son suyos**, pero dilo al entregar: si el material trae caras o música de terceros, que lo sepa.
- **No se publica nada.**
- Sin `Carpeta:` en el mensaje, `propio-<tema>` en el directorio actual.

## Los archivos que llegan

- Las **fotos** adjuntas llegan como bloques de imagen (las ves) y con su ruta en una línea `Imagen adjunta: <ruta>`.
- Los **videos y demás archivos** llegan como su ruta entre comillas en el texto.
- Copia todo a `fuentes/` del proyecto antes de empezar (`os.link` o copia; una foto puede pesar). En `plan.json` se
  referencia con su ruta relativa al proyecto (`fuentes/playa.jpg`). No pidas los archivos otra vez.

## Revisar el material

- **Fotos**: ya las ves. Elige las que mejor cuentan lo que pidió, de sobra: el montaje usa de 6 a 20 en un video
  normal; si mandó 60, quédate con las mejores y dilo.
- **Videos**: no los "ves" enteros; sacas sus momentos. Por cada video, en un solo mensaje:
  `python -I -B -X utf8 <skill>/scripts/marcos.py fuentes/<video> revision/marcos-<nombre>.jpg --cada 2 --max 12`
  (ajusta `--cada` al largo: clips cortos cada 1 s). La hoja sale en 4 columnas con el segundo de cada cuadro; mira
  `revision/marcos-<nombre>.jpg` una vez y elige los tramos (`desde`/`hasta` en segundos). De un mismo video pueden
  salir varios tramos.
- **Audio de los videos**: se ignora. El sonido del video final es la música y, si la hay, la voz.

## plan.json

```json
{
  "titulo": "Mi viaje a Cartagena",
  "intro":    { "titulo": "5 días en Cartagena", "subtitulo": "diciembre 2025", "kicker": "un video", "segundos": 2.4 },
  "cierre":   { "titulo": "Gracias por ver", "subtitulo": "sígueme para más", "segundos": 2.6 },
  "musica": "mi-cancion.mp3",
  "acento": "#8ef0c8",
  "voz": "fuentes/voz.wav",
  "voz_desde": 0.0,
  "escenas": [
    { "tipo": "foto",   "archivo": "fuentes/llegada.jpg", "segundos": 3.2, "titulo": "Día 1 · Llegada", "mov": "acercar" },
    { "tipo": "video",  "archivo": "fuentes/playa.mp4", "desde": 12.0, "hasta": 18.5, "titulo": "La playa" },
    { "tipo": "collage","segundos": 4.0, "titulo": "La comida", "fotos": [
        { "archivo": "fuentes/arepa.jpg", "pie": "arepas" },
        { "archivo": "fuentes/pescado.jpg", "pie": "fresco" },
        { "archivo": "fuentes/postre.jpg" }
    ]}
  ]
}
```

`hacer.py` genera también `plan.md` — el plan en lectura para que el usuario lo revise en el estudio; no lo escribas
tú, se rehace solo en cada corrida (y con `--revisa`).

- **`escenas`**: el orden del video. `intro` y `cierre` son tarjetas opcionales (sin ellas, el video abre y cierra
  directo con el material).
- **`foto`**: `segundos` de 0,8 a 15; `titulo` y `subtitulo` opcionales (el título entra palabra a palabra).
  `mov`: `acercar` (por omisión si no pones), `alejar`, `izquierda`, `derecha`, `arriba`, `abajo` — el paneo; cámbialo
  entre escenas seguidas para que no se repita el mismo.
- **`video`**: `desde`/`hasta` en segundos dentro del archivo (lo que enseñó `marcos.py`). Dura lo que el tramo;
  de 2 a 6 s suele ir bien, tramos más largos si el momento lo pide.
- **`collage`**: de 2 a 4 `fotos` (con `pie` opcional, una palabra o corta); `segundos` de 1,5 a 12. Es el golpe de
  efecto del estilo: úsalo en los momentos de grupo (comida, familia, amigos, lugares).
- **El ritmo manda**: un plano cada 2–5 s; el video se siente recap si cambia seguido, no si cada foto dura 8 s.
  `Duración:` del mensaje es la meta del video terminado: ajusta los `segundos` y elige tramos para acercarte; no
  repitas escenas para alargar ni rellenes.
- **Títulos**: cortos, de 2 a 6 palabras, como subtítulos de foto familiar — lugar, día, qué se hace. Nada de
  frases largas: lo que no cabe en dos líneas no va.
- **`acento`**: el color del marcador de la última palabra de cada título, el filete de las tarjetas y la barra de
  avance — en `#RRGGBB`. Sin él, menta `#8ef0c8`. Elige uno que lea bien sobre el material (amarillo `#ffd23f`,
  naranja `#ff7a3d`, rosa `#ff5da2`…) y que combine con la portada (su color de texto, abajo).
- **`musica`**: la canción del usuario, ruta del proyecto o archivo de `public/assets/music/`. Sin ella, el video
  lleva una música sintetizada del largo exacto.
- **`voz`/`voz_desde`**: solo si el mensaje trae `Voz:` y ya está la narración (ver «La voz», abajo).

## La voz

La mayoría de los videos van **sin narración**: los títulos cuentan. Solo si el mensaje trae la línea `Voz:` (el
usuario eligió mandar su voz o una de AI Studio/Fish/ElevenLabs) sigue [`VOZ.md`](../video-base/VOZ.md): escribe
`guion.md` (lo que se narra, en el orden del video), genera o recibe la voz en `fuentes/voz.wav` y ponla en `plan.json`
con `voz_desde` (segundos donde arranca, 0 por omisión; la intro viene antes, así que suele ser lo que dura la
intro). Si la voz es más larga que el video, recorta el guion; si el video es más largo, el último tramo queda con
música sola. Con voz se pueden quemar subtítulos después con `subtitulos.py` de la base (`--voz fuentes/voz.wav
--offset <voz_desde>`), estilo `minimal`.

## Pasos

1. **El proyecto.** `python -I -B -X utf8 <skill>/scripts/nuevo.py <carpeta> --horizontal` si el mensaje trae
   `Formato: horizontal` (sin ella, vertical). Copia ahí los archivos adjuntos a `fuentes/`. Si no hay ningún archivo
   adjunto, pídelos y para: sin material no hay video.
2. **Revisar.** Las fotos ya las viste; de cada video, `marcos.py` a `revision/marcos-*.jpg` y mira las hojas (en un
   solo mensaje, una por video). Listo cuando sabes qué foto y qué tramo de cada video cuenta lo pedido.
3. **La edición.** Escribe `plan.json` con Write, en la raíz del proyecto. Si el usuario pidió un orden concreto
   (por nombre de archivo o por lo que dijo), respétalo; si no, propón el orden que mejor cuenta y díselo al entregar
   (puede pedir cambios: se edita `plan.json` y se vuelve a correr `hacer.py`, lo preparado no se rehace). Luego
   `python -I -B -X utf8 <skill>/scripts/hacer.py --revisa`: **si dice ✗**, arréglalo con Edit y vuelve a lanzarlo;
   cuando diga ✓, `python -I -B -X utf8 <skill>/scripts/hacer.py` **en segundo plano** y termina tu mensaje: te avisa.
4. **Mirar.** Cuando termine, abre `revision/hoja.png` (un cuadro por 1,5 s): cada foto o video debe verse en su
   momento, los títulos se leen y el collage no se sale del cuadro. Si algo no cuadra, corrige `plan.json` (otro
   `mov`, otro tramo, quitar una foto) y relanza `hacer.py`. Otro render solo por eso, todo en una vuelta.
5. **Portada.** Como en [`PORTADA.md`](../video-base/PORTADA.md): con cuenta de ChatGPT, la portada generada con IA;
   sin ella, `node <base>/scripts/portada_sin_ia.mjs out/final.mp4 portada.png --titulo "<título>" --fuente
   <base>/assets/fonts/ArchivoBlack-Regular.ttf --color "#8ef0c8"` (y `--horizontal` en horizontal). Mírala en chico
   y luego `node <base>/scripts/portada.mjs out/final.mp4 portada.png` solo en vertical.
6. **Entrega.** La ruta de `out/final.mp4`, cuánto dura, qué material usaste (cuántas fotos y tramos de cada video)
   y que el audio no lo oíste: se comprobó por cifras. Si el usuario quiere otro orden o quitar algo, es editar
   `plan.json` y relanzar `hacer.py`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos
está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920, TikTok, Reels y Shorts): los títulos van en el tercio bajo, sobre la zona que
  tapan los botones con margen; el collage se arma en la caja central. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, YouTube): el mismo montaje a lo ancho — fotos y clips a pantalla completa,
  el collage en una fila suelta, los títulos en el tercio bajo. La portada no va dentro del video: `portada.png` es
  la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md), y no se corre `portada.mjs`.
