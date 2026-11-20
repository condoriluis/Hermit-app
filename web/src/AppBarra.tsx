import { memo, type ReactNode, useEffect, useState } from 'react'
import type { AvanceCorto, Card, SessionMeta } from '../../shared/types'
import { api } from './api'
import { Confirm } from './Confirm'
import { threadRef } from './etiquetas'
import { Icon } from './Composer'
import { TituloDeFila, vistaDeVideo, type Vista } from './Barra'
import { Renombrar } from './Renombrar'
import { Icono } from './Iconos'

export type AccionesFila = {
  clic(s: SessionMeta, e: React.MouseEvent): void
  doble(s: SessionMeta, e: React.MouseEvent): void
  menu(s: SessionMeta, e: React.MouseEvent): void
  renombrado(): void
}

/**
 * Un hilo en la barra lateral. Memorizada: lo que cambia en la app (escribir en el compositor, que otro hilo avance) no
 * vuelve a dibujar las otras doscientas. `marcada`: si se está seleccionando, si este va marcado.
 */
export const FilaHilo = memo(function FilaHilo({ s, icono, activa, marcada, plegada, avance, terminada, renombrando, acciones }: { s: SessionMeta; icono: string; activa: boolean; marcada?: boolean; plegada: boolean; avance?: AvanceCorto; terminada: boolean; renombrando: boolean; acciones: AccionesFila }) {
  if (renombrando)
    return (
      <div className="session-row renombrando">
        <span className="session-icon"><Icon icon={icono} /></span>
        <Renombrar session={s} onListo={acciones.renombrado} />
      </div>
    )
  const vista = vistaDeVideo(s, avance)
  return (
    <button
      className={`session-row ${activa ? 'active' : ''} ${s.archived ? 'archived' : ''} ${marcada ? 'selected' : ''}`}
      title={plegada ? [s.title, vista?.title].filter(Boolean).join('\n') : undefined}
      onClick={(e) => acciones.clic(s, e)}
      onDoubleClick={(e) => acciones.doble(s, e)}
      onContextMenu={(e) => {
        e.preventDefault()
        acciones.menu(s, e)
      }}
    >
      {marcada !== undefined && <span className="check">{marcada ? '✓' : ''}</span>}
      <span className="session-icon"><Icon icon={icono} /></span>
      <TituloDeFila titulo={s.title} vista={vista} />
      {s.pendiente && <span className="draft-tag">{s.lote?.pausa ? 'En pausa' : 'En espera'}</span>}
      {(s.running || !!s.background?.length) && <span className="dot running" title={s.running ? 'Trabajando' : `En segundo plano: ${s.background!.join(', ')}`} />}
      {terminada && <span className="dot unread" title="Terminó su turno; aún no lo has abierto" />}
      {/* El menú del hilo también con un clic: renombrar, archivar, eliminar… (el clic derecho lo abre igual). */}
      <span
        className="fila-menu"
        role="button"
        title="Opciones del hilo"
        aria-label={`Opciones de «${s.title}»`}
        onClick={(e) => {
          e.stopPropagation()
          acciones.menu(s, e)
        }}
      >
        <Icono de="tres" />
      </span>
    </button>
  )
})

/**
 * El clic derecho sobre un hilo. «Copiar referencia» copia la ruta de su historial: pegada en otro hilo, el agente la
 * lee y tiene el contexto, trabaje donde trabaje. «Renombrar» lo renombra en su fila, como el doble clic.
 */
export function SessionMenu({ session, x, y, app, onClose, onSelect, onDeleted, onRename }: { session: SessionMeta; x: number; y: number; app: string; onClose(): void; onSelect(): void; onDeleted(id: string): void; onRename(): void }) {
  const [error, setError] = useState('')
  const [borrar, setBorrar] = useState(false)
  const busy = session.running || !!session.background?.length

  useEffect(() => {
    if (borrar) return // el Escape es del modal
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    addEventListener('blur', onClose)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('blur', onClose)
    }
  }, [onClose, borrar])

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Eliminar pregunta con el mismo modal que eliminar varios; el menú se va mientras tanto.
  if (borrar)
    return (
      <Confirm
        title={`¿Eliminar «${session.title}»?`}
        action="Eliminar"
        danger
        onClose={onClose}
        onConfirm={async () => {
          await api(`/api/sessions/${session.id}/delete`, {})
          onDeleted(session.id)
        }}
      >
        Se borra su historial y no se puede deshacer.
      </Confirm>
    )

  return (
    <div className="menu-backdrop" onClick={onClose} onContextMenu={(e) => (e.preventDefault(), onClose())}>
      <div className="menu" style={{ left: Math.min(x, innerWidth - 230), top: Math.min(y, innerHeight - 180) }} onClick={(e) => e.stopPropagation()}>
        <button
          title="Para dárselo como contexto a otro hilo"
          onClick={() => run(() => navigator.clipboard.writeText(threadRef(session.title, session.id, app)))}
        >
          Copiar referencia
        </button>
        <button title="También con doble clic en el hilo" onClick={() => run(async () => onRename())}>
          Renombrar
        </button>
        <button title="Para archivar o eliminar varios a la vez (también con Ctrl+clic)" onClick={() => run(async () => onSelect())}>
          Seleccionar
        </button>
        <button onClick={() => run(() => api(`/api/sessions/${session.id}/archive`, { archived: !session.archived }))}>{session.archived ? 'Desarchivar' : 'Archivar'}</button>
        <button className="danger" disabled={busy} title={busy ? 'El agente sigue trabajando en este hilo' : undefined} onClick={() => setBorrar(true)}>
          Eliminar
        </button>
        {error && <div className="bad small menu-error">{error}</div>}
      </div>
    </div>
  )
}

