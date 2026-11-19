---
name: frutinovela
description: Hace una frutinovela, vertical (TikTok, Reels, Shorts) u horizontal (YouTube). Es una telenovela de un minuto o dos con frutas de cuerpo humano en 3D tipo Pixar, que hablan con sus propias voces, todo generado en Google Flow con las cuentas del usuario. Los mismos personajes en todos los clips, una historia de traición, familia o castigo que se tuerce, y un final que pide la siguiente parte. Úsala cuando pidan una frutinovela, una novela de frutas, otro capítulo o la parte 2 de una que ya se hizo.
---

# Frutinovela

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`NOVELA.md`](../video-base/NOVELA.md)
(el proceso completo de las novelas de clips), su [`LEEME.md`](../video-base/LEEME.md) (los errores ya vistos) y su
[`FLOW.md`](../video-base/FLOW.md) antes de empezar. Lo que se midió en los ejemplos está en
[`ejemplos/referencia.md`](ejemplos/referencia.md).

## La esencia

- **Personajes que se reconocen.** Cada uno es una fruta con cuerpo de persona, cara expresiva y su ropa de siempre.
  Salen idénticos en todos los clips, porque cada clip parte de un cuadro armado con sus hojas de personaje. Si un
  personaje cambia de cara o de ropa entre clips, el video se cae.
- **Drama de telenovela, dicho serio.** Infidelidad, hijos adoptados, la suegra, el dinero, el secreto, la traición,
  el castigo y el premio al bueno. Los personajes lo viven en serio. La gracia es que son frutas y que su fruta pesa
  en la historia: la piña con espinas, el plátano que se pela, la fresa que se mancha.

El resto de la esencia —hablan ellos sin narrador, cámara casi quieta, gancho y cliffhanger— está en
[`NOVELA.md`](../video-base/NOVELA.md).

## Lo que no se negocia

- **Ningún personaje ni historia de otro canal.** El personaje con nombre de una marca o de una persona real no va.
- Lo común (créditos, texto en pantalla, carpeta del proyecto) está en [`NOVELA.md`](../video-base/NOVELA.md).

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común está en
[`FORMATO.md`](../video-base/FORMATO.md) y el encuadre de las novelas en [`NOVELA.md`](../video-base/NOVELA.md).

- **`Formato: vertical`** (1080×1920): cuadros y clips en `9:16`. Los personajes se ven de cuerpo entero o de la
  rodilla para arriba, uno al lado del otro y al centro. Abajo queda aire para los subtítulos y la interfaz de
  TikTok. Lleva la portada de primer fotograma.
- **`Formato: horizontal`** (1920×1080): cuadros y clips en `16:9`. Los personajes van a los tercios, frente a
  frente, con el lugar a lo ancho. Así entran tres personajes sin achicarse.

Todo cuadro va en el formato del video: un cuadro vertical animado en horizontal sale recortado.

## El elenco

Los personajes viven en `personajes/`, en la carpeta donde arrancas (la de todas las frutinovelas). El renglón de
`ELENCO.md` lleva nombre, fruta, cómo se ve y qué ropa lleva, su voz y en qué capítulos sale (lo común está en
[`NOVELA.md`](../video-base/NOVELA.md)). Antes de inventar a uno, mira si ya está.

## Pasos

Los ocho pasos son los de [`NOVELA.md`](../video-base/NOVELA.md). Lo propio de este estilo:

- **Cuento de escenas:** de 8 a 14 (de 64 a 112 s).
- **La hoja del personaje** (paso 3), en inglés:

  ```text
  3D animated character, Pixar style, a <fruit> with a human body, <rasgos>, wearing <ropa>, full body,
  front view, standing, neutral expression, plain light background, no text
  ```

- **El cierre del clip** (paso 6), en inglés: `static camera, no music, no subtitles, no text on screen`.
- **La portada** (paso 8): el personaje del conflicto, grande y con su cara del momento más fuerte, y de 2 a 5
  palabras del drama («¡ME ENGAÑÓ!», «LA ADOPTARON»). Van tres cuadros del video de referencia, para que sea el
  mismo elenco.
