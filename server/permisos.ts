import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { VENTA } from '../shared/venta.ts'

/**
 * Quién puede qué en esta copia de Hermit. En desarrollo (`!VENTA`) todo está abierto; en la app que se vende,
 * lo del creador pide su llave de publicar, que no viaja en el instalador: vive solo en su computadora
 * (`%APPDATA%\hermit\licencias\publicar.txt`, la de `npm run publicar`, o `PUBLICAR`), así que ningún cliente
 * puede abrirlo ni aunque lo intente. El candado real está en el servidor (los endpoints responden 403);
 * la interfaz solo esconde lo que no se puede usar.
 *
 * Para restringir algo más (una card `soloCreador`, otra sección), se añade su capacidad a `PRIVILEGIOS`.
 */

/** La llave de publicar del creador, si esta computadora la tiene. */
export function llaveDePublicar(): string | undefined {
  try {
    const llave = (process.env.PUBLICAR || readFileSync(join(process.env.APPDATA ?? '', 'hermit', 'licencias', 'publicar.txt'), 'utf8')).trim()
    return llave || undefined
  } catch {
    return undefined
  }
}

/** Esta copia es la del creador: tiene su llave de publicar. */
export function esCreador(): boolean {
  return !!llaveDePublicar()
}

/** Las capacidades que solo tiene la copia del creador en la app que se vende. */
const PRIVILEGIOS = {
  /** La sección Ideas: sus endpoints, sus herramientas del agente y su página. */
  ideas: esCreador,
  /** La página Clips (pegar URL y el live de `/api/en-vivo`): solo la copia del creador. */
  clips: esCreador,
  /** Los artículos: la card `articulo-blog`, «Mis artículos» y su configuración en Opciones. */
  articulos: esCreador,
  /** Las cards `soloCreador`: solo las ve y las usa el creador. */
  privadas: esCreador
} as const

export type Privilegio = keyof typeof PRIVILEGIOS

/** Si esta copia puede usar la capacidad. En desarrollo, todas. */
export function permite(p: Privilegio): boolean {
  return !VENTA || PRIVILEGIOS[p]()
}
