import { useState } from 'react'
import type { Choice, Draft } from './Composer'
import type { Model, TipoPieza } from '../../shared/types'
import { LINK } from './etiquetas'

/** El inicio es siempre un hilo nuevo; sin card en el hash, toma la última que se usó. Un borrador es un inicio a medias. */
export type View =
  | { kind: 'new'; cardId?: string }
  | { kind: 'draft'; id: string }
  | { kind: 'session'; id: string }
  | { kind: 'opciones'; seccion?: string }
  | { kind: 'ideas'; canalId?: string }
  | { kind: 'clips' } // clips de videos ajenos o propios
  | { kind: 'galeria'; tipo: TipoPieza; estilo?: string }
  | { kind: 'modelos3d' } // modelos 3D
  | { kind: 'comunidad' } // comunidad

/** La ruta de cada galería en el hash. Su `tipo` es el `produce` de las cards que la llenan. */
export const RUTA_GALERIA: Record<TipoPieza, string> = { video: 'mis-videos', imagen: 'mis-imagenes', articulo: 'mis-articulos', presentacion: 'mis-presentaciones' }

/** Una opción del selector de formato: lo que se guarda, cómo se nombra y su icono (clase de `.formato-ico`). */
export type FormatoOpcion = { valor: string; nombre: string; detalle: string; ico: string }
/** Video y presentaciones: solo los dos encuadres que sus pipelines componen (`FORMATOS_VIDEO` en shared/flow.ts). */
export const FORMATOS_ENCUEADRE: FormatoOpcion[] = [
  { valor: 'vertical', nombre: 'Vertical', detalle: '9:16 · TikTok, Shorts', ico: 'vertical' },
  { valor: 'horizontal', nombre: 'Horizontal', detalle: '16:9 · YouTube', ico: 'horizontal' }
]
/** Imágenes: las cinco proporciones que `generar_imagen` compone nativas (`FORMATOS_IMAGEN` en shared/flow.ts). */
export const FORMATOS_IMAGEN: FormatoOpcion[] = [
  { valor: '9:16', nombre: 'Vertical', detalle: '9:16 · TikTok, Shorts', ico: 'vertical' },
  { valor: '16:9', nombre: 'Horizontal', detalle: '16:9 · YouTube', ico: 'horizontal' },
  { valor: '1:1', nombre: 'Cuadrada', detalle: '1:1 · feed, posts', ico: 'cuadrada' },
  { valor: '4:3', nombre: '4:3', detalle: '4:3 · foto clásica', ico: 'cuatro-tres' },
  { valor: '3:4', nombre: '3:4', detalle: '3:4 · retrato', ico: 'tres-cuartos' }
]
/** Los nombres de antes y los de la idea escrita (`Formato: vertical`, `cuadrada`) en la proporción que equivalen. */
export const formatoReal = (f: string, imagen: boolean) =>
  imagen ? (({ vertical: '9:16', horizontal: '16:9', cuadrada: '1:1' } as Record<string, string>)[f] ?? f) : f

/** Lo que se escribió en un hilo nuevo sin mandarlo. Vive en localStorage hasta que se manda o se borra. */
export type Saved = Draft & { cardId: string; at: number }

export const filled = (d?: Draft) => !!d && (!!d.text.trim() || !!d.images.length)

/** La vista sale del hash (#/s/<id>, #/d/<id>, #/new/<card>), así sobrevive a las recargas de cuando la app se edita sola. */
export function readHash(): View {
  const [, kind, id] = location.hash.split('/')
  if (kind === 's' && id) return { kind: 'session', id }
  if (kind === 'd' && id) return { kind: 'draft', id }
  if (kind === 'opciones') return { kind: 'opciones', seccion: id || undefined }
  if (kind === 'ideas') return { kind: 'ideas', canalId: id || undefined }
  if (kind === 'clips') return { kind: 'clips' }
  if (kind === 'mis-videos') return { kind: 'galeria', tipo: 'video', estilo: id || undefined }
  if (kind === 'mis-imagenes') return { kind: 'galeria', tipo: 'imagen' }
  if (kind === 'mis-articulos') return { kind: 'galeria', tipo: 'articulo' }
  if (kind === 'mis-presentaciones') return { kind: 'galeria', tipo: 'presentacion' }
  if (kind === 'modelos-3d') return { kind: 'modelos3d' } // modelos 3D
  if (kind === 'comunidad' || kind === 'mejoras') return { kind: 'comunidad' } // comunidad (antes, Mejoras)
  return { kind: 'new', cardId: kind === 'new' ? id : undefined }
}

