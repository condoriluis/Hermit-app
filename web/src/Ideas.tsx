import { useEffect, useMemo, useRef, useState } from 'react'
import { alPerfil, esVertical } from '../../shared/ideas'
import type { Canal, CanalCompleto, Card, Model, ServerPush, SessionMeta } from '../../shared/types'
import { api } from './api'
import type { Choice } from './Composer'
import { Confirm } from './Confirm'
import { Logo } from './Logos'
import { CanalForm, Pasos, Perfil, TusVideos } from './IdeasCanal'
import { Investigacion } from './IdeasInvestigacion'
import { Propuestas } from './IdeasPropuestas'
import './Ideas.css'

/**
 * La sección Ideas (`server/ideas/`): un canal, la investigación de su nicho en vivo y las ideas que propone Claude con su
 * evidencia. Todo lo que pasa se ve aquí: cada paso de la investigación, lo que Claude va escribiendo y en qué hilo.
 */

type Push = Extract<ServerPush, { type: 'ideas' }>

/** El modelo para los hilos de la sección: el último que elegiste, o el primero del catálogo. */
function eleccion(models: Model[]): Choice | undefined {
  try {
    const c = JSON.parse(localStorage.getItem('choice') ?? 'null') as Choice | null
    if (c && models.some((m) => m.id === c.model)) return { model: c.model, effort: c.effort }
  } catch {}
  const m = models[0]
  return m && { model: m.id, effort: m.defaultEffort }
}

