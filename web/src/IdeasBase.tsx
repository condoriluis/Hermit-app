import { markdown } from './markdown'
import { useMemo } from 'react'
import { TU_CANAL, TU_INSTAGRAM, urlVertical } from '../../shared/ideas'
import type { CanalYT, Idea, VideoYT } from '../../shared/types'
import { Logo } from './Logos'

/** `878 mil`, `8.1 mil`, `3.5 M`: como se dice. */
export const mil = (n?: number) =>
  n === undefined
    ? '—'
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} M`
      : n >= 1000
        ? `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')} mil`
        : String(Math.round(n))
const relativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
/** `'2026-09-14'` → `sept 2026`. */
export const mes = (f?: string) => (f ? `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}` : 'sin fecha')
/** La fecha de un video, o por qué no la hay: no es lo mismo no haberla leído que un video que ya no está. */
export const fechaDe = (v: VideoYT) => (v.fecha ? mes(v.fecha) : v.leido ? 'ya no está' : 'sin leer')
export const meses = (f?: string) => (f ? (Date.now() - new Date(f).getTime()) / (30.4 * 864e5) : undefined)
export const hace = (t: number) => {
  const min = (Date.now() - t) / 60000
  return min < 60 ? relativo.format(-Math.round(min), 'minute') : min < 1440 ? relativo.format(-Math.round(min / 60), 'hour') : relativo.format(-Math.round(min / 1440), 'day')
}
/** Un video largo dura minutos; uno vertical, segundos. */
export const dura = (v: VideoYT) => (!v.segundos ? '' : v.red ? `${Math.round(v.segundos)} s` : `${Math.round(v.segundos / 60)} min`)
export const miniatura = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
export const enYoutube = (id: string) => `https://www.youtube.com/watch?v=${id}`
/** Dónde se ve un video: en YouTube, o en su página de TikTok o Instagram. */
export const enlace = (v: VideoYT) => (v.red ? urlVertical(v) : enYoutube(v.id))
/** Algo por cada mil vistas, con los decimales que hacen falta para leerlo. */
export const xMil = (n?: number) => (n === undefined ? '—' : n.toFixed(n < 1 ? 2 : 1))
/** Dónde publicar una idea vertical, dicho. Sin `red`, en las dos. */
export const redesDe = (r?: Idea['red']) => (r === 'tiktok' ? 'TikTok' : r === 'instagram' ? 'Instagram' : 'TikTok e Instagram')
/** Un Reel de la búsqueda de Instagram cuya cuenta no se midió: sin vistas, que no es lo mismo que cero. */
export const sinVistas = (v: VideoYT) => !!v.red && !v.vistas
/** Un canal o una cuenta del usuario: en YouTube lo marca `propio`; en vertical, también su origen. */
export const tuyo = (x: CanalYT) => !!x.propio || (!!x.red && (x.de === TU_CANAL || x.de === TU_INSTAGRAM))
/** En español, o sin saberse (solo hashtags, poco texto): lo que no lleva marca de idioma. */
export const enEspanol = (idioma?: string) => !idioma || idioma === 'es'
/** Por qué se marca una búsqueda en inglés. */
export const BUSQUEDA_EN = 'Se busca pidiendo inglés. TikTok mezcla los resultados por tu país: de ella se toman solo los videos y las cuentas en inglés'

/**
 * El idioma de un video, una cuenta o una búsqueda vertical que no es en español: «EN». El español es la demanda de quien
 * compra; el inglés, empaque y modas que suelen llegar antes, para traerlas.
 */
export function Idioma({ de, title }: { de?: string; title?: string }) {
  if (enEspanol(de)) return null
  return (
    <span className="idea-marca" title={title ?? (de === 'en' ? 'En inglés: empaque y modas que suelen llegar antes al español, para traerlas. La demanda de quien compra es la de español' : undefined)}>
      {de!.toUpperCase()}
    </span>
  )
}

/** La portada 9:16 de un video de TikTok o Instagram, la que guardó la investigación. Si no se bajó, queda el hueco. */
export function Portada({ canalId, v, className = '' }: { canalId: string; v: VideoYT; className?: string }) {
  return (
    <span className={`portada ${className}`}>
      <img src={`/api/ideas/${canalId}/portada/${encodeURIComponent(v.id)}`} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
      {v.red && <Logo de={v.red} chico />}
    </span>
  )
}

export function Md({ texto }: { texto: string }) {
  const html = useMemo(() => markdown(texto), [texto])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}
