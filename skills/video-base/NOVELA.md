# La novela de clips: el proceso común

Las cuatro novelas —`frutinovela`, `animalnovela`, `devnovela` y `minidrama`— se hacen igual: historia, guion en
tabla, personajes y lugares con Nano Banana, el primer cuadro de cada escena, los clips de 8 s con Veo en Google
Flow y `unir.py`, que los une, los compara con el guion y los subtitula. Lo que cambia de un estilo a otro es el
reparto y el mundo: eso va en la `SKILL.md` de cada uno. El proceso es este.

Lee además [`LEEME.md`](LEEME.md) (los errores ya vistos), [`FORMATO.md`](FORMATO.md),
[`FLOW.md`](FLOW.md) (las herramientas `generar_imagen` y `generar_video`, lo que gastan y qué hacer si fallan) y
[`PORTADA.md`](PORTADA.md) antes de empezar.

## Lo que no se negocia

- **Gasta créditos de Flow del usuario.** Antes de pedir los clips, dile cuántos son, el modelo y el total
  (ejemplo: 10 clips en Veo 3.1 - Lite, 100 créditos). Las imágenes (hojas, lugares, cuadros) no gastan. Hermit
  pide la autorización antes del primer clip: si la herramienta dice que espera permiso, pídeselo y espera con
  `estado_flow`.
- **Ningún personaje ni historia de otro canal.** Los ejemplos se miden, no se copian: elenco, nombres y tramas
  son nuevos. Lo que cada estilo prohíbe de su reparto va en su `SKILL.md`.
- **Sin texto en lo generado.** Ni letreros, ni subtítulos, ni marcas de agua en los cuadros o los clips. Los
  subtítulos los pone `unir.py`.
- El proyecto va en la ruta completa de la línea `Carpeta:` del mensaje, tal cual (el estudio de Hermit la busca
  ahí). Sin la línea, `<estilo>-<tema>`.

## Hablan ellos, sin narrador

Cada clip son 8 s de uno o dos personajes diciéndose algo. Veo genera las voces con la boca a tiempo, y las voces
son las que dice el guion para cada personaje. La cámara casi no se mueve: plano medio o entero, dos o tres
personajes, un lugar por escena; lo que se mueve es la cara y las manos, que es lo que Veo hace bien. El primer
segundo ya es el conflicto, sin presentación, y el último clip deja la pregunta abierta: el video acaba ahí, en
«Parte N».

## Elenco

Los personajes viven en `personajes/`, en la carpeta donde arrancas (la de todas las novelas del estilo). Así se
usan otra vez en la parte 2 sin rehacerlos. Cada uno lleva su hoja `personajes/<nombre>.jpg` y su renglón en
`personajes/ELENCO.md`: qué representa, **cómo es exactamente** (la regla de cada estilo), su voz (la ficha
literal en inglés de [`FLOW.md`](FLOW.md), «La voz de cada personaje») y en qué capítulos sale. Antes de inventar
a uno, mira si ya está y conserva su diseño.

## Voces: las de Veo o TTS por personaje

Cada clip suena con el audio que Veo le da, y puede cambiar de voz de una escena a otra. Si el usuario quiere que
cada personaje tenga **su voz fija** (lo pide como «voces iguales», «voz por personaje» o «con TTS»), o cuando Veo
falla varias veces seguidas con el audio de una escena, esa escena puede llevar voz TTS:

- `voces/personajes.json`, en la carpeta del proyecto: `{ "<personaje>": "<voz>" }` con la voz de AI Studio, Fish
  Audio o ElevenLabs de cada uno (se elige y se prueba con `/api/voz/probar`, como la narración). Se escribe una
  vez y vale para este video y sus partes siguientes.
- `voces/esc-<NN>.json`, una por escena: `[{ "quien": "<personaje>", "texto": "<su línea>" }, ...]` en el orden en
  que se dicen. Solo las escenas con este archivo suenan con TTS; las demás siguen con el audio de Veo.

