---
name: video-politica
description: Hace un video de análisis político y económico incisivo y riguroso («Política sin filtro»), vertical (TikTok, Reels, Shorts) u horizontal (YouTube). Formato de alto impacto y debate basado en evidencia demostrable: qué decidió el político, cuánto costó, a quién benefició y cómo afectó a los ciudadanos, con documentos oficiales resaltados, cifras duras, subtítulos dinámicos en colores de choque y remate polarizante para comentarios. Úsalo cuando pidan un video de política, análisis de gobernantes, medidas económicas polémicas o noticias políticas sin censura.
---

# Política sin filtro

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`LEEME.md`](../video-base/LEEME.md) (los
errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md), [`VOZ.md`](../video-base/VOZ.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

Un formato periodístico incisivo, serio y de alta retención donde se expone la gestión de figuras públicas y gobiernos con datos fríos y pruebas contundentes:

- **Crítica dura fundamentada en evidencia:** Se puede señalar con firmeza que una decisión perjudicó al país, siempre que haya respaldo. Es mejor exponer decretos, partidas presupuestarias, contratos y consecuencias cuantificables que atribuir delitos o intenciones sin pruebas judiciales.
- **Estructura de 60 segundos (Retención máxima):**
  - **0–5 s (El Gancho):** Dato demoledor o pregunta incómoda que detiene el scroll (*«¿A dónde fueron a parar los 40 millones del fondo de emergencia?»*).
  - **5–20 s (La Decisión):** Qué hizo el político, en qué fecha y qué prometió al anunciarlo.
  - **20–40 s (El Impacto Real):** Qué consecuencias trajo al país o la población: inflación, desempleo, a qué sector benefició y cómo afectó al bolsillo común.
  - **40–55 s (Las Pruebas):** Recortes de auditorías oficiales, contratos, leyes en gaceta o declaraciones grabadas con efecto de resaltador.
  - **55–60 s (Cierre crítico + Pregunta):** Conclusión frontal y pregunta abierta para detonar el debate en los comentarios (*«Los números están ahí. La pregunta es: ¿negligencia o beneficio propio? Te leo en los comentarios»*).
- **Subtítulos de impacto visual:** En **Archivo Black** (la ancha del mitin), bloques de 3 palabras con colores de choque: **amarillo fluorescente** `#ffff00` para cifras, dinero y fechas; **rojo alarma** `#ff3333` para palabras de conflicto y tensión; **blanco puro** con contorno negro profundo de fondo.
- **Material híbrido (Fotos reales + IA):**
  - Si el video habla de una **persona real identificable** (presidente, ministro, candidato, figura pública), su foto real es obligatoria: se busca en Wikimedia Commons u otro banco con licencia — `buscar.py` con `foto:` la encuentra y `montaje.json` la declara como referencia (`commons:File:…`, `nasa:…` o la URL de la imagen); `hacer.py` la baja a `fuentes/material/` y anota su licencia en `FUENTES.md`. Las fotos que suba el usuario a `fuentes/material/` tienen prioridad sobre las del banco.
  - Si el usuario no sube archivos propios y el tema no es una persona, Hermit genera las ilustraciones, gráficos conceptuales y portadas con Nano Banana sin detener el turno. La IA nunca retrata a una persona real identificable: para gente de verdad, siempre foto con licencia.

## Lo que no se negocia

- **Rigurosidad en los datos:** Cifras, fechas y nombres deben estar respaldados en `fuentes/caso.md`.
- **Sin marcas de agua ni rótulos artificiales:** Las imágenes (sean fotos reales, capturas o generadas) se muestran siempre limpias, profesionales y a pantalla completa. Queda estrictamente prohibido estampar textos como «Recreación visual», «No es foto de prensa» o sellos ficticios sobre la imagen; la transparencia sobre las fuentes se expresa en el contenido del análisis y en el guion, no ensuciando el material visual.
- **Audio masterizado a −14 LUFS:** Con música incidental de tensión a bajo volumen y **ducking real** bajo la voz (el `hacer.py` lo hace solo si hay `public/musica.mp3|wav`).
- **Personas reales:** las ilustraciones con IA nunca retratan a una persona real identificable; la foto del político o la figura pública se busca con licencia en los bancos de [`MATERIAL.md`](../video-base/MATERIAL.md) y queda registrada en `FUENTES.md`. Las fotos y recortes de archivo del usuario entran con su licencia registrada.
- El proyecto va en la carpeta de la línea `Carpeta:` del mensaje (úsala tal cual, no depende de dónde estés). Sin ella, `politica-<tema>`.

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común a todos los estilos está en [`FORMATO.md`](../video-base/FORMATO.md).

- **`Formato: vertical`** (1080×1920): encuadre 9:16 con titulares superiores de alerta, documentos en el tercio central y subtítulos dinámicos en la franja baja al 25 % del alto (cuidando no tapar los botones de TikTok/Shorts). Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080, para YouTube): encuadre 16:9 con documentos a pantalla completa, gráficos de barras o comparativas lado a lado; el karaoke baja a la franja baja al 10 % del alto. La portada no va dentro del video: `portada.png` es la miniatura de YouTube (1280×720) según [`PORTADA.md`](../video-base/PORTADA.md) — se hace con `--fuente <base>/assets/fonts/ArchivoBlack-Regular.ttf --color "#ffff00"`.

