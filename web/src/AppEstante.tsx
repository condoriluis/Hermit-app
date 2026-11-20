import { memo, useEffect, useRef } from 'react'
import type { Card, Previa, Produce, SessionMeta } from '../../shared/types'
import { VENTA } from '../../shared/venta'
import { useDesplazando } from './desplazando'
import { hace, useStored } from './AppBase'
import { Icono, type NombreIcono } from './Iconos'
import { Icon } from './Composer'

export type AccionesCartel = { elegir(c: Card): void; duplicar(c: Card): void; borrar(c: Card): void }

/**
 * Las skills del inicio, agrupadas por lo que produce cada una (`produce`): Videos, Artículos, Imágenes y, al final, las
 * que no producen nada (herramientas). Cada cartel lleva su último video si lo tiene y, si no, su icono y qué hace; abajo,
 * cuánto se usa. Memorizado: escribir en el compositor de abajo no las vuelve a dibujar (ni a sus videos de fondo).
 */
/** Los grupos del estante, en orden: lo que produce cada card y, al final, las que no producen nada (herramientas). */
const GRUPOS: { titulo: string; icono: NombreIcono; produce?: Produce }[] = [
  { titulo: 'Videos', icono: 'video', produce: 'video' },
  { titulo: 'Artículos', icono: 'documento', produce: 'articulo' },
  { titulo: 'Imágenes', icono: 'imagen', produce: 'imagen' },
  { titulo: 'Presentaciones', icono: 'diapositivas', produce: 'presentacion' },
  { titulo: 'Herramientas', icono: 'lapiz' }
]

/** El estante: una fila de botones centrada elige el grupo; debajo, solo su parrilla. Se recuerda el último grupo. */
export const Carteles = memo(function Carteles({ cards, activa, previas, sessions, acciones }: { cards: Card[]; activa: string; previas: Record<string, Previa>; sessions: SessionMeta[]; acciones: AccionesCartel }) {
  // Al desplazarlas, las que pasan bajo el cursor no arrancan su video.
  const rejilla = useRef<HTMLDivElement>(null)
  useDesplazando(rejilla)
  // Un grupo por tipo de producción; los grupos sin carteles no salen.
  const grupos = GRUPOS.map((g) => [g, cards.filter((c) => c.produce === g.produce)] as const).filter(([, lista]) => lista.length)
  const [grupo, setGrupo] = useStored<string>('grupoEstilos', '')
  const grupoActiva = cards.find((c) => c.id === activa)?.produce ?? 'herramientas'
  // Si el grupo guardado ya no existe, abre el de la card elegida (o el primero). Un grupo es su `produce` o «herramientas».
  const activo = grupos.find(([g]) => (g.produce ?? 'herramientas') === grupo) ?? grupos.find(([g]) => (g.produce ?? 'herramientas') === grupoActiva) ?? grupos[0]
  const claveActiva = activo ? (activo[0].produce ?? 'herramientas') : ''
  // Al cambiar de grupo, el estante vuelve arriba (quien scrollea es .new-top).
  useEffect(() => {
    rejilla.current?.closest('.new-top')?.scrollTo({ top: 0 })
  }, [claveActiva])
  if (!activo) return null
  return (
    <div className="estantes" ref={rejilla}>
      {grupos.length > 1 && (
        <div className="estantes-filtro" role="group" aria-label="Tipo de estilo">
          {grupos.map(([g, lista]) => {
            const clave = g.produce ?? 'herramientas'
            return (
              <button key={g.titulo} className={`estante-filtro${clave === claveActiva ? ' on' : ''}`} aria-pressed={clave === claveActiva} onClick={() => setGrupo(clave)}>
                <Icono de={g.icono} />
                {g.titulo}
                <span className="cuenta">{lista.length}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="cards" role="region" aria-label={`Estilos de ${activo[0].titulo}`}>
        {activo[1].map((c) => (
          <Cartel key={c.id} c={c} activa={c.id === activa} previa={previas[c.id]} hilos={sessions.filter((s) => s.cardId === c.id && !s.archived)} acciones={acciones} />
        ))}
      </div>
    </div>
  )
})

/** Un cartel del estante: su último video (quieto hasta pasar el ratón), su última imagen, la portada de su último artículo o su icono y qué hace, y abajo cuánto se usa. */
function Cartel({ c, activa, previa, hilos, acciones }: { c: Card; activa: boolean; previa?: Previa; hilos: SessionMeta[]; acciones: AccionesCartel }) {
  return (
    <button
      className={`card ${activa ? 'active' : ''}`}
      onClick={() => acciones.elegir(c)}
      title={c.description}
      onMouseEnter={(e) => e.currentTarget.querySelector('video')?.play().catch(() => {})}
      onMouseLeave={(e) => e.currentTarget.querySelector('video')?.load()}
    >
      {/* previas de las cards: el cuadro quieto hasta que pasas por encima; en las de imágenes, la última imagen. Al salir,
          `load()` vuelve a él y suelta el video. */}
      {previa ? (
        previa.tipo === 'video' ? (
          <video className="card-previa" src={previa.video} poster={previa.cuadro} muted loop playsInline preload="none" />
        ) : (
          <img className="card-previa" src={previa.imagen} alt="" loading="lazy" />
        )
      ) : (
        <span className="card-fondo">
          <span className="card-icon"><Icon icon={c.icon ?? '✦'} /></span>
          <span className="card-desc">{c.description}</span>
        </span>
      )}
      {/* Los estilos que se arman con clips de Flow gastan créditos de Google: se avisa con una cinta en la esquina. */}
      {c.clips && (
        <span className="card-cinta" title="Se hace con clips de Google Flow: gasta créditos de tus cuentas de Google">
          <span>Créditos</span>
        </span>
      )}
      {/* En la app que se vende, las cards de Hermit ni se duplican ni se borran; las de tus estilos se borran. */}
      {(!VENTA || c.tuya) && (
        <span className="card-actions">
          {!VENTA && (
            <span
              role="button"
              title={`Duplicar: sale una card nueva con la misma skill${c.skill ? ` /${c.skill}` : ''}, que puedes cambiar a tu gusto en cards.json`}
              onClick={(e) => (e.stopPropagation(), acciones.duplicar(c))}
            >
              ⧉
            </span>
          )}
          <span role="button" className="danger" title="Eliminar" onClick={(e) => (e.stopPropagation(), acciones.borrar(c))}>
            ✕
          </span>
        </span>
      )}
      <span className="card-pie">
        <span className="card-title">{c.title}</span>
        <Uso hilos={hilos} />
      </span>
    </button>
  )
}

/** Cuánto se usa una skill: los hilos que trabajan ahora, que es lo que más importa, o cuántos hay y cuándo fue el último. */
function Uso({ hilos }: { hilos: SessionMeta[] }) {
  const trabajando = hilos.filter((s) => s.running).length
  if (trabajando) return <span className="card-uso vivo">● {trabajando} trabajando</span>
  if (!hilos.length) return <span className="card-uso">Sin hilos aún</span>
  return (
    <span className="card-uso">
      {hilos.length === 1 ? '1 hilo' : `${hilos.length} hilos`} · {hace(Math.max(...hilos.map((s) => s.updatedAt)))}
    </span>
  )
}
