# Prueba de cada estilo de video

Auditoría y prueba real de los estilos de video, uno por uno: se revisa la skill completa (docs + scripts +
plantilla), los proyectos reales en busca de basura, se corrigen solo lo justificado y luego se hace un video corto
de prueba para verificar el resultado y la limpieza de la carpeta. Sin commits hasta que se pida.

## Estado

| # | Estilo | Auditoría | Correcciones | Prueba real | Limpieza verificada |
|---|--------|-----------|--------------|-------------|---------------------|
| 1 | `video-explicativo` | ✅ | ✅ | ✅ 19.6 s, 1080×1920 | ✅ |
| 2 | `video-el-diff` | ✅ | ✅ | ✅ 38.3 s, 1080×1920 | ✅ |
| 3 | `reel-collage` | ✅ | ✅ | ✅ 30.4 s, 1080×1920 | ✅ |
| 4 | `video-documental` | ✅ | ✅ | ✅ 63.8 s, 1080×1920 | ✅ |
| 5 | `video-top` | ✅ | ✅ | ✅ 78.1 s, 1080×1920 | ✅ |
| 6 | `publicidad` | ✅ | ✅ | ✅ 35.8 s, 1080×1920 | ✅ |
| 7 | `video-reddit` | ✅ | ✅ | ✅ 51.3 s, 1080×1920 | ✅ |
| 8 | `video-motivacional` | ✅ | ✅ | ✅ 33.1 s, 1080×1920 | ✅ |
| 9 | `video-crimen` | ✅ | ✅ | ✅ 59.2 s, 1080×1920 | ✅ |
| 10 | `video-politica` | ✅ | ✅ | ✅ 65.1 s, 1080×1920 | ✅ |

## Estilo 1 — `video-explicativo` (probado)

Proyecto de prueba: `D:\Hermit\video\video-explicativo\explicativo-vertical-15-hojas`
→ `out/explicativo-vertical-15-hojas.mp4` (19.6 s, voz Bodi, árbol 3D `arbol-otono` hecho al vuelo y guardado en la
biblioteca de modelos).

Cambios aplicados:

- `scripts/nuevo.py`: rechaza nombres de proyecto que empiezan con `-` (antes `--help` creaba una carpeta `--help`).
- `plantilla/scripts/alinear.py`: borra `fuentes/voz16k.wav` al terminar la alineación (era intermedio de
  transcripción; los proyectos nuevos lo heredan).
- `scripts/hacer.py`: al final del render exitoso borra los `*.huella` del proyecto (marcas de deduplicación de Flow
  y de la voz), salvo los que estén dentro de `node_modules`.
- `SKILL.md`: regla de proyecto limpio — nada de `.py`, `.log` ni temporales sueltos en la raíz ni en `fuentes/`.

Verificado en el proyecto real: 0 `.huella`, sin `voz16k.wav`, sin `nul`/`_viejo-*`/`trozo-*`/`.tmp`/`__pycache__`,
sin `.py`/`.log` sueltos. Se conservan a propósito: `fuentes/huella.json` (huella del video para el registro),
`fuentes/voz/` (original, rapida, lenta, sha1, ai-studio), `portada/ia.log` (diagnóstico de la portada),
`public/img/` (fotos con licencia).

## Estilo 2 — `video-el-diff` (probado)

Proyecto de prueba: `D:\Hermit\video\video-el-diff\formato-vertical`
→ `out/el-diff-final.mp4` (38.3 s, 1080×1920, voz Bodi; tema: Gemini 4 Neon de Google; todo material original:
capturas reales con cita resaltada).

Cambios aplicados:

- `scripts/hacer.py`: al final del render exitoso borra los `*.huella` del proyecto (fuera de `node_modules`),
  `voz.log` (del `--solo-voz` en fondo) y `portada.jpg` cuando ya existe `portada.png` (crudo de Flow → queda solo
  el entregable).
- `scripts/citas.py` + `SKILL.md` (trabajo previo del mismo hilo): `citas.py` escribe también `citas.md`, las fichas
  en lectura para la etapa «Datos» del estudio (el JSON crudo ya no se muestra).
- `SKILL.md`: regla de proyecto limpio y lista de lo que se queda a propósito.

Verificado en el proyecto real: 0 `.huella`, sin `voz.log`, sin `portada.jpg`, sin temporales (`.parcial`, `_nueva`,
`bajando-*`, `copiando`, `pidiendo`, `mezcla.wav`, `encargo.json`, `.viejo`). Se conservan a propósito:
`fuentes/voz/voz16k.wav` (lo relee `cifras.py`), `fuentes/paginas/` (copias MHTML+JSON de las fuentes para
re-capturas offline), `out/master-*.m4a` y `out/partes/*.mov` (caché de re-render para `--otra-vez`),
`fuentes/ocr/` (caché de OCR de `ubicar.py`), `revision/` (hojas y cuadros de revisión).

Notas del estilo:

- `Duración: 0.5` da ~90 palabras narradas ≈ 38 s reales; el piso sano del formato es ~30-40 s (fuente + cita +
  remate + despedida).
- `guion.py` en proyectos viejos es resto del pipeline anterior a `director.py` (este último lee su `FORMATO` como
  fallback); los episodios nuevos no lo tienen.
- Las cachés compartidas del noticiero (`recortes/`, `metraje/`, `memes/`, `logos/` junto a los episodios) existen en
  el código pero no se poblaron en esta máquina: cada proyecto es autocontenido en `public/`.

## Estilo 3 — `reel-collage` (probado)

Prueba real: `D:\Hermit\video\reel-collage\reel-formato-vertical`
→ `out/reel-junta-sin-leer.mp4` (30.4 s, 1080×1920, voz Bodi; tema: presentar en una junta sin haber leído nada;
poses del usuario, escenarios y criatura generados en Flow).

Verificado en el proyecto: 0 `.huella`, sin `voz_cruda.wav`, sin `portada.jpg`, raíz limpia, las 6 poses restauradas
en `public/personaje/`, `fuentes/voz/` con la voz fuente y su alineación, `out/borrador.mp4` intencional.

Desviación observada: el agente no usó `scripts/voz.py` (que pide frase por frase a AI Studio); generó la narración
en una sola llamada y alineó a mano (`palabras_alineadas.json`). El resultado fue correcto, pero es más frágil en
guiones largos — si se repite, revisar si el SKILL debe documentar el camino alternativo.