export function Ideas(props: {
  canalId?: string
  cards: Card[]
  models: Model[]
  sessions: SessionMeta[]
  onCanal(id: string | undefined): void
  onHilo(id: string): void
  onBorrador(cardId: string, texto: string): void
}) {
  const [canales, setCanales] = useState<Canal[] | null>(null)
  const [trabajando, setTrabajando] = useState<string[]>([])
  const [nuevo, setNuevo] = useState(false)
  const [error, setError] = useState('')

  const leerLista = () =>
    api<{ canales: Canal[]; trabajando: string[] }>('/api/ideas').then(
      (r) => (setCanales(r.canales), setTrabajando(r.trabajando)),
      (e) => setError(e.message)
    )
  useEffect(() => void leerLista(), [])

  // Qué canal está investigando, para el punto de la pestaña aunque estés en otro. Un archivo que cambia (la entrevista
  // le pone nombre al canal) vuelve a leer la lista.
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<Push>).detail.trabajo
      if (t) setTrabajando((ids) => (t.estado === 'trabajando' ? [...new Set([...ids, t.canalId])] : ids.filter((i) => i !== t.canalId)))
      else leerLista()
    }
    addEventListener('hermit-ideas', on)
    return () => {
      removeEventListener('hermit-ideas', on)
    }
  }, [])

  /** La entrevista: Claude pregunta en un hilo lo que no sabes poner, y lo va guardando en el canal. */
  async function entrevistar(canalId: string, campo?: string) {
    const elegido = eleccion(props.models)
    if (!elegido) return setError('No hay ningún modelo de Claude disponible.')
    setError('')
    try {
      const r = await api<{ canalId: string; sesion: SessionMeta }>('/api/ideas/entrevista', { canalId, campo, ...elegido })
      setNuevo(false)
      leerLista()
      props.onCanal(r.canalId)
      props.onHilo(r.sesion.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const actual = canales?.find((c) => c.id === props.canalId) ?? (props.canalId ? undefined : canales?.[0])

  return (
    <div className="ideas">
      {/* La página scrollea a todo lo ancho (la barra en el borde); el contenido va centrado con tope. */}
      <div className="ideas-dentro">
          <header className="galeria-head ideas-head">
          <div>
            <h1>Ideas</h1>
            {!nuevo && esVertical(actual) ? (
              <p className="muted">
                Qué video vertical hacer, con evidencia. Hermit busca tu nicho en TikTok y en Instagram, mide cada video contra su cuenta y lee qué piden sus comentarios, y Claude
                propone ideas con señales de demanda, empaque de nichos vecinos, gancho de 4 P en 3 segundos y el riesgo dicho claro.
              </p>
            ) : (
              <p className="muted">
                Qué video largo hacer, con evidencia. Hermit lee tu nicho en YouTube, mide cada video contra su canal y Claude propone ideas con
                señales de demanda, empaque de nichos vecinos, gancho de 4 P y el riesgo dicho claro.
              </p>
            )}
          </div>
        </header>
        {canales && (
          <nav className="ideas-canales">
            {canales.map((c) => (
              <button key={c.id} className={`ideas-canal ${!nuevo && actual?.id === c.id ? 'on' : ''}`} onClick={() => (setNuevo(false), props.onCanal(c.id))}>
                {c.nombre}
                {esVertical(c) && (
                  <span className="logos" title="TikTok e Instagram">
                    <Logo de="tiktok" chico />
                    <Logo de="instagram" chico />
                  </span>
                )}
                {trabajando.includes(c.id) && <span className="dot running" title="Investigando" />}
              </button>
            ))}
            <button className={`ideas-canal mas ${nuevo || !canales.length ? 'on' : ''}`} onClick={() => setNuevo(true)}>
              + Canal
            </button>
          </nav>
        )}
        {error && <p className="bad small">{error}</p>}
        {canales && (nuevo || !canales.length) ? (
          <CanalForm
            primero={!canales.length}
            canales={canales}
            onCancel={canales.length ? () => setNuevo(false) : undefined}
            onGuardado={(c) => {
              setNuevo(false)
              leerLista()
              props.onCanal(c.id)
            }}
            onEntrevista={entrevistar}
          />
        ) : actual ? (
          <CanalVista key={actual.id} id={actual.id} {...props} onCambio={leerLista} onBorrado={() => (leerLista(), props.onCanal(undefined))} onEntrevista={entrevistar} />
        ) : (
          canales && <p className="muted">No existe ese canal.</p>
        )}
      </div>
    </div>
  )
}

function CanalVista(props: {
  id: string
  cards: Card[]
  models: Model[]
  sessions: SessionMeta[]
  onHilo(id: string): void
  onBorrador(cardId: string, texto: string): void
  onCambio(): void
  onBorrado(): void
  onEntrevista(canalId: string, campo?: string): Promise<void>
}) {
  const { id } = props
  const [d, setD] = useState<CanalCompleto | null>(null)
  const [editando, setEditando] = useState(false)
  const [borrar, setBorrar] = useState(false)
  const [error, setError] = useState('')
  // La búsqueda que se está mirando: una ficha del perfil o una fila de Búsquedas filtra los outliers a lo que trajo.
  const [filtro, setFiltro] = useState<string | null>(null)

  const leer = () => api<CanalCompleto>(`/api/ideas/${id}`).then(setD, (e) => setError(e.message))
  useEffect(() => void leer(), [id])

  // En vivo: cada paso de la investigación llega por el WebSocket; las tablas se vuelven a leer cada pocos segundos
  // mientras crecen. Lo que escribe Claude avisa al cambiar un archivo.
  const ultima = useRef(0)
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    const on = (e: Event) => {
      const p = (e as CustomEvent<Push>).detail
      if (p.canalId !== id) return
      if (!p.trabajo) return void leer()
      setD((x) => x && { ...x, trabajo: p.trabajo! })
      const falta = 3000 - (Date.now() - ultima.current)
      clearTimeout(espera.current)
      espera.current = setTimeout(() => ((ultima.current = Date.now()), leer()), p.trabajo.estado === 'trabajando' ? Math.max(0, falta) : 0)
    }
    addEventListener('hermit-ideas', on)
    return () => (removeEventListener('hermit-ideas', on), clearTimeout(espera.current))
  }, [id])

  // El hilo que propone: al terminar su turno se vuelve a leer todo.
  const hiloVivo = props.sessions.find((s) => s.id === d?.hilo?.id)
  const corriendo = !!hiloVivo && (hiloVivo.running || !!hiloVivo.background?.length)
  useEffect(() => {
    if (d?.hilo) leer()
  }, [corriendo])

  // La entrevista: Claude pregunta y espera tu respuesta en su hilo; lo que contestas aparece en el perfil.
  const entrevistaViva = props.sessions.find((s) => s.id === d?.entrevista?.id)
  const preguntando = !!entrevistaViva && (entrevistaViva.running || !!entrevistaViva.background?.length)

  // Lo que se cuenta y se enseña es lo que trajo el perfil de hoy. La evidencia de una idea se busca en toda la
  // investigación: Claude pudo citar algo de antes.
  const vista = useMemo(() => (d?.investigacion ? alPerfil(d.investigacion, d.canal) : null), [d])

  if (!d) return error ? <p className="bad small">{error}</p> : <p className="muted">Cargando…</p>
  const t = d.trabajo
  const investigando = t?.estado === 'trabajando'
  const elegir = eleccion(props.models)
  const c = d.canal
  const completo = !!c.publico && !!c.meta && c.semillas.length >= 5 && c.vecinos.length > 0

  return (
    <>
      {d.entrevista && (
        <div className={`entrevista-barra ${preguntando ? 'trabajando' : completo ? 'lista' : 'espera'}`}>
          {preguntando ? <span className="spinner" /> : <span>💬</span>}
          <span>
            <strong>Entrevista del canal</strong> ·{' '}
            {preguntando
              ? `Claude está pensando la siguiente pregunta o probando frases en ${esVertical(c) ? 'TikTok' : 'YouTube'}…`
              : completo
                ? 'El perfil ya está completo: puedes investigar.'
                : 'Claude espera tu respuesta en su hilo.'}
          </span>
          <span className="spacer" />
          <button className="ghost small" onClick={() => props.onHilo(d.entrevista!.id)}>
            {completo && !preguntando ? 'Ver la entrevista →' : 'Contestar →'}
          </button>
        </div>
      )}
      {editando ? (
        <CanalForm
          canal={d.canal}
          onCancel={() => setEditando(false)}
          onGuardado={() => (setEditando(false), leer(), props.onCambio())}
          onEntrevista={(canalId, campo) => (setEditando(false), props.onEntrevista(canalId, campo))}
        />
      ) : (
        <Perfil d={d} vista={vista} filtro={filtro} onFiltro={setFiltro} onEditar={() => setEditando(true)} onBorrar={() => setBorrar(true)} onPreguntar={(campo) => props.onEntrevista(id, campo)} />
      )}
      {d.rendimiento !== undefined && <TusVideos d={d} elegir={elegir} sessions={props.sessions} onHilo={props.onHilo} onCambio={leer} />}
      <Pasos d={d} corriendo={corriendo} />
      <Investigacion d={d} vista={vista} onCambio={leer} filtro={filtro} onFiltro={setFiltro} />
      {d.investigacion?.videos.length ? (
        <Propuestas
          d={d}
          corriendo={corriendo}
          investigando={investigando}
          elegir={elegir}
          cards={props.cards}
          onHilo={props.onHilo}
          onBorrador={props.onBorrador}
          onCambio={leer}
        />
      ) : null}
      {borrar && (
        <Confirm
          title={`¿Borrar «${d.canal.nombre}»?`}
          action="Borrar"
          danger
          onClose={() => setBorrar(false)}
          onConfirm={() => api(`/api/ideas/${id}/borrar`, {}).then(props.onBorrado)}
        >
          Se borra su carpeta, con la investigación y las ideas. Los hilos de Claude se quedan en la barra lateral.
        </Confirm>
      )}
    </>
  )
}
