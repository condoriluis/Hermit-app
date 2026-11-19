---
name: minidrama
description: Hace un minidrama o k-drama episódico (series dramáticas de 1 minuto estilo dorama coreano o novela vertical de alta retención: romances de oficina, CEOs encubiertos, venganzas familiares, matrimonios por contrato), vertical (TikTok, Reels, Shorts) u horizontal (YouTube). Generado en Google Flow con Veo 3.1: los personajes hablan directamente entre ellos con sincronización labial nativa, miradas de tensión dramática y cliffhanger al final para continuar en el siguiente capítulo. Úsala cuando pidan un minidrama, dorama, serie por episodios, drama coreano o novela vertical.
---

# Minidrama

`<skill>` es esta carpeta y `<base>` es `video-base`, junto a ella. Lee su [`NOVELA.md`](../video-base/NOVELA.md)
(el proceso común de las novelas de clips: créditos, elenco, voces TTS, el pipeline de imágenes y clips y el
montaje), su [`LEEME.md`](../video-base/LEEME.md) (los errores ya vistos), [`FORMATO.md`](../video-base/FORMATO.md),
[`FLOW.md`](../video-base/FLOW.md) y [`PORTADA.md`](../video-base/PORTADA.md) antes de empezar.

## La esencia

Un formato episódico de ficción dramática inspirado en los k-dramas coreanos y las series cortas de alta retención
(ReelShort, DramaBox):

- **Personajes y elenco consistentes:** Cada personaje (el CEO frío, la protagonista decidida, la antagonista
  elegante, el amigo leal) tiene su hoja de personaje fija en `personajes/<nombre>.jpg`. Conservan la misma ropa,
  peinado y rostro en todos los clips y episodios para dar continuidad perfecta de serie.
- **Diálogos hablados con sincronización labial nativa:** No hay voz en off ni narrador externo. Cada clip de 8 s
  es un diálogo directo cara a cara generado por Veo 3.1 en Google Flow, con movimiento de boca sincronizado en
  español y entonación dramática de doblaje.
- **Fórmula de alta retención (60 a 90 segundos):**
  - **Segundos 0–3 (Gancho en frío):** Entra directo al conflicto o revelación (un contrato roto, una bofetada, una
    mirada de desprecio, la frase: *"Sé tu secreto"*).
  - **Segundos 4–45 (Confrontación y Tensión):** Cruce de palabras, planos y contraplanos con miradas intensas y
    silencios dramáticos.
  - **Segundos 46–55 (Giro de tuerca):** Un documento revelador, la llegada inesperada de alguien o un cambio
    radical de poder.
  - **Segundos 56–60 (Cliffhanger / Remate):** Primer plano de tensión máxima, golpe musical dramático y gancho
    directo: *"¿Aceptará el trato? Deja tu like para la PARTE 2"*.

A diferencia de las otras novelas, aquí los personajes son **personas fotorrealistas** (estilo K-drama), no cuerpos
3D de frutas, animales o logos: el mundo es el de [`NOVELA.md`](../video-base/NOVELA.md) con `generar_imagen` en
estilo cinematográfico realista.

## Lo que no se negocia

- **Personas reales:** los personajes son originales del guion; nunca la imagen de una persona real identificable.
- **Sin narrador ni texto en el render crudo:** Veo genera la voz de los personajes limpia. Los subtítulos dinámicos
  de alto impacto los coloca después `unir.py`.
- Lo común (créditos de Flow, autorización, carpeta del proyecto, voces TTS) está en
  [`NOVELA.md`](../video-base/NOVELA.md).

## Formato

El mensaje trae `Formato: vertical` o `Formato: horizontal`; sin la línea, vertical. Lo común está en
[`FORMATO.md`](../video-base/FORMATO.md) y el encuadre de las novelas en [`NOVELA.md`](../video-base/NOVELA.md).

- **`Formato: vertical`** (1080×1920): encuadre 9:16 cinematográfico para TikTok, Reels y Shorts con los personajes
  en plano medio o primer plano, dejando margen inferior para los subtítulos dinámicos. Portada de primer fotograma
  tipo póster de drama.
- **`Formato: horizontal`** (1920×1080): encuadre 16:9 panorámico donde se aprecian los escenarios elegantes
  (oficinas corporativas, áticos modernos, restaurantes de lujo). La portada no va dentro del video: `portada.png`
  es la miniatura de YouTube.

## Elenco

Los personajes viven en `personajes/`, con `personajes/<nombre>.jpg` (retrato cinematográfico con vestimenta
definida, generado con Nano Banana) y `personajes/ELENCO.md`: nombre, rol (CEO, heredera, rival), estilo visual,
personalidad y su voz (la ficha literal en inglés de [`FLOW.md`](../video-base/FLOW.md), «La voz de cada
personaje»). Lo común del elenco está en [`NOVELA.md`](../video-base/NOVELA.md).

## Pasos

El orden de este estilo se adelanta: **elenco y guion van antes que los cuadros**, y no hay paso de lugares aparte
(el escenario va dentro del cuadro de cada escena). El resto —créditos y autorización, cómo se piden las imágenes,
los clips con `dialogos/esc-NN.txt`, el protocolo de rechazo de Flow, el montaje con `unir.py --estilo minidrama` y
la revisión— es el de [`NOVELA.md`](../video-base/NOVELA.md), pasos 1 a 8.

1. **Elenco y Biblia de la Serie.** Define a los protagonistas en `personajes/ELENCO.md` y genera sus retratos en
   `personajes/<nombre>.jpg` usando `generar_imagen` en estilo cinematográfico realista de K-drama. *Si es la
   continuación de un capítulo anterior, reutiliza los mismos personajes.*
2. **Guion del Capítulo.** En `guion.md`: tabla con escena, plano de cámara, personajes a cuadro, emoción/acción y
   el diálogo exacto en español entre comillas — frases cortas y sin puntos suspensivos: el audio de Veo falla con
   pausas largas.
3. **Cuadros.** Primer fotograma de cada escena (`cuadros/esc-<NN>.jpg`) combinando los personajes y el escenario
   con `generar_imagen`, pasando las referencias de los personajes.
4. **Clips.** `generar_video` con Veo 3.1 - Lite, el cuadro inicial y el diálogo, como en el paso 6 de
   [`NOVELA.md`](../video-base/NOVELA.md).
5. **Montaje.** `python <base>/scripts/unir.py <nombre> --estilo minidrama --formato <formato>`: corta silencios
   muertos, compara lo que se oyó con `dialogos/esc-NN.txt` (no deja pasar una escena que dijo otra cosa: la lista
   está en `revision/sospechosas.txt`; se regenera ese clip y se vuelve a unir, o `--forzar` si está bien de
   verdad), une las tomas a 30 fps, masteriza el audio a −14 LUFS, genera subtítulos dinámicos palabra por palabra y
   exporta `out/minidrama-<nombre>.mp4`.
6. **Portada.** Generada según [`PORTADA.md`](../video-base/PORTADA.md) con el momento de mayor tensión o mirada
   dramática entre los protagonistas y título de impacto. En vertical va de primer fotograma con `portada.mjs`.

## Siguiente capítulo (Parte 2, 3...)

Para hacer el siguiente episodio en el mismo proyecto:

1. No regeneres los personajes: conserva `personajes/`.
2. Escribe el nuevo guion continuando directamente el cliffhanger previo.
3. Genera los nuevos clips y une con `unir.py <nombre>-cap2 --estilo minidrama`.