export function go(view: View) {
  location.hash =
    view.kind === 'session'
      ? `/s/${view.id}`
      : view.kind === 'draft'
        ? `/d/${view.id}`
        : view.kind === 'opciones'
          ? `/opciones${view.seccion ? `/${view.seccion}` : ''}`
          : view.kind === 'ideas'
            ? `/ideas${view.canalId ? `/${view.canalId}` : ''}`
            : view.kind === 'clips'
              ? '/clips'
              : view.kind === 'galeria'
                ? `/${RUTA_GALERIA[view.tipo]}${view.tipo === 'video' && view.estilo ? `/${view.estilo}` : ''}`
                : view.kind === 'modelos3d' // modelos 3D
                  ? '/modelos-3d'
                  : view.kind === 'comunidad' // comunidad
                    ? '/comunidad'
                    : view.cardId
                      ? `/new/${view.cardId}`
                      : '/'
}

/** Lo escrito en un hilo sin mandar: sobrevive a cambiar de hilo y a recargar. Se borra al mandarlo o al borrar el hilo. */
export const respuesta = (id: string) => `respuesta:${id}`
export function leerRespuesta(id: string): Draft | undefined {
  try {
    return JSON.parse(localStorage.getItem(respuesta(id)) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}
export function guardarRespuesta(id: string, d: Draft) {
  if (d.text.trim() || d.images.length) localStorage.setItem(respuesta(id), JSON.stringify(d))
  else localStorage.removeItem(respuesta(id))
}
export const newId = () => Math.random().toString(36).slice(2, 10)

/**
 * Lo último que elegiste a mano: en «Avanzado» o en el compositor de un hilo. Es lo que usa «Optimizado» en una card sin
 * medir, y lo hereda la sección Ideas. Mandar no lo cambia: si no, lo optimizado de una card pisaba tu elección.
 */
export function lastChoice(models: Model[]): Choice | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem('choice') ?? 'null') as Choice | null
    // Una elección guardada antes puede decir `claude-opus-5-5[1m]`: es el mismo modelo.
    const model = saved?.model.replace('[1m]', '')
    if (saved && model && models.some((m) => m.id === model)) return { model, effort: saved.effort }
  } catch {}
  return undefined
}
export const elegidoAMano = (c: Choice) => localStorage.setItem('choice', JSON.stringify(c))

/** Un estado que sobrevive a las recargas en localStorage. */
export function useStored<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null') ?? initial
    } catch {
      return initial
    }
  })
  return [value, (next) => (localStorage.setItem(key, JSON.stringify(next)), setValue(next))]
}

/** Los enlaces de un texto, sin repetir, en su orden. */
export const enlacesDe = (text: string) => [...new Set(text.match(new RegExp(LINK, 'g')) ?? [])]

export function hace(t: number) {
  const min = (Date.now() - t) / 60000
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${Math.round(min)} min`
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`
  const dias = Math.round(min / 60 / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} días`
}

/** `Hoy`, `Ayer`, `Esta semana` o `Antes`: la sección de la barra lateral donde cae un hilo. */
export function cuando(t: number) {
  const hoy = new Date().setHours(0, 0, 0, 0)
  const dia = 86400000
  return t >= hoy ? 'Hoy' : t >= hoy - dia ? 'Ayer' : t >= hoy - 6 * dia ? 'Esta semana' : 'Antes'
}

/** Para buscar sin que importen mayúsculas ni tildes. */
export const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