## Pasos

1. **Crear el proyecto:** `python -I -B -X utf8 <skill>/scripts/nuevo.py <carpeta> [--vertical]`
   Crea la estructura con plantilla Remotion, enlaza `node_modules` compartido y copia los tokens del estilo (`public/assets/politica/`).
2. **Investigación y guion:** En `fuentes/caso.md` los hechos, cifras oficiales y citas que respaldan el análisis. En `guion.md`: estructurado en los 5 bloques exactos (0–5s, 5–20s, 20–40s, 40–55s, 55–60s) con los textos de los titulares y llamadas de atención (en negrita `**Titular:**`, que no se narran).
3. **Voz:** La voz se genera en `fuentes/voz/` (o `public/voz.wav`/`voz.wav` como rutas viejas) con `generar_voz` de AI Studio o TTS, masterizada a −14 LUFS (`masterizar.mjs` de video-base). Una voz firme y autoritaria sienta el análisis.
4. **Escenas:** En `montaje.json`: `formato` y `escenas` — cada escena con la `palabra` del guion donde entra (una a tres palabras seguidas, en orden), su `imagen` y su `titular` opcional (el banner de alerta arriba, hasta 90 caracteres):
   - `imagen`: la ruta de un archivo del proyecto (lo que subió el usuario o se generó, en `fuentes/material/`) **o una referencia de foto con licencia** que `hacer.py` baja solo y anota en `FUENTES.md`: `commons:File:Nombre.jpg`, `nasa:<id>` o la URL de la imagen. Las de Commons se buscan con `buscar.py` (`foto:`). Cada imagen entra con su paneo Ken Burns (zoom 1,0↔1,15 alternando por escena) y su fundido de entrada y salida de 0,18 s — la transición editorial del estilo—, limpia y a pantalla completa.
   - `titular`: el banner superior en Archivo Black blanco con contorno negro, centrado arriba; vive lo que dura su escena. Las cifras y fechas del titular no se colorean: el color de choque es solo de los subtítulos.
   - `palabra`/`vez` como en `momentos.json`: una a tres palabras seguidas del guion.
5. **Música:** Si el video lleva cama de tensión con licencia, va en `public/musica.mp3` (o `musica.mp3`, `public/musica.wav`): suena a bajo volumen debajo de la voz, con entrada y salida en fundido y ducking real.
6. **Montaje y render:** `python -I -B -X utf8 <skill>/scripts/hacer.py --en <carpeta del proyecto> [--formato vertical|horizontal] [--revisa]`.
   - `--revisa`: valida `montaje.json` en un segundo sin red ni voz (forma, `palabra` en orden en el guion, referencias bien formadas).
   - En la corrida completa: baja las imágenes una vez por URL, transcribe la voz (`revision/transcripcion.json`), mezcla la voz con los efectos del estilo y la música masterizada a −14 LUFS en `public/sonido.wav`, escribe `src/edicion.json` con el director —cada imagen con su paneo y fundidos, el titular, los subtítulos de impacto en capas, y el bloque `sonido` de pistas separadas (voz, música en loop con su ducking y cada efecto en su golpe, de los mismos `cues_de()` de la mezcla) para que el monitor en vivo las oiga y la línea de tiempo las muestre por carril— y renderiza con Remotion (`--muted`, cuadros pre-sacados) muxando el audio con FFmpeg hacia `out/politica-<nombre>.mp4`.
   - Sonido del estilo: `subboom_1` + `riser_1` (el golpe grave y la subida) al abrir; `swish_1` al entrar cada escena (el barrido de la transición); `click_1..3` rotando (el golpe del titular que se estampa) en cada escena con `titular`; `impact_1` en la última escena (el golpe del cierre polarizante). Secos: el peso lo pone el análisis, no los efectos.
   - Subtítulos de impacto: líneas de hasta 3 palabras en Archivo Black, cronometadas palabra a palabra con la transcripción y medidas con la fuente real (lo que no cabe en el marco pasa a otra línea, nunca se achica la letra ni se sale del cuadro); la cifra/dinero en **amarillo `#ffff00`**, la alarma en **rojo `#ff3333`**, el resto en blanco con contorno negro — las mismas reglas del formato viejo.
7. **Revisión y entrega:** Se mira `revision/hoja.png`: que el titular se lea arriba sin tapar, que las cifras salten en amarillo y la alarma en rojo, y que ninguna palabra quede cortada ni tapada por los subtítulos. Se pasa `node <base>/scripts/comprobar.mjs` al video. El proyecto entregado queda limpio: `out/` solo con el mp4, voz en `fuentes/voz/`, material con licencia en `FUENTES.md`. Los scripts de un solo uso van a `$TEMP` o se borran al usarlos, y nada de `README.md` ni notas de resumen en la raíz — todo lo que el proyecto conserva ya vive en su carpeta.
