---
name: imagenes
description: Genera solo imágenes con IA a partir de lo que se le pida (una idea, una frase, una tanda). Cada una queda en la galería «Mis imágenes» de Hermit, lista para verla o borrarla. No arma video ni escribe artículos.
---

# Imágenes

Esta skill genera **solo imágenes** con IA. Lo que se le pide (una idea, una frase, una lista de escenas) se convierte en
una o varias imágenes, y cada una queda en la galería «Mis imágenes» de Hermit. No arma video, no escribe artículos, no
necesita voz: solo imágenes.

## La línea `Imágenes:`

El usuario elige en Hermit con qué se generan (el menú «Imágenes»). Lo elegido llega en el primer mensaje y manda sobre
lo que diga esta skill:

- `Imágenes: genéralas en Google Flow con <modelo> …`: con el MCP `flow` y su `generar_imagen`. El cómo, en
  [video-base/FLOW.md](../video-base/FLOW.md).
- `Imágenes: con ChatGPT …`: con Codex y su `image_gen`, como en [video-base/PORTADA.md](../video-base/PORTADA.md).
- Sin la línea: con lo que esté conectado (Google Flow si hay cuenta de Google; si no, ChatGPT).

Las imágenes no gastan créditos, ni en Flow ni en ChatGPT. No pidas permiso de gasto por imágenes.

## La línea `Carpeta:` y el `Formato:`

- `Carpeta:`: la ruta completa de la carpeta del hilo, la raíz donde van las imágenes. Guárdalas ahí, no en subcarpetas.
- `Formato: vertical` (por defecto): imágenes **9:16**. `Formato: horizontal`: **16:9**. También `Formato: 1:1` (cuadrada), `Formato: 4:3` y `Formato: 3:4`: las cinco proporciones que `generar_imagen` compone nativas (`FORMATOS_IMAGEN` en `shared/flow.ts`). Si en el mensaje se pide otra proporción, esa manda. Nunca recortes una del otro formato.
- **Qué cambia de lugar:** en vertical, la composición se apila (sujeto al centro, aire arriba y abajo); en horizontal
  y en las apaisadas, el sujeto va a un tercio y el resto ocupa el ancho; en las verticales estrechas, se apila. Nunca
  se hace en una proporción para recortarla a otra.

## Cómo trabajas

1. **Encargo** (`encargo.md`, fase Idea). Deja en la raíz de la carpeta lo que vas a hacer: qué pide el usuario, cuántas
   imágenes serán y **el prompt en inglés de cada una**, numeradas (concreto: sujeto, estilo, luz y encuadre).
2. **Imágenes** (`<nombre>.png`, fase Entrega). Genera cada una con el motor de la línea `Imágenes:` y el `formato` que
   toque (el de la línea `Formato:`: `9:16`, `16:9`, `1:1`, `4:3` o `3:4`), y déjala en la raíz de la carpeta.
   - Con Flow: pide un `_<nombre>.jpg` con `generar_imagen` y pásalo a `<nombre>.png`
     (`ffmpeg -nostdin -v error -y -i _<nombre>.jpg <nombre>.png`). El `_` deja el intermedio fuera de la galería; el
     entregable es solo el `.png`.
   - Con ChatGPT: el pedido va en un `.txt`, en inglés, que empiece con «Use your built-in image_gen tool (do not draw
     with code). Generate one image with image_gen, then copy the PNG from $CODEX_HOME/generated_images/... into this
     working directory as <nombre>.png. Reply only with the file name.».
   - **Míralas siempre.** Si algo no salió, pide solo esa imagen otra vez, diciendo qué corregir.
   - Nombres claros, en minúsculas y sin espacios (`gato-neon.png`), nunca empezando por `_` (lo que empieza por `_` es «a
     medias»: la galería no lo enseña).
3. **Cierre** (`lista.json`, fase Entrega). Escribe `lista.json` con lo hecho
   (`{ "imagenes": [{ "archivo": "gato-neon.png", "prompt": "…" }] }`) y cierra con un resumen de las imágenes. Con él
   queda hecha la etapa «Imágenes»: no la des por terminada antes, aunque ya haya imágenes.

## Cuántas

- **Personas reales:** nunca la imagen de una persona real identificable; lo que se genera es original (personajes,
  lugares, objetos, escenas).
- Una idea → una imagen. Una idea con variantes → una por variante, cambiando el encuadre, la luz o el ángulo (no
  repitas).
- Si pide «N imágenes» o una tanda, genera esas, cada una con su archivo.
- Si no dice cuántas, una.

## Si falla

- **Sin cuenta conectada:** dile que conecte su cuenta de Google en Opciones → Voz o agregue una en Opciones → Google
  Flow; con ChatGPT, que entre en Opciones.
- **Flow pide confirmar los derechos de las imágenes:** que los confirme en Opciones → Google Flow (o en «Confirmar
  derechos», junto al menú Imágenes). Esa decisión no es tuya.
- **Otro error:** dile el error tal cual, sin repetir a ciegas.
