/**
 * Lo que comparten la página Clips y su servidor sobre los cortes (`server/en-vivo.ts` y el `hacer.py` de
 * `skills/video-clips`). La paleta de acentos es la del render: los mismos nombres que valida el servidor y
 * que pinta `hacer.py` (`ACENTOS` en su código); aquí va con su muestra para los selectores de la interfaz.
 */

/** Un acento de clip: el nombre que viaja en el pedido y el color de la muestra en pantalla. */
export interface AcentoClip {
  nombre: string
  hex: string
}

/** Los acentos con nombre de `hacer.py` (`amarillo`…`rosa`); el servidor también acepta un `#RRGGBB` suelto. */
export const ACENTOS_CLIP: AcentoClip[] = [
  { nombre: 'amarillo', hex: '#ffe600' },
  { nombre: 'rojo', hex: '#ff4d4d' },
  { nombre: 'naranja', hex: '#fb923c' },
  { nombre: 'verde', hex: '#4ade80' },
  { nombre: 'cyan', hex: '#22d3ee' },
  { nombre: 'azul', hex: '#60a5fa' },
  { nombre: 'morado', hex: '#a78bfa' },
  { nombre: 'rosa', hex: '#f472b6' }
]

/** Los estilos de subtítulos karaoke de `subtitulos.py`/`hacer.py` (`centro` sigue valiendo en el motor por cortes.json viejos, pero ya no se ofrece). */
export const SUBTITULOS_CLIP = ['minimal', 'top', 'archivo', 'varela', 'crimen', 'ninguno'] as const

/** Los reencuadres de `encuadre.py`: `auto` sigue a quien habla, el resto son modos fijos. */
export const REENCUADRES_CLIP = ['auto', 'centrado', 'difuminado', 'persona'] as const
