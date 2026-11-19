import type { Autor, CategoriaComunidad, FeedComunidad } from '../../shared/types'
import { LINK } from './etiquetas'
import { Icono as IconoBase, type NombreIcono } from './Iconos'
import './Comunidad.css'

/** Las secciones de la comunidad y lo que se invita a escribir en cada una. */
export const SECCIONES: { id: CategoriaComunidad; nombre: string; icono: NombreIcono; escribe: string }[] = [
  { id: 'general', nombre: 'General', icono: 'hilo', escribe: 'Preséntate, platica o comparte lo que quieras.' },
  { id: 'hice', nombre: 'Lo que hice', icono: 'video', escribe: 'Cuenta cómo lo hiciste: el estilo, lo que le pediste a Hermit, lo que aprendiste.' },
  { id: 'ayuda', nombre: 'Ayuda', icono: 'pregunta', escribe: '¿Qué no te sale? Cuéntalo y, si puedes, pega una captura.' },
  { id: 'mejoras', nombre: 'Mejoras', icono: 'flechaArriba', escribe: '¿Qué le falta a Hermit o qué debería hacer mejor?' },
  { id: 'anuncios', nombre: 'Anuncios', icono: 'megafono', escribe: '¿Qué hay de nuevo en Hermit?' },
]
export const seccionDe = (id: CategoriaComunidad) => SECCIONES.find((s) => s.id === id) ?? SECCIONES[0]

export type Yo = FeedComunidad['yo']

export const VISTAS = 'comunidad:vistas'

export function leerVistas(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(VISTAS) ?? '{}')
  } catch {
    return {}
  }
}

export const Icono = ({ de }: { de: NombreIcono }) => <IconoBase de={de} className="com-ico" />

/** «hace 5 min», «hace 3 h», «hace 2 d» y luego la fecha. */
export function hace(iso: string) {
  const ms = Date.parse(iso)
  const min = Math.floor((Date.now() - ms) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  if (min < 24 * 60) return `hace ${Math.floor(min / 60)} h`
  if (min < 7 * 24 * 60) return `hace ${Math.floor(min / 60 / 24)} d`
  const d = new Date(ms)
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}
export const fechaLarga = (iso: string) => new Date(iso).toLocaleString('es', { dateStyle: 'full', timeStyle: 'short' })

/** La cara de alguien: su foto, el logo de Hermit si es el creador sin foto, o su inicial. */
export function Cara({ autor, tam = '' }: { autor?: Autor; tam?: '' | 'chica' | 'grande' }) {
  if (autor?.foto) return <img className={`com-cara ${tam}`} src={autor.foto} alt="" />
  if (autor?.creador)
    return (
      <span className={`com-cara hermit ${tam}`}>
        <img src="/icon.svg" alt="" />
      </span>
    )
  return <span className={`com-cara ${tam}`}>{(autor?.nombre.trim() || '·').charAt(0).toUpperCase()}</span>
}

export function Nombre({ autor }: { autor: Autor }) {
  return (
    <span className="com-nombre">
      {autor.nombre || 'Sin nombre'}
      {autor.creador && <span className="com-creador">Creador</span>}
      {autor.insignia && <span className="com-creador">{autor.insignia === 'fundador' ? 'Fundador' : 'Apoya'}</span>}
    </span>
  )
}

/** El texto de una publicación o un comentario, con sus enlaces. */
export function Texto({ texto, className }: { texto: string; className: string }) {
  const partes = texto.split(new RegExp(`(${LINK.source})`, 'g'))
  return (
    <p className={className}>
      {partes.map((p, i) =>
        i % 2 ? (
          <a key={i} href={p} target="_blank" rel="noreferrer">
            {p}
          </a>
        ) : (
          p
        )
      )}
    </p>
  )
}
