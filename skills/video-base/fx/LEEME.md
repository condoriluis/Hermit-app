# fx — el kit de transiciones y efectos

Componentes de Remotion para que cualquier estilo de video tenga cortes y efectos de nivel
profesional sin reinventarlos. Solo dependen de `react` y `remotion` (nada de GSAP ni de la
plantilla): sirven en todos los estilos, propios o migrados.

```
python -B -X utf8 <video-base>/fx/scripts/fx.py traer     # en la carpeta del proyecto
```

Copia `src/` a `src/fx/` del proyecto e imprime el import. Después, en la plantilla:

```tsx
import { Empuje, GlitchCorte, Shake, Viñeta } from "./fx";   // desde src/
// o "../fx" desde src/escenas/
```

Todo es función pura del cuadro (`useCurrentFrame`, `interpolate`): el mismo frame da el
mismo pixel en cada render. Nada de `Date.now()`, `Math.random()` ni CSS animado.

## Las dos familias (no las confundas)

**Transiciones de escena** (`transiciones/`) envuelven el contenido de UNA escena y la
animan al entrar y al salir. La plantilla las monta con solape: cada escena va en su
`<Sequence>` empezando `dur` cuadros antes de su frontera (como `Montaje.tsx` de
video-propio). Reciben `desde` y `hasta` = los cuadros **absolutos** del montaje de la
escena (el `from` de su Sequence y su fin), y `dur` en cuadros (10–14 a 30 fps).

```tsx
<Sequence from={L} durationInFrames={R - L}>
  <Empuje desde={L} hasta={R} dur={12} dir="izquierda">
    <Escena />
  </Empuje>
</Sequence>
```

| Componente | Qué hace | Props extra |
|---|---|---|
| `Empuje` | Desliza y empuja, como los expedidores | `dir`: izquierda/derecha/arriba/abajo |
| `Fundido` | Opacidad suave; `color` funde a un tono | `color` |
| `Zoom` | Crece al entrar y se aleja al salir («atraviesa») | `escala` |
| `Cortina` | Barrido revelado con clip-path | `dir` |
| `Iris` | Ojo de buey circular desde `cx`/`cy` % | `cx`, `cy` |
| `Giro` | Card flip con perspectiva | `grados` |

**Overlays de corte** (`cortes/`) se montan en una `<Sequence>` ENCIMA de las escenas,
centrada en el cuadro del corte (unos 4 cuadros antes, `dur` de duración). No tocan las
escenas: el corte sigue siendo corte, el efecto lo enmascara con diseño.

```tsx
<Sequence from={corte - 4} durationInFrames={10}>
  <GlitchCorte />
</Sequence>
```

| Componente | Qué hace | Props extra |
|---|---|---|
| `FlashCorte` | Destello de color que se apaga | `color`, `pico`, `dur` |
| `GlitchCorte` | RGB split + franjas que saltan + escaneo | `intensidad`, `dur` |
| `ZoomCorte` | Estelas radiales que explotan del centro | `color`, `intensidad`, `dur` |
| `BarridoCorte` | Banda de luz diagonal (la del whoosh) | `color`, `dur` |

**Efectos** (`efectos/`): `Shake` y `ZoomPunch` son wrappers de escena (mismo `desde`/
`hasta` que las transiciones, más `en` = cuadro absoluto del golpe e `intensidad`/`pico`);
el resto son overlays fijos que se montan una vez sobre todo el video o en una Sequence
de tramo.

| Componente | Tipo | Qué hace | Props |
|---|---|---|---|
| `Shake` | wrapper | Temblor de cámara que decae | `en`, `dur`, `intensidad` (px) |
| `ZoomPunch` | wrapper | Acercamiento elástico en el golpe | `en`, `pico`, `dur` |
| `Viñeta` | overlay | Oscurece bordes; `respira` la hace latir | `intensidad`, `respira` |
| `Grano` | overlay | Grano de película animado (salta cada 3 cuadros) | `intensidad`, `tamano` |
| `LightLeak` | overlay | Fugas de luz cálidas derivando (ciclo `dur` cuadros) | `intensidad`, `dur` |
| `Letterbox` | overlay en Sequence | Barras de cine que entran y se quedan | `dur`, `alto`, `color` |

## Reglas de uso

- **El acento manda**: `color`/`dir`/`intensidad` se pasan desde el `acento` y el ánimo del
  plan — un recap familiar no lleva `GlitchCorte` por defecto; los cortes de corte-loco son
  para tops, crímenes y ediciones rápidas.
- **No todo a la vez**: una transición de escena O un overlay de corte por frontera, no
  los dos — se apilan y ensucian. El shake y el punch son para golpes concretos, no por escena.
- **`dur` en cuadros** del video (30 fps en todos los estilos): 8–12 para cortes, 10–14
  para transiciones de escena.
- La demo que lo prueba todo está en `prueba/` (`Demo.tsx`): 6 escenas, 6 transiciones,
  4 overlays y todos los efectos en 12 s — se renderiza con `remotion render src/index.ts Demo`.