Proyectos revisados: `reel-genera-cualquier-tema-viral`, `reel-programadores-junior-php-ayuda`,
`reel-programadores-php` (en `D:\Hermit\video\reel-collage\`).

Hallazgos y cambios aplicados:

- **Biblioteca de poses casi vacía**: `skills/reel-collage/personaje/` tenía `POSES.md` (9 poses documentadas) pero
  solo `parado.png` en disco — `nuevo.py` habría creado reels sin casi ninguna pose. Se restauraron las 6 poses que
  sobrevivían en `reel-programadores-junior-php-ayuda/public/personaje/` (cabeza, explicando, hablando, heroe,
  parado, sorprendido). La carpeta está gitignored: es la biblioteca de cada quien, no va al repo. `cargar`,
  `aventar`, `correr`, `patada` y `victoria` no existen en ningún lado: hay que pedirlas al usuario si un guion las
  necesita.
- `scripts/final.py`: al terminar borra los `*.huella` del proyecto (fuera de `node_modules`, que es enlace
  compartido) y `portada.jpg` cuando ya existe `portada.png`.
- `scripts/voz.py`: borra `voz_cruda.wav` tras el `loudnorm` (era el intermedio del mix; las `fNN.*` por frase se
  quedan: son la voz de cada una y el respaldo de lo que generó AI Studio).
- `SKILL.md`: regla de proyecto limpio y lista de lo que se queda a propósito (`fuentes/voz/fNN.*`,
  `out/borrador.mp4` para `revisar.py --sin-render`, `fuentes/` con originales y licencias).

Verificado: sintaxis, `comprobar-skills`, `typecheck` y `npm test` (360/360).

Notas del estilo:

- No tiene `hacer.py`: el pipeline es manual por pasos (`voz.py` → `revisar.py` → `final.py`), así que la limpieza va
  en `final.py`, el límite del ciclo de vida.
- `fuentes/scripts/` es el lugar designado para scripts de un solo uso: las raíces de los proyectos ya salían limpias.
- `navegador()` ya contempla Mac/Linux (Edge → Chrome → el que encuentre `chrome.mjs`).

## Reglas comunes que ya quedaron

- La limpieza va en el límite correcto del ciclo de vida (final del render exitoso), no en parches por archivo.
- `.huella` = marca temporal de deduplicación → se borra al entregar. `fuentes/huella.json` = huella permanente del
  video → se queda.
- `node_modules` es un junction/enlace a la carpeta compartida: el barrido de `*.huella` lo excluye siempre.
- Todo es `pathlib` puro: compatible con Windows, Linux y Mac.
- Archivos intermedios con `_` delante o `bajando-*`/`copiando`/`pidiendo` son temporales por convención y se borran
  en `finally` o por reemplazo atómico.

## Estilo 4 — `video-documental` (probado)

Prueba real: `D:\Hermit\video\video-documental\formato-vertical`
→ `out/final.mp4` (63.8 s, 1080×1920, voz Bodi sobre placa neutra generada en Flow; tema: por qué el cielo es azul;
39 momentos, material real: clips Mixkit, fotos NASA/Commons, páginas de Wikipedia y NASA Space Place).

Verificado en el proyecto: 0 `.huella`, sin `sfx-cues.txt`, sin logs ni temporales, `out/` solo con `final.mp4`,
`fuentes/` con la grabación (placa) y la voz, `work/` con los datos de la edición, `revision/` completa,
`FUENTES.md` con licencias declaradas, `momentos.md` legible en la etapa. `medida.json` confirma un solo ✘:
0.5 s de negro quieto a los 51.3 s (el clip de la Luna) — cambio opcional de `momentos.json`.

Pendiente de decisión del usuario: `_gen-azul/` (carpeta de trabajo del agente con la voz y la placa crudas y sus
`.huella`), fuera del proyecto.

Auditoría previa (proyecto `rumor-acumula-millones-reproducciones` y borrador `_rumor-acumula-tx`):

Proyectos revisados: `rumor-acumula-millones-reproducciones` (terminado) y `_rumor-acumula-tx` (borrador, limpio)
en `D:\Hermit\video\video-documental\`.

Cambios aplicados:

- `scripts/hacer.py`: al final del render exitoso borra los `*.huella` del proyecto (marcas de dedup del servidor:
  voz de AI Studio e imágenes) — fuera de `node_modules`, que es enlace compartido — y `sfx-cues.txt`, el intermedio
  del sonido que escribe `director.armar` y consume `sonido.py` en la misma pasada.
- `SKILL.md`: regla de proyecto limpio y lista de lo que se queda a propósito (`fuentes/`, `work/`,
  `public/assets/m/`, `public/sonido.wav`, `revision/`, `FUENTES.md`, `momentos.md`, `portada.png`,
  `out/final.mp4`).

Basura encontrada en el proyecto terminado (no del pipeline, decisión del usuario):

- `render.stdout.log` / `render.stderr.log`: ningún script de la skill los escribe; son de una corrida manual del
  agente. No se pueden distinguir de logs legítimos: quedan reportados.
- `Portada/`, `Revisión/`, `Video/`: copias byte a byte de `portada.png`, `revision/*` y `out/final.mp4` (verificado
  con `cmp`). No los toca la skill.
- `revision/` suelta en `D:\Hermit\video\video-documental\` (fuera de todo proyecto): `busca.jpg`/`busca.json` de una
  corrida de `buscar.py` hecha en la carpeta equivocada.

Verificado: sintaxis, `comprobar-skills`, `typecheck` y `npm test` (360/360).

Notas del estilo:

- Es el estilo más distinto: no hay `guion.md` ni escenas a mano; el agente solo escribe `momentos.json` y
  `hacer.py` hace todo (material → edición → render → medida → portada). La limpieza va al final de `hacer.py`.
- El proyecto real usó voz sintética de AI Studio como «grabación» y portada generada en Flow: usos fuera del caso
  típico (grabación propia), pero los artefactos resultantes son válidos.

## Estilo 5 — `video-top` (probado)

Prueba real: `D:\Hermit\video\video-top\top-formato-vertical`
→ `out/top-formato-vertical.mp4` (78.1 s, 1080×1920, voz Bodi; tema: Top 5 datos de los pulpos).

Verificado en el proyecto: video válido (H.264+AAC, 30 fps), análisis frame a frame sin negros ni congelados,
`revision/` solo con `hoja.png`/`tiempos.json`/`transcripcion.json` (la limpieza de `hacer.py` funcionó: 0
intermediarios, 0 `.huella`), raíz limpia (`guion.md`, `top.json`, `portada.png`), `out/` con final + `-base.mp4`
+ `.ass`, `fuentes/` con investigación, 12 imágenes y la voz.

Desviación del contrato (decisión del usuario en el prompt, no del agente): el `SKILL.md` pide material real con
licencia (`mixkit:`, `archive:`, `commons:`, `nasa:`) registrado en `FUENTES.md`, pero el mensaje pidió imágenes de
Flow y el agente generó las 12 con Nano Banana 2.1 — por eso no hay `FUENTES.md` (no hay nada que licenciar) y
`investigacion.md` lo declara. Las imágenes son ilustrativas, no archivo real: si el estilo debe ceñirse al material
con licencia, el prompt de prueba no debe pedir Flow.

Pendiente: portada provisional (Flow frenado); reintento automático.

Auditoría previa:

Proyectos revisados: `top-top-vertical-tiktok`, `top-top-vertical-tiktok-2` (contrato actual) y
`top-d-top-curiosidad-lago`, `top-manana-17-noviembre-gran`, `top-top-8-lenguajes-programacion` (pipeline anterior,
con `render_video.py` suelto y `README.md`; históricos, no los toca la skill) en `D:\Hermit\video\video-top\`.

Cambios aplicados:

- `scripts/hacer.py`: al final del render exitoso borra los intermediarios de `revision/` (`seg-*.mp4`, `visual.mp4`,
  `mezcla.wav`, `audio_master.wav`, `concat.txt`, `txt/` — 41–76 MB por proyecto, se regeneran en cada corrida), las
  `*.huella` del proyecto (fuera de `node_modules`) y `portada.jpg` cuando ya existe `portada.png`. Se quedan
  `revision/hoja.png`, `tiempos.json` y `transcripcion.json` (caché), `fuentes/`, `public/voz.wav`, `out/` (final +
  `-base.mp4` para re-subtitular + `.ass`) y `FUENTES.md`.
- `SKILL.md`: regla de proyecto limpio y lista de lo que se queda a propósito.

Hallazgos:

- `top-top-vertical-tiktok/out/` no tiene el `top-*.mp4` final (solo `_base.mp4` y `.ass`): proyecto incompleto o
  falló en subtítulos; no es basura de la skill.
- `revision/` suelta en `D:\Hermit\video\video-top\` (`busca.jpg`/`busca.json` de un `buscar.py` en carpeta
  equivocada) — mismo patrón que en video-documental.
- `fuentes/voz/generar.py` en un proyecto viejo: script de un solo uso dentro de `fuentes/` (límite aceptable).

Verificado: sintaxis, `comprobar-skills`, `typecheck` y `npm test` (360/360).

### Migración a plantilla Remotion (hecha después de la auditoría)

`video-top` dejó el render por `tramos.py`+drawtext y pasó a la arquitectura del documental: `top.json` sigue
siendo la entrada y `scripts/hacer.py` conserva voz, transcripción, escenas, material con licencia, audio
(voz+golpe+música → `public/sonido.wav`) y subtítulos (`subtitulos.py --estilo top`); lo nuevo es
`scripts/nuevo.py` (proyecto Remotion + `node_modules` compartido), `components/comp.py` (escribe
`src/edicion.json`), `components/director.py` (escenas cronometradas → capas: foto con paneo GSAP, clip con
`desde`/`velocidad`, textos «NÚMERO N»+titular con entrada, tarjeta negra) y `scripts/cuadros_render.cjs`
(cuadros pre-extraídos, con `velocidad` = cámara lenta real). La plantilla (`plantilla/`) lleva Anton + Inter
(woff2/TTF con licencias OFL en `assets/fonts/`) y `assets/tokens.css` con la paleta del estilo. `tramos.py` no se
tocó: lo siguen usando `video-motivacional` y `video-crimen`.

Prueba real del pipeline nuevo: `D:\Hermit\video\video-top\test-plantilla` (mismas entradas que
`top-formato-vertical`: voz Bodi 78 s, Top 5 pulpos, 12 fotos) → `out/top-test-plantilla.mp4` (78.0 s,
1080×1920, 30 fps, H.264+AAC, render Remotion 62 s). Verificado: 20 capas de foto con paneo suave (diff entre
cuadros consecutivos ~2.4), textos «NÚMERO N» amarillos y titulares presentes, audio en la edición
(`sonido.wav`), `revision/` limpio (`hoja.png`/`tiempos.json`/`transcripcion.json`), `public/material/` con los
enlaces de las fotos y `node_modules` enlazado. Sin clips de video en esta prueba (`videos: 0` en edicion.json):
el camino de clips con `velocidad` está implementado (`OffthreadVideo playbackRate` + `setpts` en
cuadros_render) pero no ejercitado — pendiente una prueba con `{"clip": …, "velocidad": 0.6}`.

**Identidad del formato (segunda iteración, verificada en `test-plantilla` re-renderizado):** el número dejó de
ser un drawtext tímido (96 px quieto) y pasó a ser el golpe visual del formato — «NÚMERO N» a ~175 px con slam
(escala 2.6→1, power4), shake de ±14 px en 5 cuadros y flash amarillo de 0,16 s, todo en el `t0` del golpe seco;
el #1 es más grande (~205 px), slam más fuerte (3.0, ±20 px, flash 0,8). Cada corte de material lleva punch-in
(escala 1.05→1) y las tarjetas negras llevan el número fantasma al 9 %. En sonido, `audio()` mezcla ahora cues
por escena: `swish_1` por puesto, `click_3` por corte de material, `riser_1`+`subboom_1` antes y con el #1,
`outro_1` al cierre (`sfx/` nuevo en la skill, copiado de `video-documental/sfx/ev1kit/`). Verificado en el
render: 68 líneas GSAP, 5 flashes, 25 shakes, 13 punches, flash visible en píxeles (142k px amarillos en el
t0 vs 70k después). `cards.json`: la etapa Material de `video-top` ahora busca en todo `fuentes/` y `material/`
(el proyecto real guarda las imágenes de Flow en `fuentes/flow/`, no en `fuentes/material/`).

**Arquitectura alineada con el documental (tercera iteración):** top era el único estilo probado que dejaba a
Remotion mezclar el audio del render (`<Audio>` horneado) y el único que usaba `subtitulos.py` con su `.ass` junto
al mp4 en `out/` — los reproductores lo auto-cargaban y se veían subtítulos dobles sobre los quemados. Ahora el
render va `--muted` y `sonido.wav` entra por ffmpeg (como `terminar.py` del documental; el `<Audio>` de la
plantilla queda solo para el monitor en vivo).

**Subtítulos dentro de la composición (cuarta iteración):** el karaoke dejó de ser un post-pase `subtitulos.py`
(`.ass` + ffmpeg) y pasó a ser capas del propio video, como en el documental: `hacer.py` saca los tiempos de
palabra de la transcripción de la voz con `palabras_tiempo`+`grupos_de_lineas` (exportadas de `subtitulos.py`,
que las sigue usando `ass()` para los demás estilos) y `director.subtitulos()` escribe una capa por línea con un
`<span>` por palabra; la palabra hablada se enciende en `--top-amarillo` por la línea GSAP (`tl.set` de
`className`), con las mismas medidas del ASS (Anton, 7 % del ancho, margen 21 %, 3 palabras por línea medidas con
la fuente real). El mux del render muteado **es** el final: `out/` queda solo con `top-<nombre>.mp4` — sin
`-base.mp4` ni `.ass`. Verificado en `test-plantilla` re-renderizado: 75 capas de subtítulo y 386 `tl.set` en
`edicion.json`, píxeles de la banda baja con blanco + amarillo del karaoke, `out/` limpio, audio idéntico a
`sonido.wav` (corr 0.9995). Ojo: cada proyecto guarda su copia de `tokens.css` — los ya creados hay que copiarles
el nuevo a `public/assets/top/` o el karaoke sale sin estilo.

**La «doble voz» era un off-by-one en `audio()` (quinto hallazgo):** el mixer de cues indexaba los inputs de
ffmpeg 0-based, pero la voz ocupa el input 0 y los sonidos van del 1 en adelante → el primer sonido de la lista
(`swish_1`, un cue por escena) leía `[0:a]`, o sea **la propia voz**: cada puesto metía una copia completa y
quieta (ganancia 0,16) de `voz.wav` retardada — la «misma voz de fondo leyendo los subtítulos». Además todos los
demás SFX estaban corridos uno y el último no sonaba. `indice()` ahora devuelve `pos + 1`. Los demás estilos no lo
tienen: usan amix fijo de 2 entradas. Verificado en `top-corto-top-3-animales` re-renderizado: `sonido.wav`
transcribe el guion una sola vez (15 segmentos) y `out/` solo tiene el mp4 final. Los videos top anteriores a este
arreglo llevan las copias de voz — hay que re-renderizarlos.

**La voz vive en `fuentes/voz/` (arquitectura de documental):** `public/voz.wav` era una copia duplicada de
`fuentes/voz/ai-studio.wav` (md5 idéntico) que `hacer.py` usaba como fuente del mix. Ahora la búsqueda prefiere
`fuentes/voz/*.wav` (la más reciente; es donde `generar_voz` la deja según VOZ.md), acepta `public/voz.wav` y
`voz.wav` como rutas viejas, y al terminar muda la voz a `fuentes/voz/` o borra las copias — `public/` queda solo
con `sonido.wav`, `material/` y `assets/`. `cards.json`: la etapa «Voz» de `video-top` acepta
`{fuentes/voz/*.wav,public/voz.wav,voz.wav}`. Verificado en `top-corto-top-3-animales`: `public/voz.wav` borrado
(duplicado exacto), voz encontrada en `fuentes/voz/ai-studio.wav`.

## Estilo 6 — `publicidad` (auditado y corregido, prueba pendiente)

Proyectos revisados: `publicidad-publicidad-cinematografica-entel-5g` (32.2 s) y
`publicidad-publicitario-app-hermit-informacion` (35.3 s), ambos 1080×1920 en
`D:\Hermit\video\publicidad\`.

Cambios aplicados:

- `scripts/hacer.py`: al final del render exitoso borra los intermediarios de `revision/` (`seg-*.mp4`,
  `visual.mp4`, `mezcla.wav`, `audio_master.wav`, `concat.txt`, `txt/`, `cierre-txt/` — 26–40 MB por proyecto,
  se regeneran en cada corrida), las `*.huella` del proyecto (fuera de `node_modules`) y `portada.jpg` cuando ya
  existe `portada.png`. Se quedan `revision/hoja.png`, `tiempos.json` y `transcripcion.json` (caché), `fuentes/`,
  `material/`, `fuentes/flow/`, `marca/`, `public/voz.wav`, la música, `marca.json`, `publicidad.json`, `out/`
  (final + `-base.mp4` + `.ass`) y `FUENTES.md`.
- `SKILL.md`: regla de proyecto limpio y lista de lo que se queda a propósito.

Verificado: sintaxis, `comprobar-skills`, `typecheck` y `npm test` (360/360). Las etapas de la card ya muestran
archivos legibles (logo, `investigacion.md`, `guion.md`, imágenes de material) — sin JSON crudo.

Notas:

- `publicidad.json` es el contrato declarativo del estilo (anatomía gancho→cierre, `tipo` por escena, `t` en modo
  música); `marca.json` lleva la marca verificada con su logo oficial — el cierre nunca usa logo generado por IA.
- Los proyectos reales usaron material propio en `material/` (imágenes del usuario/Flow) y voz de AI Studio:
  válidos según el SKILL.

## Estilo 6 — `publicidad` (probado)

Prueba real: `D:\Hermit\video\publicidad\publicidad-formato-vertical`
→ `out/publicidad-formato-vertical.mp4` (39.3 s, 1080×1920, voz Bodi; anuncio de ECEBOL Cemento IP-40 para
construcción en La Paz/El Alto).

Verificado en el proyecto: video válido (H.264+AAC, 30 fps), 0 `.huella`, 0 intermediarios en `revision/` (solo
`hoja.png`/`tiempos.json`/`transcripcion.json`), raíz limpia, `out/` con final + `-base.mp4` + `.ass`,
`marca/ecebol-logo.png` oficial, `marca.json` con datos verificados de ecebol.com.bo (color #146056, CTA WhatsApp
real), `publicidad.json` con anatomía completa (gancho→problema→solución→prueba→cierre, cierre sin material).

Claims: la disciplina funcionó — «impermeabilidad» no está en la web oficial, quedó «a confirmar» en
`fuentes/investigacion.md` y no entró al video; los que sí entraron (40 MPa NB-011, puzolana, menor fisuración,
calor de hidratación, presentaciones) están citados. La empresa no publica eslogan: el cierre usa «Cementos de
Bolivia» como texto verificado.

Material: 8 imágenes generadas en Flow (Nano Banana 2.1) en `fuentes/flow/` — dentro del contrato del estilo,
que prevé material generado ahí (a diferencia de video-top, que pide material con licencia). El datasheet IP-40
quedó en `fuentes/` como evidencia.

Pendiente: portada provisional (Flow frenado, reintento automático); avisar «cámbiala» cuando salga la de Flow.

### Migración a plantilla Remotion (hecha después de la prueba)

`publicidad` dejó el render por `tramos.py`+drawtext+`render_cierre` y pasó a la arquitectura del top y el
documental: `publicidad.json` y `marca.json` siguen siendo la entrada y `scripts/hacer.py` conserva validación
de anatomía, los tres `sonido` (voz/ambos/musica con `t`), material con licencia, audio (voz+música →
`public/sonido.wav`) y portada; lo nuevo es `scripts/nuevo.py` (proyecto Remotion + `node_modules` compartido),
`components/comp.py` (escribe `src/edicion.json`), `components/director.py` (escenas → capas: foto con paneo
GSAP, clip con `desde`/`velocidad`, textos titular+`sub` que entran en cada corte, tarjeta de marca del cierre
con entradas escalonadas, karaoke con acento de marca cortado en el cierre) y `scripts/cuadros_render.cjs`
(cuadros pre-extraídos). `plantilla/` lleva Anton + Inter (OFL) y `assets/tokens.css` con las piezas `pub-*`;
los colores de la marca (`color`, `fondo`, tinta del CTA) se inyectan como variables CSS en la edición. La voz
pasa a vivir en `fuentes/voz/` como en top/documental (`cards.json` etapa «Voz» actualizada).

Prueba real del pipeline nuevo: `D:\Hermit\video\publicidad\test-anuncio-cenit` (proyecto nuevo, marca ficticia
«Cenit» café, voz Fish Audio «Adam» —AI Studio daba 403—, 6 fotos PIL, 5 escenas) →
`out/publicidad-test-anuncio-cenit.mp4` (45.5 s, 1080×1920, 30 fps, render 37 s). Verificado: `out/` solo el
mp4, `revision/` solo hoja/tiempos/transcripción, 58 capas en `edicion.json` (6 material, 6 textos, 42 karaoke,
fondo+logo+eslogan+cta del cierre), karaoke con acento #e8a33d solo hasta el cierre (0 px después), píldora
CTA ámbar con tinta oscura medida en píxeles, `comprobar.mjs` todo en orden (−14.3 LUFS, sin negros), `tsc`
limpio. Mismos pendientes que top: el camino de clips (`{"clip":…,"velocidad"}`) y el modo `sonido:"musica"`
implementados pero sin prueba real aún.

### Motion design de anuncio (segunda pasada, verificada)

El estilo subió a «comercial de verdad»: `TIPOS` creció a `gancho, problema, solucion, beneficios, prueba,
oferta, cierre` (los del medio flexibles; nuevo campo `oferta` ≤30 chars solo en `tipo: oferta` → sticker
inclinado del color de marca con pop elástico). Piezas nuevas en `tokens.css`/`director.py`: slam del
titular del gancho (escala+giro+shake), flash del color de marca en cada corte de escena, barra de progreso
arriba todo el video, filete bajo el titular, tipo fantasma en tarjetas, marca de agua, glow tras el logo,
brillo que cruza la píldora CTA una vez, `sitio` de marca.json bajo el CTA y karaoke con palabra activa que
crece. Kit `sfx/` propio (swish por escena, click por corte de material, riser+impacto+subboom en el cierre,
outro) mezclado por `hacer.py` en los tres modos de `sonido` (cues por `adelay`, amix `duration=first`).
`hacer.py` además refresca `public/assets/pub/tokens.css` desde la skill en cada corrida (la copia del
proyecto quedaba vieja si la skill mejoraba) y `nuevo.py` enlaza módulos como `publicidad-*` (nombre de la
skill: `comprobar-skills` ya typechequea `publicidad/plantilla`).

Re-verificado con re-render del mismo proyecto (`publicidad-test-anuncio-cenit.mp4`, oferta+sitio+tarjeta de
problema añadidos al json de prueba): `comprobar.mjs` todo en orden; píxeles — barra ámbar creciendo
(x157→473→908 según el tiempo), sticker «-20% SOLO HOY» (~19k px ámbar), sitio «cenit.cafe» bajo el CTA,
marca de agua «CENIT», ghost «PROBLEMA» en la tarjeta, glow/píldora del cierre. Bug encontrado y corregido en
la verificación: la edición leía el `tokens.css` viejo del proyecto — de ahí el sync automático de arriba.

### Prueba real con marca real + fixes de lectura (tercera pasada)

Prueba real: proyecto nuevo en `D:\Hermit\video\publicidad\` — anuncio de una marca real de lácteos
(logo oficial con transparencia, eslogan y colores verificados en su web, `sitio` real; claims solo los
ciertos: años de trayectoria y cobertura declarada). 6 escenas, voz de AI Studio (Commercial Voiceover),
5 clips de stock con licencia (Mixkit: leche en slow motion, vacas, vaso).
→ `out/publicidad-<nombre>.mp4` (35.8 s, 1080×1920, 30 fps, −14.1 LUFS, `comprobar.mjs` todo en orden).

Dos correcciones que salieron de este video:

- **Texto blanco ilegible sobre leche blanca**: titulares y karaoke se lavaban contra el material claro.
  Solución estándar de motion design (no parche): `.pub-velo`, degradados oscuros arriba/abajo solo en escenas
  con material (z=2, bajo textos/karaoke, sin tocar el centro). Verificado por diff de píxeles: zonas de texto
  ~35 % más oscuras, centro intacto.
- **Tipografía de anuncio**: se añadió **Bebas Neue** (OFL, ya estaba en `video-base/assets/fonts/`) como voz
  «de oferta» — píldora del CTA, sticker y ghost de tarjetas; Anton sigue en titulares/eslogan/karaoke e Inter
  en `sub`/marca/`sitio`. `_tam_que_cabe` y el ancho del ghost miden con las métricas reales de Bebas.
  `hacer.py` sincroniza tokens.css **y fuentes** a `public/assets/pub/` en cada corrida (los proyectos viejos
  reciben Bebas solos al re-renderizar).

Auditoría de limpieza del proyecto (contra top/documental): `out/` solo el mp4, `revision/` hoja/tiempos/
transcripción, `fuentes/` investigación+material+voz, `marca/` logo oficial, `public/` enlaces duros,
`node_modules` junction compartida, cero restos del pipeline viejo. Los nombres `public/material/e1-1-e1-1.mp4`
duplican el ident porque los archivos bajados de bancos ya lo traen — misma convención que `video-top`, no bug.

### Prueba desde la UI + hallazgo de limpieza transversal

El usuario lanzó el estilo desde el chat de Hermit: anuncio de internet hogar de una telecom real (marca
verificada en su web, voz de AI Studio, 4 imágenes de Flow). El agente paró en la portada porque Google frenó
las cuentas de Flow.
→ `out/publicidad-<nombre>.mp4` completo (29.5 s, 1080×1920, 30 fps, h264+AAC, −14.2 LUFS) y `portada.png`
provisional (`portada_sin_ia.mjs`: cuadro del video + título) — lo que manda PORTADA.md cuando Flow no puede;
`portada/ref-1/2/3.jpg` quedan como referencias para el reintento («cámbiala»).

Hallazgo de limpieza (afecta a todos los estilos de video): el agente dejó `marca/logo-preview.html`, un HTML
temporal de 150 bytes para rasterizar el SVG del logo a PNG. La regla de «proyecto limpio» de los SKILL.md nombra
solo «raíz ni `fuentes/`» — `marca/` quedó fuera de la letra. Pendiente de decisión: ampliar la regla a
«ninguna carpeta del proyecto» y/o barrido de temporales (`*.html`, `*.log`, `*.tmp`…) en `hacer.py`.

## Estilo 7 — `video-reddit` (auditado, corregido y probado)

La migración a Remotion ya existía en la skill (sin commitear) pero **nunca se había probado**: la plantilla no
tenía `package-lock.json` (rompía `nuevo.py` en `enlazar_modulos`), `comprobar-skills` saltaba sus tipos («sin un
video de este estilo con node_modules») y el único proyecto de prueba era del pipeline viejo.

Correcciones aplicadas (todas de raíz, verificado con render real):

- **`plantilla/package-lock.json`** generado (`npm install --package-lock-only`): `nuevo.py` ya crea el proyecto
  y enlaza el módulo compartido `video-reddit-*`; `comprobar-skills` ahora sí mira sus tipos → verde.
- **`hacer.py` subtítulos**: pasaba un dict inventado (`max_caracteres`/`max_lineas`) a `grupos_de_lineas`, que
  espera un estilo de `ESTILOS` de `subtitulos.py` → `KeyError: 'tam_v'` en el primer render real. Ahora usa
  `ESTILOS["varela"]` (Varela Round, la fuente del karaoke; la medida de línea sale de la fuente real).
- **Tarjeta responsive**: sus tamaños eran px fijos (26/34/22 px, padding, icono) — en horizontal 1920×1080
  quedaba la mitad de grande relativa. Ahora `tokens.css` mide todo con `calc(Npx * var(--rcs))` y el director
  pone `--rcs = min(ancho/1080, alto/1920)` en el wrap (misma idea que la `escala` de video-top).
- **Karaoke con palabras cortadas (bug real del render)**: dos causas de raíz, no una. (1) `grupos_de_lineas`
  media las líneas con el texto de la transcripción en su caja original (minúsculas) pero el karaoke las pinta en
  `.upper()` — la mayúscula es ~25 % más ancha: 20 de 41 líneas desbordaban el cuadro (hasta 1312 px en 993 px
  útiles). Ahora las palabras entran a `grupos_de_lineas` ya en mayúsculas y el `estilo` lleva `tam_v`/`tam_h`
  calculados al tamaño mayor renderizado (el centro va al 108 %). (2) El karaoke usaba márgenes laterales 4 %
  mientras `subtitulos.py` asume 60 px por lado: ahora es `left:0;right:0` centrado, como `top-karaoke`.
  Verificado: 0 px de texto en los bordes del cuadro en los cuadros muestreados.
- **Bucle del fondo sin corte**: antes cada repetición del clip reiniciaba en el segundo 0 a sangre. Ahora las
  vueltas se montan con **fundido cruzado de 0,4 s** (solape real de segmentos en `edicion.json`) y **deriva de
  escala alternada** (una vuelta zoom-in, la siguiente zoom-out) para que el reinicio no se note. Verificado:
  diff medio entre cuadros del fundido ~1–2 (sin pico de corte).
- **Música con ducking real**: era `volume=0.08` fijo aunque el SKILL.md prometía ducking. Ahora la música en
  bucle pasa por `sidechaincompress` con la voz como clave — medido sobre el render: la música baja ~1,5–3,5 dB bajo la voz y vuelve en las pausas
  más `afade` de entrada/salida; la voz se duplica con `asplit` para alimentar mezcla y compresor.
- **Cues de sonido amarrados a `t_tarjeta`**: la constante `T_TARJETA = 3.0` la comparten la tarjeta, el
  `director.armar` y los cues (pop/upvote/whoosh) — antes estaban hardcodeados por separado.

Prueba real: `D:\Hermit\video\video-reddit\reddit-prueba-profesional` (post de confesión, voz Knox de AI Studio
51.3 s, fondo aéreo nocturno de Mixkit con licencia; sin cama de música — el ducking se verificó aparte con una
pista temporal ya retirada).
→ `out/reddit-prueba-profesional.mp4` (51.3 s, 1080×1920, 30 fps, h264+AAC, −14.2 LUFS, `comprobar.mjs` todo en
orden).

Verificado: tarjeta nativa presente solo en el tramo inicial (zona exacta #1a1a1b ~34 % del cuadro a f30, ~9 %
de coincidencia de fondo después), karaoke naranja #FF4500 abajo durante la tarjeta y al centro después, 10
segmentos de fondo con solapes de 12 cuadros y 30 tweens de opacidad + 20 derivas de escala en `edicion.json`,
proyecto limpio (`out/` solo el mp4, voz en `fuentes/voz/`, `work/fondo.json` sello, cero restos del pipeline
viejo). Pendiente honesto: `--formato horizontal` comparte el mismo código parametrizado pero no tiene render de
prueba propio; el video final no lleva cama de música (voz + SFX del estilo); el ducking quedó implementado y medido (~1,5–3,5 dB
bajo la voz) para cuando el agente ponga `public/musica.mp3` con material con licencia.

### Segunda pasada — identidad Reddit real + sync de assets

El usuario pidió que la tarjeta fuera la de Reddit de verdad (la investigación del género — Crealix, Clippie,
MyShorts — documenta la UI real: tarjeta clara u oscura, insignia de verificado, barra de acciones completa) y que
los subtítulos no cortaran palabras.

- **`tokens.css`/`director.py`**: la tarjeta ahora es la UI real del post de Reddit — barra de acciones completa
  (píldora upvote `↑ votos ↓` en naranja, píldora de comentarios, e iconos de **compartir** y **guardar**),
  `post.json` admite `"tema": "claro"` (paleta clara de la app: tarjeta blanca, título #1c1c1c, píldoras #f6f7f8)
  y `"verificado": true` (insignia azul #0079d3 junto al autor). Todo escala con `--rcs`.
- **`hacer.py` sincroniza `assets/` → `public/assets/reddit/`** en cada corrida (tokens.css + fuentes), igual que
  `publicidad`: el proyecto copia la piel al crearse y sin el sync las mejoras de la skill no llegaban (el render
  de prueba salió con la tarjeta vieja hasta sincronizar). **Hallazgo transversal**: `video-top`,
  `video-documental`, `video-el-diff`, `reel-collage`, `video-explicativo` y `video-propio` tienen el mismo hueco —
  ningún `hacer.py` suyo refresca `assets/`; pendiente de decisión aplicarlo igual.

Re-render del proyecto de prueba con `tema: claro` + `verificado`: tarjeta blanca con título oscuro, insignia azul
y las 4 acciones presentes (verificado en `edicion.json` y píxeles); karaoke sin desborde; `comprobar.mjs` todo
en orden (−14.1 LUFS).

## Estilo 8 — `video-motivacional` (migrado a Remotion y probado)

El estilo estaba en el pipeline viejo de ffmpeg (`escenas.json` → tramos con `zoompan` + `eq`/`hue`, karaoke por
`.ass`, mezcla manual). Se migró completo a la arquitectura compartida, conservando el contrato `escenas.json`
(`palabra`, `look`, `titular`, `material` de 1–4 cosas por escena) y la identidad propia del estilo:

- **`plantilla/` Remotion** (`Motivacional.tsx`, `Root.tsx`, `edicion.json`) con la misma arquitectura que
  `video-top` (capas con tramo de cuadros, `tl.seek` por cuadro, `OffthreadVideo` en vivo y `_cuadros/` en el
  render), `components/{comp,director}.py`, `scripts/{nuevo,hacer,cuadros_render}.py`, `assets/` con
  **BebasNeue-Regular + licencia OFL**, `tokens.css` y `sfx/` (swish + subboom del kit compartido).
- **Identidad propia, nada genérica**: karaoke minimalista en Bebas Neue — blanco puro, palabra activa en
  blanco cálido #FFF4E6, contorno negro, abajo al 21 % del alto en vertical (10 % en horizontal), 7,2 %/4,4 %
  del ancho— igual que el ASS `minimal` que reemplazó; tarjetas de cita sobre fondo negro puro con la cita
  centrada a 0,06 del ancho y 1,28 de interlínea; `look` por escena como filtro CSS de la capa (`bn`,
  `desaturado` —el de omisión—, `color`), equivalente de los `eq`/`hue` de ffmpeg; paneo Ken Burns centrado
  1.0↔1.12 alternando por tramo (el `k_tramo % 2` de `render_tramo`); cortes secos como el concat, sin golpes
  ni flashes — el movimiento lo pone solo el paneo, como pedía la esencia.
- **Sonido**: `swish_1` en cada corte de escena y más bajo en cada cambio de material; `subboom_1` al entrar
  cada tarjeta de cita; música a 0,08 con fundidos 2,5 s/3 s y **ducking real** (sidechaincompress, como en
  reddit/top).
- **Bug de raíz encontrado y corregido en `video-base/scripts/bancos.py`**: `resolver()` no validaba el tipo —
  un `{"foto": "mixkit:…"}` (o `archive:`/`yt:`) bajaba el mp4 renombrado a `.jpg` y el `<img>` del estilo salía
  negro (así falló el primer render de prueba). Ahora una `foto` con banco de video falla con mensaje claro;
  protege a todos los estilos que usan `traer_items` (top, publicidad, documental, motivacional…).
- **Aprendizaje de anclaje**: las tarjetas de cita sin narración propia necesitan `palabra` con margen — si se
  anclan al final de la frase anterior quedan <1 s en pantalla. En la prueba se anclaron para cubrir la frase
  siguiente (~3,5–3,8 s), que es lo legible.

Prueba real: `D:\Hermit\video\video-motivacional\mot-prueba` → `out/motivacional-mot-prueba.mp4`
(33.1 s, 1080×1920, 30 fps, h264+AAC, −14.2 LUFS). Verificado: 8 escenas (6 de material + 2 tarjetas de cita),
looks aplicados por capa (bn ≈ escala de grises, desaturado con saturación media ~26), karaoke con palabra
activa cálida detectada en píxeles, `comprobar.mjs` en orden salvo «cuadros negros» que son las tarjetas de
cita a propósito (fondo negro del estilo — documentado en SKILL.md) y 0,2 s de apertura oscura de un clip de
origen. Proyecto limpio: `out/` solo el mp4, voz en `fuentes/voz/`, `FUENTES.md` con las 10 licencias,
`node_modules` enlazado al compartido `video-motivacional-*`. `comprobar-skills` → `video-motivacional/plantilla: tipos` ✓.

Pendiente honesto: `--formato horizontal` comparte el código parametrizado sin render propio; `velocidad` en
clips probado (0,7 en la escena del gimnasio); la cama de música con ducking quedó implementada y el proyecto
de prueba no la usó (voz + SFX solamente, como manda el estilo cuando no hay música).

## Estilo 9 — `video-crimen` (migrado a Remotion y probado)

El estilo estaba en el pipeline viejo de ffmpeg (`escenas.json` → tramos con `zoompan` + `eq`/`colorchannelmixer`,
`noise`+`vignette` de ambiente, subtítulos por `.ass --estilo crimen`). Se migró completo a la arquitectura
compartida, conservando el contrato `escenas.json` (`palabra`, `look`, `titular`, `material` de 1–4 cosas por
escena) y la identidad propia del expediente:

- **`plantilla/` Remotion** (`Crimen.tsx`, `Root.tsx`, `edicion.json`) con la misma arquitectura que el top y el
  motivacional (capas con tramo de cuadros, `tl.seek` por cuadro, `OffthreadVideo` en vivo y `_cuadros/` en el
  render), `components/{comp,director}.py`, `scripts/{nuevo,hacer,cuadros_render}.py`, `assets/` con
  **CourierPrime-Bold + CourierPrime-Regular + licencia OFL**, `tokens.css` y `sfx/` propios del tono:
  `subtone_1` (dron grave) al abrir, `clicktrain_1..4` rotando (la máquina de escribir) en cada tarjeta de
  expediente, `swish_1` en los cortes.
- **Identidad propia, nada genérica**: el **grano de película y la viñeta** van sobre TODO el material — grano
  SVG `feTurbulence` que vibra en saltos de ~2 cuadros por la línea GSAP (el `allf=t` del noise de ffmpeg) y
  viñeta radial; el `look` es filtro CSS **solo del medio**, así el grano queda sin filtrar como en el viejo
  (`frio` el de expediente —el de omisión—, `sepia`, `color`); tarjetas de expediente sobre negro con Courier
  Prime Bold en **ámbar #ffb042** a 0,05 del ancho y 1,28 de interlínea; karaoke Courier Prime — 3 palabras por
  línea, blanco con contorno 0,14 y sombra 0,08 del cuerpo, palabra activa en ámbar, abajo al 21 %/10 %—.
- **Sonido**: el viejo mezclaba música a volumen fijo sin ducking ni efectos; el nuevo lleva `subtone_1` de
  apertura, la máquina de escribir en cada tarjeta, swish en cortes y cambios de material, y música con
  fundidos + **ducking real** (sidechaincompress).
- **Aprendizajes**: `fuentes/evidencia/` es la carpeta del material del estilo (no `fuentes/material/`);
  `fuentes/caso.md` es obligatorio junto a `guion.md` y `escenas.json`; las palabras del karaoke entran ya en
  mayúsculas a `grupos_de_lineas` (la medida es la del texto que se ve — el mismo fallo del reddit).

**Bug corregido también en `video-motivacional`**: su `hacer.py` medía las palabras en minúsculas y el karaoke
las pinta en mayúsculas — una línea «cabía» en la medida y podía salirse en pantalla (el mismo fallo que se
corrigió en reddit). Ahora entra en mayúsculas a `grupos_de_lineas`, como en crimen.

Prueba real: `D:\Hermit\video\video-crimen\cri-prueba` (el caso del Hombre de Somerton) →
`out/crimen-cri-prueba.mp4` (59.2 s, 1080×1920, 30 fps, h264+AAC, −14.1 LUFS, faststart). Verificado: 8 escenas
(5 de material + 3 tarjetas ámbar), los 8 clips con `look` `frio` por defecto, 8 capas de grano animado, karaoke
Courier Prime con palabra ámbar detectada en píxeles (0,18 % del cuadro en escena de material), tarjetas con
ámbar ~0,8 % sobre negro, saturación media ~0,04 (el frío se lee), `comprobar.mjs` en orden salvo «cuadros
negros» que son las 3 tarjetas a propósito y un fundido a negro de 0,23 s dentro del clip de lluvia
(`mixkit:100558` abre en negro; contenido del banco, no fallo del estilo). Proyecto limpio: `out/` solo el mp4,
voz en `fuentes/voz/`, evidencia con licencia en `FUENTES.md`, `caso.md` con la cronología y fuentes.
`comprobar-skills` → `video-crimen/plantilla: tipos` quedó pendiente hasta que `nuevo.py` enlazó
`node_modules` (ya enlazado en el proyecto de prueba).

Pendiente honesto: `--formato horizontal` comparte el código parametrizado sin render propio; `velocidad` en
clips sin probar en este estilo (el mecanismo es el mismo de los hermanos ya probados); la cama de música con
ducking quedó implementada y el proyecto de prueba no la usó (voz + SFX solamente).

**Segunda pasada (sonido y animación del estilo)**: el kit `sfx/` creció a `subtone_1` + `riser_1` (dron y
subida al abrir), `clicktrain_1..4` (máquina de escribir en cada tarjeta), `tick_1` (tictac bajo al entrar cada
escena de material), `swish_1` (cortes) e `impact_1` (la última escena). Las tarjetas de expediente ahora entran
como un sello que se clava (escala 1,15→1 con opacidad en 0,3 s, por la línea GSAP). Re-render del proyecto de
prueba con una cama de suspenso sintetizada en `public/musica.wav` (drone grave + motivo menor espaciado +
pulso lento, hecha para la prueba — el estilo sigue sin música propia, la pone el agente): el `audio()` del
`hacer.py` la mezcla a 0,08 con fundidos y **ducking real**, verificado en el mp4 (−14,2 LUFS, −0,9 dBTP).

**Tercera pasada (cama de suspenso propia)**: `scripts/musica.py` del estilo sintetiza la cama del expediente
(dron La1/La1# desafinado con respiración, motivo menor espaciado, pulso grave cada 2 s y polvo de cinta), WAV
estéreo 48 kHz del largo de la voz (lo mide solo de `fuentes/voz/`), determinista por semilla, sin licencias.
El SKILL.md la ofrece como vía oficial del paso «Música». Al integrarla aparecía un fallo real: la mezcla
quedaba tan densa que el limitador de `masterizar.mjs` trabajaba al techo (−1,3 dBTP en todo el archivo) y el
AAC subía el true peak a −0,8 dBTP — cualquier cama o voz densa reproducía el fallo. **Arreglo de raíz**:
`hacer.py` masteriza con `--pico -1.4` (margen para el remate inter-muestra del AAC), así el mp4 sale siempre
con cabeza sin importar la mezcla. Verificado con las ganancias completas del estilo (`subtone` 0,10 · `riser`
0,05 · `swish` 0,08 · `tick` 0,04 · `impact` 0,06 · música 0,08): −14,2 LUFS / −1,1 dBTP, `comprobar.mjs` en
orden. Re-render: 59,2 s, todo igual más la cama con ducking.

**Cuarta pasada (piel de expediente)**: las `foto` del material dejaron de ser fondo — ahora van como pieza de
expediente: marco con borde claro y sombra (`.cri-evidencia`, que no se mueve con el paneo) y `pie` opcional en
el item de `escenas.json` (leyenda Courier Prime en ámbar abajo a la izquierda: la fecha y el lugar sobrepuestos,
como en los créditos del género; solo en `foto`, máx. 80 caracteres, validado en `leer_escenas`). Las tarjetas
llevan marco de documento clasificado con marcas de registro en las cuatro esquinas (`.cri-doc`) y el texto entra
como sello que se clava. **Fallo encontrado y corregido en la prueba**: `nuevo.py` copia `tokens.css` una sola
vez al crear el proyecto, así que un proyecto creado antes de una actualización del estilo renderiza el HTML
nuevo sin su CSS (marco invisible) — el proyecto de prueba se re-creó con el tokens nuevo y renderizó bien; los
proyectos ya entregados conservan la piel con la que nacieron, que es lo correcto. Verificado en píxeles sobre
el mp4 final: borde del marco (fila clara en el inset 4,5 %), pie ámbar en su zona y texto ámbar de tarjeta;
`comprobar.mjs` → −14,2 LUFS / −1,2 dBTP, «cuadros negros» solo en las tarjetas a propósito.

## Estilo 10 — `video-politica` (migrado a Remotion y probado)

El estilo estaba en el pipeline viejo de ffmpeg (`montaje.json` → `zoompan` Ken Burns + `fade` por escena,
subtítulos por `.ass` con Archivo Black y color dinámico, música a volumen fijo sin ducking ni efectos, sin
`nuevo.py`). Se migró completo a la arquitectura compartida conservando el contrato `montaje.json` (`palabra`,
`imagen` —una foto por escena, ruta local o referencia con licencia—, `titular` opcional) y la identidad del
formato:

- **`plantilla/` Remotion** (`Politica.tsx`, `Root.tsx`, `edicion.json`) con la arquitectura de los hermanos,
  `components/{comp,director}.py`, `scripts/{nuevo,hacer,cuadros_render}.py`, `assets/` con
  **ArchivoBlack-Regular + licencia OFL** y `tokens.css` propio, `sfx/` del tono noticiero:
  `subboom_1`+`riser_1` al abrir, `swish_1` en cada escena, `click_1..3` rotando en cada `titular`,
  `impact_1` en la última.
- **Identidad propia**: cada imagen a pantalla completa **limpia, sin nada estampado** (regla del formato), con
  paneo Ken Burns 1,0↔1,15 alternando por escena y **fundido de entrada y salida de 0,18 s** — la transición
  editorial, por capas GSAP; el `titular` es el banner de alerta superior en Archivo Black blanco con contorno
  negro (las medidas del ASS viejo: 0,52 del cuerpo, margen 4,5 %); subtítulos en **bloques de 3 palabras** con
  la cifra/dinero en **amarillo `#ffff00`** y la alarma en **rojo `#ff3333`** — los mismos `PATRON_*` del
  pipeline viejo portados a clases del director.
- **Sonido**: música incidental con **ducking real** (sidechaincompress) y fundidos — el viejo la mezclaba a
  volumen fijo sin ducking ni efectos.
- **Voz**: ahora en `fuentes/voz/` (VOZ.md), como los demás estilos; `public/voz.wav`/`voz.wav` siguen valiendo
  como rutas viejas.

Prueba real: `D:\Hermit\video\video-politica\pol-prueba` (el corralito argentino de 2001, caso con datos en
`fuentes/caso.md`) → `out/politica-pol-prueba.mp4` (65,1 s, 1080×1920, 30 fps, h264+AAC, −14,2 LUFS,
−1,5 dBTP, faststart). Verificado: `comprobar.mjs` todo en orden **sin cuadros negros** (todas las escenas
llevan imagen), 7 escenas con sus 7 titulares, 66 capas de subtítulos, amarillo de cifras detectado en píxeles
(0,18 % en escena de datos), `comprobar-skills` → `video-politica/plantilla: tipos` ✓. Voz Charon (403 transitorio
de AI Studio resuelto al reintentar).

**Limitación de la prueba (de contenido, no del estilo)**: `upload.wikimedia.org` vetó la IP por rate limit
(HTTP 429 sostenido) a mitad de la descarga del material; solo entraron 2 fotos de Commons y las escenas
restantes reutilizaron esas dos imágenes locales para poder renderizar. En uso real, con el banco libre, cada
escena lleva su imagen — el contrato y el pipeline son los mismos.

**`video-clips` revisado y descartado para migración**: no es un estilo visual sino un cortador (recorte por
transcripción, reencuadre por detección de caras, subtítulos karaoke multi-estilo, salida a `out/redes/`). Su
pipeline ffmpeg es el correcto para la tarea y ya funciona; no tiene ni necesita plantilla Remotion.

**Ajuste de subtítulos (revisión del usuario, segunda pasada)**: achicar la letra por bloque no era solución —
el cuerpo debe ser igual en todos. Se sustituyó por el mecanismo real de los hermanos: `grupos_de_lineas` +
`palabras_tiempo` + `linea` de `subtitulos.py` (video-base), que agrupan hasta 3 palabras por línea **medidas
con la Archivo Black real**; lo que no cabe en el marco útil (960 px) pasa a otra línea y corta tras
puntuación de cierre, igual que en top/documental. En la prueba: 67 líneas, todas a 71 px uniformes, la frase
larga «PASARON CINCO PRESIDENTES.» partida en dos líneas, colores amarillo/rojo intactos.

Pendiente honesto: `--formato horizontal` comparte el código parametrizado sin render propio; el color rojo de
alarma no apareció en la prueba porque el guion de prueba no tenía palabras del `PATRON_ALARMA` (el mecanismo
está, es por contenido).
