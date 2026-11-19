---
name: animalnovela
description: Hace una animalnovela (telenovela cómica donde conviven personas y animales 3D estilo Pixar con cabeza de su especie y cuerpo humano, como gatos aristócratas, leones consentidos o gallinas chismosas), vertical (TikTok, Reels, Shorts) u horizontal (YouTube). Los personajes hablan entre ellos con sincronización labial nativa y viven un drama familiar absurdo en cada escena, sin narrador externo, todo generado en Google Flow con Veo 3.1. Úsala cuando pidan una telenovela de animales, comedia de mascotas que hablan o un sketch con animales y personas.
---

# Animalnovela

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`NOVELA.md`](../video-base/NOVELA.md)
(el proceso completo de las novelas de clips), su [`LEEME.md`](../video-base/LEEME.md) (los errores ya vistos) y su
[`FLOW.md`](../video-base/FLOW.md) antes de empezar.

## La esencia

Un formato cómico de ficción donde conviven humanos y animales 3D con **cabeza de su especie y cuerpo humano**,
estilo Pixar y con personalidades muy marcadas.

- **Personajes que se reconocen.** Cada animal tiene cabeza de su especie y cuerpo humano: torso, dos brazos, dos
  manos, dos piernas y dos pies, de pie y con su ropa de siempre. La cabeza lleva el morro o el pico, las orejas, los
  ojos y el color de su especie, con cejas y boca integradas. Los humanos del elenco van con su cuerpo y su cara.
  Salen idénticos en todos los clips, porque cada clip parte de un cuadro armado con sus hojas de personaje. Si un
  personaje cambia de cabeza, de cara o de ropa entre clips, el video se cae.
- **Drama de telenovela, dicho serio.** Discusiones cotidianas llevadas al extremo (la comida robada, el alquiler sin
  pagar, las plumas en el sofá, celos y romances secretos). Los personajes lo viven en serio. La gracia es que son
  animales y que su especie pesa en la historia: el gato que se lame, la gallina que cacarea, el león que ruge.

El resto de la esencia —hablan ellos sin narrador, cámara casi quieta, gancho y cliffhanger— está en
[`NOVELA.md`](../video-base/NOVELA.md).

## Lo que no se negocia

- **Cabeza de animal, cuerpo humano.** La cabeza es la de su especie, dibujada en 3D de película, con su silueta, sus
  orejas, su morro o pico y sus ojos. El cuerpo es humano: torso, dos brazos, dos manos, dos piernas y dos pies, de
  pie y de frente. No es un animal realista, no va a cuatro patas, no lleva cuerpo de animal, y no es un humano con
  orejas pegadas. Si un animal sale así, se vuelve a pedir solo su hoja.
- Lo común (créditos, texto en pantalla, carpeta del proyecto, nada de otro canal) está en
  [`NOVELA.md`](../video-base/NOVELA.md).

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común está en
[`FORMATO.md`](../video-base/FORMATO.md) y el encuadre de las novelas en [`NOVELA.md`](../video-base/NOVELA.md).

- **`Formato: vertical`** (1080×1920): cuadros y clips en `9:16`. Los personajes se ven de cuerpo entero o de la
  rodilla para arriba, uno al lado del otro y al centro. Abajo queda aire para los subtítulos y la interfaz de
  TikTok y Reels. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080): cuadros y clips en `16:9`. Los personajes van a los tercios, frente a
  frente, con el lugar a lo ancho. Así entran tres personajes sin achicarse.

Todo cuadro va en el formato del video: un cuadro vertical animado en horizontal sale recortado.

## El elenco

Los personajes viven en `personajes/`, en la carpeta donde arrancas (la de todas las animalnovelas). El renglón de
`ELENCO.md` lleva nombre, especie, **cómo es su cabeza** (forma, color, orejas, morro o pico, ojos), su cuerpo y su
ropa (los humanos, su cara), su voz y en qué capítulos sale (lo común está en [`NOVELA.md`](../video-base/NOVELA.md)).
Antes de inventar a uno, mira si ya está y conserva su diseño. Si el capítulo lleva un humano, su hoja se pide igual:
persona 3D de cuerpo entero, de frente, con su ropa y su cara, sin nada de animal.

## Pasos

Los ocho pasos son los de [`NOVELA.md`](../video-base/NOVELA.md). Lo propio de este estilo:

- **Cuento de escenas:** de 8 a 12 (de 64 a 96 s).
- **La hoja del personaje** (paso 3), en inglés — rellena la plantilla con el diseño anotado en `ELENCO.md`:

  ```text
  Create one high-quality stylized 3D animated humanoid character representing <ANIMAL>. The head is the
  recognizable head of a <ANIMAL, WITH ITS SHAPE, COLOR, EARS, SNOUT OR BEAK AND EYES>, rendered as a dimensional
  cartoon character head: integrate large expressive cartoon eyes, eyebrows, and a mouth into it without losing
  its silhouette. Fully human body with two arms, two hands, two legs, and two feet; natural proportions and
  expressive body language. Wearing <ROPA, SEGÚN EL PERSONAJE>. <PERSONALIDAD>. Full body, standing upright,
  facing the camera, neutral pose, centered on a clean light gray background. Premium polished 3D animated
  feature-film style, consistent visual universe for the AnimalNovelas series. No realistic animal, no animal on
  four legs, no animal-shaped body, no human head or human face, no extra text, no watermark.
  ```

  Si la cabeza no es la de su especie, salió animal realista, a cuatro patas o con cuerpo de animal, o cambió la
  ropa, vuelve a pedir solo esa hoja y nombra el error concreto.
- **El cierre del clip** (paso 6), en inglés: `static camera, no music, no subtitles, no added text on screen,
  no realistic animals`.
- **La portada** (paso 8): el personaje del conflicto, grande y con la cara del momento más fuerte, y de 2 a 5
  palabras del drama. Van tres cuadros del video de referencia, para que sea el mismo elenco.
