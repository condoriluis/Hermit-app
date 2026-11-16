# Las fotos reales de escena

Se lee al poner tarjetas `imagen` en `momentos.json` (SKILL.md). La foto es la prueba: el producto, el anuncio, la
página, la persona, el lugar; de dos a tres por video.

## De dónde salen

De las páginas que ya leíste (la de una noticia o una tienda trae su foto):

```
python -B -X utf8 <skill>/scripts/imagenes.py <nombre>=<url de la página o de la imagen>…
```

Todas en una llamada, ~3 s; las deja en `public/img/<nombre>.jpg`. Una `Imagen adjunta:` del mensaje también puede
salir en escena: cópiala a `public/img/` (la ruta que trae es la del adjunto; `--adjunta` ya la aparta para la
portada) y úsala como esta `imagen`, con su `pie` y `fuente`. Si una no sale, va un ícono: no se inventan.

## Qué foto y cuándo

La foto enseña la cosa (el estómago, el pájaro, el habanero), nunca el logo de quien lo dice: eso va en `fuente`;
el logo de Scientific American en «nada apaga el eco» no enseñó nada. **Entra cuando el protagonista ya se vio**:
nunca en los dos primeros momentos ni antes de unos 5 s (15 palabras), y se queda 2 s o más (6 palabras); mientras se
ve, el director para y quita lo de detrás. En el del corazón entró a los 3 s y «al modelo 3D ya no se le permitió ver
nada».
