# La línea `Duración:`

Cuando el usuario elige una duración en el compositor de Hermit, el mensaje trae
`Duración: <lo elegido>` (por ejemplo `45 s`, `1 min`, `2 min`). Lo que significa depende del estilo, y lo dice su
card: con `clips` arma el video con clips de Flow y reparte la duración entre ellos; sin `clips`, la duración es la
del video terminado y el estilo la usa como mejor le sirva. Sin la línea, la que pida el guion o el material.

## Estilos con clips de Flow (`clips: true` en la card)

Las novelas (`frutinovela`, `animalnovela`, `devnovela`) y `minidrama`: todo el video son clips de 8 s de `generar_video`,
así que la duración se reparte entre ellos. `Duración: 45 s` son seis clips de 8 s y el último se recorta al final del
montaje (45 − 5 × 8 = 5 s del sexto). Cada clip dura ~20 palabras por personaje que habla; el guion se corta o se alarga
para que la suma dé la duración pedida. El tope práctico lo pone el presupuesto de créditos (`FLOW.md`): dilo al usuario
cuántos clips son y cuánto cuestan antes de pedirlos.

## Estilos sin clips (`clips` ausente o `false`)

La duración es la del video terminado; nunca se generan clips de Flow para llegar a ella. Cada estilo la aterriza a su
manera:

- **Con voz narrada** (`video-crimen`, `video-politica`, `video-top`, `video-reddit`, `video-motivacional`,
  `reel-collage`, `video-documental`): la voz manda. El guion se escribe para que leído dure lo pedido (~3 palabras por
  segundo) y el montaje ajusta con el audio real: si la voz sale más corta o más larga, se acomoda el ritmo de las escenas,
  no se estira ni se rellena con material ajeno.
- **`video-el-diff`**: los minutos de la línea los pasa `scripts/largo.py` a palabras (180 por minuto) y el guion se mide
  contra eso (`ESTILO.md`).
- **`video-explicativo`**: los segundos de la línea van a `hacer.py --dura`, que los cuenta antes de pedir la voz.

Si tu skill no menciona la línea `Duración:`, la duración pedida es solo la meta del video terminado: no inventes clips,
no repitas escenas para alargar y no añadas relleno para llegar exacto.