El clip se pide igual que siempre, con su diálogo en el prompt (las bocas se mueven); `unir.py` le cambia la pista
de audio por las líneas TTS y los subtítulos salen del guion, con los tiempos reales de cada línea. La sincronía
labial no es exacta: en planos medios no se nota; en un primerísimo plano de cara hablando, mejor dejar esa escena
con el audio de Veo. Si una línea no convence, se regenera su WAV y se vuelve a unir: no gasta créditos de Flow.

## Las imágenes

Todo se hace con Flow, que también hace los clips. La línea `Imágenes:` del mensaje elige el modelo de Nano
Banana (sin ella, Nano Banana 2.1). Si dice ChatGPT, usa Flow de todos modos para las hojas, los lugares y los
cuadros, y díselo al usuario: los cuadros tienen que salir del mismo Flow que los anima, con las mismas
referencias.

## El pipeline

1. **Historia.** Un tema del usuario, una idea suya o, si no dio nada, una de las tramas del estilo con un giro
   propio. Si es otra parte de una que ya se hizo, lee su `guion.md` y su `ELENCO.md` y sigue desde su cliffhanger.
   Listo cuando puedes contar la historia en tres frases: el conflicto, el giro y la pregunta con que acaba.
2. **Guion.** En `guion.md` de la carpeta del proyecto: el título, la parte, el elenco de este capítulo y una
   tabla con una fila por escena. Cada fila lleva el número, el lugar, quién sale, el plano, lo que hacen y lo que
   dicen, entre comillas y con quién lo dice — frases cortas y sin puntos suspensivos: el audio de Veo falla con
   pausas largas. En cada escena caben unas 20 palabras, de uno o dos personajes. La cuenta de escenas va en cada
   `SKILL.md`. Listo cuando el primer clip ya es el conflicto, cada escena empuja la historia y el último deja la
   pregunta.
3. **Personajes.** Los que falten, con `generar_imagen` en `formato` `9:16`, a `personajes/<nombre>.jpg`, uno por
   imagen. Cuerpo humano completo (dos brazos, dos manos, dos piernas y dos pies), de frente y de pie, con su
   ropa, sobre fondo claro y liso; la cabeza es lo que diga el estilo. El pedido va en inglés con la plantilla de
   cada `SKILL.md`. Míralos: si uno no salió como dice `ELENCO.md`, pídelo otra vez diciendo qué corregir. Listo
   cuando cada personaje del capítulo tiene su hoja y su renglón en `ELENCO.md`.
4. **Lugares.** Cada lugar del guion, vacío, con `generar_imagen` en el formato del video, a `lugares/<lugar>.jpg`
   del proyecto: el mismo mundo 3D del estilo, con luz cálida y sin personas ni texto. Listo cuando cada lugar
   tiene su imagen.
5. **Cuadros.** El primer cuadro de cada escena, con `generar_imagen` en el formato del video y en `referencias`
   las hojas de quienes salen más la del lugar (cuatro como mucho), a `cuadros/esc-<NN>.jpg`. El pedido dice
   dónde está cada uno, hacia dónde mira, su gesto al empezar la escena, el plano, y que todo coincida con las
   referencias y sin texto. Mira todos en una hoja (`node <base>/scripts/hoja.mjs cuadros revision/cuadros.png`).
   Si uno cambió de cara o de ropa o salió con texto, pídelo otra vez: no gasta. Listo cuando los personajes se
   ven iguales en todos.