/**
 * La barra de los hilos seleccionados: copiar sus referencias, archivarlos o eliminarlos de una vez. Archivar los desarchiva si ya lo estaban
 * todos. Los que siguen trabajando no se eliminan.
 */
export function SelectBar({ picked, y, app, onClose, onDeleted }: { picked: SessionMeta[]; y: number; app: string; onClose(): void; onDeleted(ids: string[]): void }) {
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const allArchived = picked.length > 0 && picked.every((s) => s.archived)
  const free = picked.filter((s) => !s.running && !s.background?.length)
  const busy = picked.length - free.length

  useEffect(() => {
    if (asking) return // el Escape es del modal
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [asking, onClose])

  async function archive() {
    try {
      await Promise.all(picked.map((s) => api(`/api/sessions/${s.id}/archive`, { archived: !allArchived })))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Copia y deja la selección abierta, por si luego quiere archivarlos.
  async function copyRefs() {
    try {
      await navigator.clipboard.writeText(picked.map((s) => threadRef(s.title, s.id, app)).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    // Sin pasar de la línea de la cabecera ni del borde de abajo de la ventana.
    <div className="select-bar" style={{ top: Math.min(Math.max(y, 80), innerHeight - 32) }}>
      {error && <span className="bad small select-error">{error}</span>}
      <div className="select-pill">
        <span className="select-count" title="Clic para marcar · Mayús+clic para un tramo">
          {picked.length}
        </span>
        <button disabled={!picked.length} title="Para dárselos como contexto a otro hilo" onClick={copyRefs}>
          {copied ? 'Copiado' : 'Copiar referencias'}
        </button>
        <button disabled={!picked.length} onClick={archive}>
          {allArchived ? 'Desarchivar' : 'Archivar'}
        </button>
        <button className="danger" disabled={!free.length} onClick={() => setAsking(true)}>
          Eliminar
        </button>
        <button className="select-close" title="Dejar de seleccionar (Esc)" onClick={onClose}>
          ✕
        </button>
      </div>
      {asking && (
        <Confirm
          title={free.length === 1 ? `¿Eliminar «${free[0].title}»?` : `¿Eliminar ${free.length} hilos?`}
          action="Eliminar"
          danger
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            await Promise.all(free.map((s) => api(`/api/sessions/${s.id}/delete`, {})))
            onDeleted(free.map((s) => s.id))
            onClose()
          }}
        >
          Se borra su historial y no se puede deshacer.{busy > 0 && ` ${busy === 1 ? 'Uno sigue trabajando y se queda' : `${busy} siguen trabajando y se quedan`}.`}
        </Confirm>
      )}
    </div>
  )
}

/**
 * Un botón que le pide algo al servidor. Si falla, lo dice a su lado: antes el clic no hacía nada, y lo típico era que
 * el servidor aún no conociera la ruta («pulsa Reiniciar backend»).
 */
export function Pedir({ ruta, title, children }: { ruta: string; title?: string; children: ReactNode }) {
  const [error, setError] = useState('')
  return (
    <>
      <button className="ghost small" title={title} onClick={() => (setError(''), api(ruta, {}).catch((e) => setError(e instanceof Error ? e.message : String(e))))}>
        {children}
      </button>
      {error && <span className="bad small">{error}</span>}
    </>
  )
}

/**
 * Los videos de un lote en la barra lateral: una fila con la card y cuántos van, que se abre en los hilos de cada uno.
 * Si el lote está en pausa, «Seguir» lo reanuda sin abrirlo.
 */
export function LoteFila({ videos, card, abierto, onToggle, fila, vista }: { videos: SessionMeta[]; card?: Card; abierto: boolean; onToggle(): void; fila(s: SessionMeta): ReactNode; vista?: Vista }) {
  const trabajan = videos.filter((s) => s.running || !!s.background?.length).length
  const esperan = videos.filter((s) => s.pendiente).length
  const listos = videos.length - trabajan - esperan
  const pausa = videos.find((s) => s.lote?.pausa)?.lote
  const nombre = `Lote de ${videos.length} · ${card?.title}`
  return (
    <div className="lote">
      {/* Un doble clic lo abre o lo cierra una vez, no dos. */}
      <button className={`session-row lote-row ${abierto ? 'abierto' : ''}`} onClick={(e) => e.detail < 2 && onToggle()} title={`${nombre}: ${listos} terminaron o esperan tu respuesta · ${trabajan} trabajando · ${esperan} en espera`}>
        <span className="session-icon"><Icon icon={card?.icon ?? '•'} /></span>
        <TituloDeFila titulo={nombre} vista={vista} />
        {trabajan > 0 && <span className="dot running" />}
        {/* Cuántos son; mientras falten, cuántos van. */}
        <span className="lote-cuenta">{listos < videos.length ? `${listos}/${videos.length}` : videos.length}</span>
      </button>
      {pausa && (
        <div className="lote-pausa small" title={pausa.pausa}>
          <span className="bad">En pausa</span>
          <Pedir ruta={`/api/lotes/${pausa.id}/seguir`}>Seguir</Pedir>
        </div>
      )}
      {abierto && <div className="lote-videos">{videos.map(fila)}</div>}
    </div>
  )
}
