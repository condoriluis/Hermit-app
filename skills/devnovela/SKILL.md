---
name: devnovela
description: Crea devnovelas verticales u horizontales con lenguajes y herramientas como personajes 3D humanos cuya cabeza es su logo o símbolo reconocible. Úsala para episodios nuevos o continuaciones de una devnovela.
---

# Devnovela

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`NOVELA.md`](../video-base/NOVELA.md)
(el proceso completo de las novelas de clips), su [`LEEME.md`](../video-base/LEEME.md) (los errores ya vistos) y su
[`FLOW.md`](../video-base/FLOW.md) antes de empezar.

## La esencia

- **Personajes que se reconocen.** Cada lenguaje o herramienta es un personaje con cuerpo humano y una cabeza 3D
  formada por su logo oficial reconocible o por su símbolo icónico. El logo es la cabeza misma, no una insignia
  flotante, una máscara genérica ni un objeto vagamente relacionado. Lleva ojos, cejas y boca integrados sin perder
  la silueta que lo identifica, y ropa urbana inspirada en sus colores. No inventes una papelera, un bote, una caja
  o un cilindro cuando el usuario espera el logo. Salen idénticos en todos los clips, porque cada clip parte de un
  cuadro armado con sus hojas de personaje. Si un personaje cambia de cara, cabeza, cuerpo o ropa entre clips, el
  video se cae.
- **Drama de telenovela, dicho serio.** Deploy del viernes, herencia del código legacy, merge conflict, bug en
  producción, auditoría, despido, traición entre frontend y backend. Los personajes lo viven en serio. La gracia es
  que el lenguaje o la herramienta es el personaje: su símbolo reconocible forma parte de su cara y su identidad, no
  se sustituye por un objeto genérico.

El resto de la esencia —hablan ellos sin narrador, cámara casi quieta, gancho y cliffhanger— está en
[`NOVELA.md`](../video-base/NOVELA.md).

## Lo que no se negocia

- **Logo como cabeza.** Usa la forma y los colores principales del logo o símbolo reconocible del lenguaje o
  herramienta. La cabeza completa adopta esa silueta y tiene ojos, cejas y boca integrados. No la conviertas en una
  cabeza humana, una mascota, un robot ni un recipiente genérico. Si el símbolo oficial representa un animal, úsalo
  como emblema gráfico 3D, no como un animal realista. No inventes una marca cuando no puedas confirmar cuál es:
  pregunta o usa una referencia que proporcione el usuario. No añadas logos sueltos a la escena ni copies historias
  de otro canal.
- **Personas reales:** los personajes son los logos y símbolos del elenco; nunca la imagen de una persona real
  identificable.
- **Sin texto añadido.** No generes letreros, subtítulos ni marcas de agua. Las letras que formen parte inseparable
  del icono oficial pueden permanecer en la cabeza; no añadas nombres o palabras a la ropa ni al fondo. Los
  subtítulos los pone `unir.py`.
- Lo común (créditos, carpeta del proyecto) está en [`NOVELA.md`](../video-base/NOVELA.md).

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

Los personajes viven en `personajes/`, en la carpeta donde arrancas (la de todas las devnovelas). El renglón de
`ELENCO.md` lleva nombre, qué lenguaje o herramienta representa, **cuál es el logo o símbolo exacto de su cabeza**,
su silueta y colores, cómo son sus rasgos, qué ropa lleva, su voz y en qué capítulos sale (lo común está en
[`NOVELA.md`](../video-base/NOVELA.md)). Antes de inventar a uno, mira si ya está y conserva su diseño.

Un elenco de cuatro a seis funciona mejor que uno de doce. Cada uno necesita una silueta distinta y una personalidad
que se entienda en un solo plano. No hay una lista cerrada de lenguajes compatibles: representa los que pida el
usuario, incluidos lenguajes nuevos o poco conocidos, sin intentar enumerarlos todos ni reemplazar sus marcas por
objetos inventados. Si no conoces su símbolo oficial, compruébalo en una fuente fiable; si no puedes identificarlo
con certeza, pide una referencia antes de generar.

## Pasos

Los ocho pasos son los de [`NOVELA.md`](../video-base/NOVELA.md). Lo propio de este estilo:

- **Cuento de escenas:** de 8 a 12 (de 64 a 96 s).
- **El guion** (paso 2): el drama tiene que entenderse sin saber programar: el lenguaje es el disfraz, no el chiste.
- **La hoja del personaje** (paso 3), en inglés — describe la silueta y los colores del símbolo en el prompt; no
  basta con escribir el nombre del lenguaje o «su logo». Si el logo no es reconocible para el modelo, usa una imagen
  de referencia verificada en `referencias`. Rellena esta plantilla con el diseño anotado en `ELENCO.md`:

  ```text
  Create one high-quality stylized 3D animated humanoid character representing <LANGUAGE OR TOOL>. The entire head
  itself is the recognizable official <LOGO OR ICON, DESCRIBED BY ITS DISTINCTIVE SHAPE AND COLORS>, rendered as a
  dimensional sculptural head. Preserve its distinctive silhouette and main colors; do not reinterpret it as a
  trash can, bin, box, cylinder, helmet, human head, or unrelated object. Integrate large expressive cartoon eyes,
  eyebrows, and a mouth into the logo surface without obscuring its identity. Fully human body with two arms, two
  hands, two legs, and two feet; natural proportions and expressive body language. Modern streetwear inspired by
  <BRAND COLORS>, no extra logos or words on clothing. <PERSONALITY>. Full body, standing upright, facing the
  camera, neutral pose, centered on a clean light gray background. Premium polished 3D animated feature-film style,
  consistent visual universe for the DevNovelas series. No floating logo, no extra text, no watermark, no
  realistic animal head, no robot body.
  ```

  Si la cabeza no conserva el símbolo reconocible, parece un objeto genérico, o Flow la interpreta como animal
  real, papelera o recipiente, vuelve a pedir solo esa hoja: nombra el error concreto y exige la silueta del logo.
- **El cierre del clip** (paso 6), en inglés: `static camera, no music, no subtitles, no added text on screen,
  no extra logos, no realistic animals`.
- **La portada** (paso 8): un título gancho de 2 a 5 palabras que resuma el conflicto o giro más fuerte del
  episodio («¡SE CAYÓ PRODUCCIÓN!», «BORRARON MAIN», «EL DEPLOY ARDIÓ»), no el nombre de la serie. Debe reconocerse
  como Devnovela y mantener el mundo 3D: el protagonista del conflicto, grande y con expresión intensa, conservando
  su cabeza-logo y su ropa; título en mayúsculas de 2 a 3 líneas, colores vivos ligados al logo del protagonista
  (uno dominante brillante y como máximo un acento fuerte, nunca arcoíris), sin tapar la cara. Genera la portada
  con tres cuadros del propio video como referencias y mira que el título se lea exacto en la miniatura.