6. **Clips.** Mira con `estado_flow` sin `id` cuánto les queda a sus cuentas. Dile al usuario cuántos clips son,
   cuánto gastan y si alcanzan (paso «Lo que no se negocia»), y pídelos todos seguidos, sin esperar uno para pedir
   el siguiente. Se reparten entre sus cuentas. Usa `generar_video` con `primerCuadro` `cuadros/esc-<NN>.jpg`, el
   formato del video, Veo 3.1 - Lite (salvo que el usuario pida otro) y `salida` `clips/esc-<NN>.mp4`. El prompt,
   en inglés, describe la acción. El diálogo va en español, entre comillas y con quién lo dice; delante de cada
   línea, la ficha de voz de ese personaje copiada igual que en `ELENCO.md` (ver [`FLOW.md`](FLOW.md), «La voz de
   cada personaje»). Las líneas que dice el clip quedan también en `dialogos/esc-<NN>.txt`, tal cual y sin más
   texto, para que `unir.py` compare lo que se oyó con el guion. Al final, el cierre de cada `SKILL.md`
   (`static camera, no music, no subtitles…`). Espera los pendientes con `estado_flow`. Listo cuando están todos
   los clips. Si una cuenta se quedó sin créditos, la herramienta ya pasó a otra. Si ninguna puede, dile al
   usuario cuántos faltan y cuándo vuelven sus cuentas, y para ahí. Si Flow rechaza un clip por su contenido
   (derechos, política de Google), no es la cuenta: cámbialo de verdad y pídelo otra vez (con `escena` = su
   número); si cae otra, la versión 100 % original (sin personajes, marcas ni personas con derechos); si cae la
   tercera, déjalo fuera y sigue: el video sale con los demás, y al final se lo dices al usuario.
7. **Montaje.** `python <base>/scripts/unir.py <nombre> --estilo <estilo> --formato <formato>` se corre desde la
   carpeta del proyecto. Transcribe cada clip y le corta el final muerto: Veo deja de 1 a 2 s en que nadie habla ni
   se mueve, y se corta a 0,35 s de su última palabra (`--sin-recortar` deja el clip entero; `--duracion` recorta
   por el final a los segundos pedidos). Luego une los clips en orden, masteriza el audio a −14 LUFS y pone los
   subtítulos en bloques de hasta tres palabras, con la más larga en amarillo (`--sin-subtitulos` si el usuario
   no los quiere). Si `unir.py` para con «Escenas que no dicen lo del guion», una escena dijo otra cosa:
   regenera ese clip con el prompt corregido (o más corto y con menos hablantes) y vuelve a unir;
   `revision/sospechosas.txt` dice qué se esperaba y qué se oyó. Si están bien de verdad, `--forzar`. Mira
   `revision/transcripcion.txt` contra el guion y una hoja del video (`node <base>/scripts/hoja.mjs
   out/<estilo>-<nombre>.mp4 revision/hoja.png --cada 2`). Si un clip dice otra cosa, habla con la voz de otro,
   cambia a un personaje o trae texto, repítelo una vez con el prompt corregido. Repetirlo gasta otra vez: si
   sigue mal, déjalo y díselo al usuario. Al final,
   `node <base>/scripts/comprobar.mjs out/<estilo>-<nombre>.mp4 --duracion <s> --fps 30 --tamano <1080x1920 o
   1920x1080>`. Listo cuando pasa y cada escena dice lo del guion.
8. **Portada.** Según [`PORTADA.md`](PORTADA.md): el personaje del conflicto, grande y con la cara del momento más
   fuerte, y de 2 a 5 palabras del drama. Van tres cuadros del video de referencia, para que sea el mismo elenco.
   En vertical va de primer fotograma (`portada.mjs`). En horizontal, `portada.png` es la miniatura de YouTube. Lo
   propio de cada estilo va en su `SKILL.md`. Entrega la ruta del video, el guion, los créditos gastados y con qué
   cuentas, y lo que no revisaste: el audio no lo oyes, solo lo transcribes.

## Lo que cambia por estilo

| | `frutinovela` | `animalnovela` | `devnovela` | `minidrama` |
|---|---|---|---|---|
| El personaje es | una fruta con cuerpo humano | cabeza de su especie, cuerpo humano | su logo como cabeza | una persona realista |
| Escenas | 8 a 14 (64–112 s) | 8 a 12 (64–96 s) | 8 a 12 (64–96 s) | la fórmula de su `SKILL.md` |
| El mundo | Pixar 3D | Pixar 3D | Pixar 3D | fotorrealista de k-drama |
| Cierre del clip | `static camera, no music, no subtitles, no text on screen` | ídem + `no realistic animals` | ídem + `no extra logos, no realistic animals` | el de su `SKILL.md` |
