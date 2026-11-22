import { useEffect, useMemo, useRef, useState } from 'react'
import { CANAL_CARD, IDEAS_CARD } from '../../shared/ideas' // ideas
import { MODELO3D_CARD } from '../../shared/modelos3d' // modelos 3D
import type { AvanceCorto, AvisoComunidad, Card, Model, ServerPush, SessionMeta } from '../../shared/types'
import { NOMBRE_AGENTE, proveedorDe } from '../../shared/providers'
import { AvisoVideos } from './AvisoVideos'
import { VENTA } from '../../shared/venta'
import { Ideas } from './Ideas' // ideas
import { Clips } from './Clips' // clips
import { textoAHtml } from './markdown'
import { Opciones } from './Opciones'
import { api } from './api'
import { eventos } from './eventos'
import { avisarAnuncio, useAvisos } from './avisos'
import { useBarraPlegada, vistaDeLote, type Plegado } from './Barra'
import { Icon } from './Composer'
import { threadIcons } from './etiquetas'
import { Cabecera } from './Cabecera' // el marco: cabecera y barra de estado
import { BarraEstado } from './BarraEstado'
import { esDeEstudio } from './Estudio' // panel de etapas
import { MisVideos } from './MisVideos'
import { MisArticulos } from './MisArticulos'
import { MisImagenes } from './MisImagenes'
import { MisPresentaciones } from './MisPresentaciones'
import { Modelos3D } from './Modelos3D' // modelos 3D
import { abrirPublicacion, Comunidad } from './Comunidad' // comunidad
import { PedirMejora } from './PedirMejora' // comunidad
import { Icono } from './Iconos'
import { Bienvenida } from './Bienvenida'
import { Novedades } from './Novedades'
import { avisarTanda, AvisoRedes, ConNavegadorRedes } from './Redes' // redes
import { AvisoFlow } from './Flow' // Google Flow
import { TooltipGlobal } from './Tooltip'
import { ToastContainer } from './Toast'
import './Barra.css'
import { cuando, filled, go, lastChoice, newId, readHash, respuesta, sinTildes, useStored, type Saved, type View } from './AppBase'
import { FilaHilo, LoteFila, SelectBar, SessionMenu, type AccionesFila } from './AppBarra'
import { NewSession } from './AppNuevo'
import { SessionView } from './AppSesion'

/** Cuánto lleva quieto un hilo antes de archivarse solo (ver «Archivado automático» en App). */
const QUIETO = 12 * 3600_000

export function App() {
  const [view, setView] = useState<View>(readHash)
  const [cards, setCards] = useState<Card[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  // Los eventos de cada hilo no viven aquí sino en `eventos.ts`: llegan muchas veces por segundo y solo los pinta el abierto.
  // En qué fase va cada video, para la barra lateral. Lo manda el servidor cuando cambia (`server/avances.ts`).
  const [avances, setAvances] = useState<Record<string, AvanceCorto>>({}) // avance
  const abierto = useRef<string | null>(null) // panel de etapas: el hilo abierto, para el WebSocket
  const socket = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [falloEstado, setFalloEstado] = useState('')
  const [app, setApp] = useState('')
  const [version, setVersion] = useState('')
  const [creador, setCreador] = useState(false) // esta copia es la del creador (`server/permisos.ts`): Ideas y lo suyo
  const [menu, setMenu] = useState<{ session: SessionMeta; x: number; y: number } | null>(null)
  // El hilo que se renombra en su fila de la barra lateral.
  const [renombrando, setRenombrando] = useState<string | null>(null)
  // La barra lateral plegada en una columna de iconos (Ctrl+B, o sola en una ventana estrecha).
  const [plegado, setPlegado] = useStored<Plegado>('barraPlegada', {})
  const [plegada, plegar] = useBarraPlegada(plegado, setPlegado)
  const [showArchived, setShowArchived] = useState(false)
  // Con hilos seleccionados (aunque sea ninguno), un clic en un hilo lo marca en vez de abrirlo.
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [anchor, setAnchor] = useState('')
  // La altura donde empezó la selección: el globo de acciones aparece ahí.
  const [pickY, setPickY] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, Saved>>(() => {
    try {
      return JSON.parse(localStorage.getItem('drafts') ?? '{}')
    } catch {
      return {}
    }
  })
  useEffect(() => localStorage.setItem('drafts', JSON.stringify(drafts)), [drafts])
  // El hilo nuevo en blanco también escribe en un borrador, que solo sale en la lista cuando lo dejas a medias.
  const [freshId, setFreshId] = useState(() => sessionStorage.getItem('fresh') ?? newId())
  useEffect(() => sessionStorage.setItem('fresh', freshId), [freshId])
  const draftId = view.kind === 'draft' ? view.id : view.kind === 'new' ? freshId : null

  useEffect(() => {
    const onHash = () => setView(readHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    let ws: WebSocket
    let retry: ReturnType<typeof setTimeout>
    const connect = () => {
      ws = new WebSocket(`ws://${location.host}/ws`)
      socket.current = ws
      ws.onopen = async () => {
        const socket = ws
        socket.send(JSON.stringify({ type: 'subscribe', sessionId: abierto.current }))
        setConnected(true)
        try {
          const state = await api('/api/state')
          setCards(state.cards)
          // Los modelos pueden llegar después, por el WebSocket: una lista vacía no tapa la que ya llegó.
          if (state.models.length) setModels(state.models)
          setApp(state.app)
          setVersion(state.version ?? '')
          setSessions(state.sessions)
          setAvances(state.avances ?? {}) // avance
          setCreador(!!state.creador)
          eventos.conexion(true)
          setFalloEstado('')
          // Mientras no hubo conexión no llegaron avisos: los paneles de etapas vuelven a leer su avance.
          dispatchEvent(new CustomEvent('hermit-etapas')) // panel de etapas
        } catch (e) {
          // Sin el estado la app se queda vacía: se dice abajo en la barra y se vuelve a intentar al reconectar.
          setFalloEstado(`No se pudo leer el estado de Hermit: ${e instanceof Error ? e.message : String(e)}`)
          socket.close()
        }
      }
      ws.onclose = () => {
        setConnected(false)
        eventos.conexion(false)
        retry = setTimeout(connect, 800)
      }
      ws.onmessage = (msg) => {
        const push = JSON.parse(msg.data) as ServerPush
        if (push.type === 'cards') setCards(push.cards)
        if (push.type === 'models') setModels(push.models)
        // La sección Ideas escucha sus avisos (cada paso de la investigación, lo que escribe Claude) donde esté.
        if (push.type === 'ideas') dispatchEvent(new CustomEvent('hermit-ideas', { detail: push })) // ideas
        if (push.type === 'comunidad') dispatchEvent(new CustomEvent('hermit-comunidad')) // comunidad
        // Clips en vivo: el estado del live y las frases nuevas de su transcripción, donde esté la página.
        if (push.type === 'envivo') dispatchEvent(new CustomEvent('hermit-envivo', { detail: push.vivo })) // clips en vivo
        if (push.type === 'envivo-texto') dispatchEvent(new CustomEvent('hermit-envivo-texto', { detail: push })) // clips en vivo
        if (push.type === 'redes') {
          dispatchEvent(new CustomEvent('hermit-redes', { detail: push.aviso }))
          if (push.acabo) avisarTanda(push.acabo)
        } // redes
        // Cambió la carpeta de un hilo: su panel de etapas vuelve a leer su avance.
        if (push.type === 'etapas') dispatchEvent(new CustomEvent('hermit-etapas', { detail: push.sessionId })) // panel de etapas
        if (push.type === 'avance') setAvances((all) => ({ ...all, [push.sessionId]: push.avance })) // avance
        if (push.type === 'session') {
          eventos.cambio(push.session.id)
          setSessions((list) => [push.session, ...list.filter((s) => s.id !== push.session.id)].sort((a, b) => b.updatedAt - a.updatedAt))
        }
        if (push.type === 'removed') {
          setSessions((list) => list.filter((s) => s.id !== push.sessionId))
          eventos.quitar(push.sessionId)
          localStorage.removeItem(respuesta(push.sessionId))
        }
        // Panel de etapas: lo que va escribiendo cada `Write`, solo del hilo abierto, que es el único que lo pinta.
        if (push.type === 'draft') eventos.escrito(push.sessionId, push.draft)
        if (push.type === 'events') eventos.llegan(push.sessionId, push)
      }
    }
    connect()
    return () => {
      clearTimeout(retry)
      ws.onclose = null
      ws.close()
    }
  }, [])

  const openId = view.kind === 'session' ? view.id : null
  abierto.current = openId
  // El servidor manda los eventos del hilo abierto. El que se deja se guarda para volver, si no trabaja (`eventos.ts`).
  const deSesiones = useRef(sessions)
  deSesiones.current = sessions
  useEffect(() => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: 'subscribe', sessionId: openId }))
    eventos.abrir(openId, (id) => {
      const meta = deSesiones.current.find((s) => s.id === id)
      return !!(meta?.running || meta?.background?.length)
    })
  }, [openId])

  // Lo último que se vio de cada hilo. `updatedAt` solo cambia al empezar o acabar un turno, así que si es más
  // nuevo que lo visto, el hilo terminó sin que lo miraras. Lo anterior a la primera vez cuenta como visto.
  const [seen, setSeen] = useStored<{ since: number; at: Record<string, number> }>('seen', { since: Date.now(), at: {} })
  const openUpdated = sessions.find((s) => s.id === openId)?.updatedAt
  useEffect(() => {
    if (openId && openUpdated && openUpdated > (seen.at[openId] ?? 0)) setSeen({ ...seen, at: { ...seen.at, [openId]: openUpdated } })
  }, [openId, openUpdated])
  const finished = (s: SessionMeta) => !s.running && !s.background?.length && s.id !== openId && s.updatedAt > (seen.at[s.id] ?? seen.since)
  // Avisos: la notificación y el tono cuando algo acaba mientras miras otra cosa, y en el título los del punto verde.
  // Lo que terminó (o espera) sin que lo miraras: alimenta el título de la ventana, los avisos y la campana de la barra.
  const sinVer = sessions.filter((s) => !s.archived && finished(s))
  useAvisos({ sessions, cards, openId, sinVer: sinVer.length, abrir: (id) => go({ kind: 'session', id }) })

  // Archivado automático: lo que hacías a mano con casi todos los hilos. Vive aquí y no en el servidor porque «ya lo
  // viste» es de este navegador (`seen`). Un hilo se archiva solo si cumple todo: su card no tiene estudio (Hermit, Ideas:
  // los videos se siguen en su estudio), ya lo viste (sin el punto verde), no trabaja ni espera nada, su último turno
  // acabó bien (`acaboBien`, del servidor) y lleva 12 h quieto. Tampoco el que miras ni uno con una respuesta a medio
  // escribir. Se desarchiva como siempre y entonces se queda: `archivadosSolos` guarda el `updatedAt` con el que se
  // archivó, y solo vuelve a contar si el hilo tiene otro turno.
  const [archivadosSolos, setArchivadosSolos] = useStored<Record<string, number>>('archivadosSolos', {})
  const [ahora, setAhora] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 10 * 60_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!connected) return
    const quietos = sessions.filter((s) => {
      const card = cardOf(s.cardId)
      if (!card || esDeEstudio(card) || s.archived || s.id === openId || archivadosSolos[s.id] === s.updatedAt) return false
      if (s.running || s.background?.length || s.pendiente || s.acaboBien !== true) return false
      return s.updatedAt <= (seen.at[s.id] ?? seen.since) && ahora - s.updatedAt >= QUIETO && !localStorage.getItem(respuesta(s.id))
    })
    if (!quietos.length) return
    const vivos = Object.entries(archivadosSolos).filter(([id]) => sessions.some((s) => s.id === id))
    setArchivadosSolos(Object.fromEntries([...vivos, ...quietos.map((s) => [s.id, s.updatedAt] as const)]))
    for (const s of quietos) api(`/api/sessions/${s.id}/archive`, { archived: true }).catch(() => {}) // se reintenta tras su próximo turno
  }, [sessions, cards, seen, ahora, connected, openId])

  // Al cambiar de vista: si el hilo nuevo quedó a medias, pasa a la lista y el próximo empieza en blanco. Los borradores
  // vacíos que no están abiertos se tiran.
  const left = useRef(draftId)
  useEffect(() => {
    if (left.current === freshId && draftId !== freshId && filled(drafts[freshId])) setFreshId(newId())
    left.current = draftId
    setDrafts((all) => {
      const keep = Object.entries(all).filter(([id, d]) => id === draftId || filled(d))
      return keep.length === Object.keys(all).length ? all : Object.fromEntries(keep)
    })
  }, [draftId])

  /**
   * «Nuevo chat» con algo escrito guarda lo escrito como borrador y abre uno en blanco. Siempre es otro inicio: con el mismo,
   * la galería de un estilo seguía en el sitio de las cards.
   */
  function newChat() {
    setFreshId(newId())
    go({ kind: 'new' })
  }

  function dropDraft(id: string) {
    setDrafts(({ [id]: _, ...rest }) => rest)
    if (view.kind === 'draft' && view.id === id) go({ kind: 'new' })
  }

  // Los hilos de Ideas y de «Nuevo modelo» son de cards que no salen en el inicio: les dan su icono.
  const cardOf = (id: string) => cards.find((c) => c.id === id) ?? [IDEAS_CARD, CANAL_CARD, MODELO3D_CARD].find((c) => c.id === id)
  // Antes de dibujar: las etiquetas de hilo del compositor y de las burbujas lo leen al pintarse.
  threadIcons.clear()
  for (const s of sessions) {
    const icon = cardOf(s.cardId)?.icon
    if (icon) threadIcons.set(s.id, icon)
  }
  const archived = sessions.filter((s) => s.archived)
  // Los videos de un lote van juntos, donde cae el más reciente.
  const lista: (SessionMeta | SessionMeta[])[] = []
  const lotes = new Map<string, SessionMeta[]>()
  for (const s of sessions.filter((s) => !s.archived)) {
    if (!s.lote) {
      lista.push(s)
      continue
    }
    let grupo = lotes.get(s.lote.id)
    if (!grupo) lotes.set(s.lote.id, (grupo = [])), lista.push(grupo)
    grupo.push(s)
  }
  const [abiertos, setAbiertos] = useStored<Record<string, boolean>>('lotes', {})
  /** Un lote con sus videos en orden. Abierto si lo abriste, o si el hilo que miras es de este lote. */
  const delLote = (grupo: SessionMeta[]) => {
    const videos = [...grupo].sort((a, b) => a.lote!.n - b.lote!.n)
    const id = videos[0].lote!.id
    return { id, videos, abierto: abiertos[id] ?? videos.some((s) => s.id === openId) }
  }
  // La lista por fechas. Va de lo más nuevo a lo más viejo, así que cada sección empieza donde cambia el día.
  const secciones: { nombre: string; items: typeof lista }[] = []
  for (const x of lista) {
    const nombre = cuando(Array.isArray(x) ? Math.max(...x.map((s) => s.updatedAt)) : x.updatedAt)
    if (secciones.at(-1)?.nombre !== nombre) secciones.push({ nombre, items: [] })
    secciones.at(-1)!.items.push(x)
  }

  // Buscar: entre todos los hilos, también los archivados y los de cada lote, por su título o el de su card, sin
  // importar tildes. Ctrl+K lleva al campo, y despliega la barra si estaba plegada; Escape lo vacía. Plegada, la lista no
  // se filtra: no se ve qué se busca.
  const [busca, setBusca] = useState('')
  const campoBusca = useRef<HTMLInputElement>(null)
  // comunidad: tus avisos sin leer, junto a «Comunidad». Se piden cada 2 minutos mientras se ve Hermit, cada 10 con la
  // ventana oculta (un anuncio avisa aunque no la estés mirando), y al leerlos. Si subieron, se mira si hay un anuncio.
  const [avisosComunidad, setAvisosComunidad] = useState(0)
  useEffect(() => {
    let sabidos = 0
    let pedida = 0
    const pedir = async () => {
      if (document.visibilityState !== 'visible' && Date.now() - pedida < 600_000) return
      pedida = Date.now()
      try {
        const { sinLeer } = await api<{ sinLeer: number }>('/api/comunidad/avisos?cuenta')
        setAvisosComunidad(sinLeer)
        if (sinLeer > sabidos) avisarAnuncio((await api<{ avisos: AvisoComunidad[] }>('/api/comunidad/avisos')).avisos, abrirPublicacion)
        sabidos = sinLeer
      } catch {
        // Sin conexión o sin cuenta: se vuelve a pedir.
      }
    }
    void pedir()
    const t = setInterval(pedir, 120_000)
    addEventListener('hermit-comunidad-avisos', pedir)
    return () => (clearInterval(t), removeEventListener('hermit-comunidad-avisos', pedir))
  }, [])
  const buscar = () => (plegar(false), setTimeout(() => campoBusca.current?.focus()))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') e.preventDefault(), buscar()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  // Buscar está en la cabecera, siempre a la vista: filtra aunque la barra esté plegada, y buscar la despliega.
  const q = sinTildes(busca.trim())
  useEffect(() => {
    if (q && plegada) plegar(false)
  }, [q])
  const encontrados = q ? sessions.filter((s) => sinTildes(`${s.title} ${cardOf(s.cardId)?.title ?? ''}`).includes(q)) : []

  /**
   * Marca o desmarca un hilo; con Mayús marca todos los que hay a la vista desde el último que tocaste. El tramo va en el
   * orden en que se ven: los de un lote plegado no están, y si no, «Eliminar» borraba hilos que no se veían.
   */
  function pick(id: string, range: boolean) {
    const next = new Set(selected)
    const order = (
      q
        ? encontrados
        : [
            ...secciones.flatMap((sec) =>
              sec.items.flatMap((x) => {
                if (!Array.isArray(x)) return [x]
                const lote = delLote(x)
                return lote.abierto ? lote.videos : []
              })
            ),
            ...(showArchived ? archived : [])
          ]
    ).map((s) => s.id)
    const [a, b] = [order.indexOf(anchor), order.indexOf(id)]
    if (range && a >= 0 && b >= 0) order.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((i) => next.add(i))
    else if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
    setAnchor(id)
  }

  // Lo que hacen las filas, siempre las mismas funciones (las filas van memorizadas) y con lo de ahora.
  const alFila = useRef<AccionesFila>(null as never)
  alFila.current = {
    clic(s, e) {
      if (!selected && !e.ctrlKey && !e.metaKey) return go({ kind: 'session', id: s.id })
      if (!selected) setPickY(e.clientY)
      pick(s.id, e.shiftKey)
    },
    // Doble clic: renombrarlo ahí mismo. Sus dos clics ya lo abrieron. Seleccionando (o con Ctrl o Mayús), cada clic
    // marca o desmarca, y el doble clic no hace nada más. Con la barra plegada no se ve el título: tampoco.
    doble: (s, e) => void (!selected && !plegada && !e.ctrlKey && !e.metaKey && !e.shiftKey && setRenombrando(s.id)),
    menu: (s, e) => setMenu({ session: s, x: e.clientX, y: e.clientY }),
    renombrado: () => setRenombrando(null)
  }
  const accionesFila = useMemo<AccionesFila>(
    () => ({
      clic: (s, e) => alFila.current.clic(s, e),
      doble: (s, e) => alFila.current.doble(s, e),
      menu: (s, e) => alFila.current.menu(s, e),
      renombrado: () => alFila.current.renombrado()
    }),
    []
  )
  const row = (s: SessionMeta) => (
    <FilaHilo
      key={s.id}
      s={s}
      icono={cardOf(s.cardId)?.icon ?? '•'}
      activa={openId === s.id && !selected}
      marcada={selected ? selected.has(s.id) : undefined}
      plegada={plegada}
      avance={avances[s.id]}
      terminada={finished(s)}
      renombrando={renombrando === s.id}
      acciones={accionesFila}
    />
  )
  const lastCard = () => cardOf(localStorage.getItem('card') ?? '') ?? cards[0]
  const newCard = view.kind === 'new' ? (cardOf(view.cardId ?? '') ?? lastCard()) : view.kind === 'draft' ? (cardOf(drafts[view.id]?.cardId ?? '') ?? lastCard()) : undefined
  const shownDrafts = Object.entries(drafts)
    .filter(([id, d]) => filled(d) && !(id === freshId && view.kind === 'new'))
    .sort(([, a], [, b]) => b.at - a.at)

  // Lo que dice la barra de estado a la derecha: el agente y el modelo de la vista abierta (en un hilo, el suyo; en el
  // inicio, el último elegido a mano) y cuántos hilos trabajan ahora.
  const modeloActivo = (() => {
    const id = view.kind === 'session' ? sessions.find((s) => s.id === view.id)?.model : view.kind === 'new' || view.kind === 'draft' ? lastChoice(models)?.model : undefined
    if (!id) return ''
    // Los agentes ACP (Devin, Antigravity…) ya traen su nombre en la etiqueta del modelo: no se repite.
    const etiqueta = models.find((m) => m.id === id)?.label ?? id
    const agente = NOMBRE_AGENTE[proveedorDe(id)]
    return etiqueta.startsWith(`${agente} · `) ? etiqueta : `${agente} · ${etiqueta}`
  })()
  const trabajando = sessions.filter((s) => !s.archived && (s.running || !!s.background?.length))

  return (
    <>
      <TooltipGlobal />
      <ToastContainer />
      <div className={`app${plegada ? ' plegada' : ''}`}>
      <Cabecera
        plegada={plegada}
        plegar={plegar}
        onNuevo={newChat}
        enOpciones={view.kind === 'opciones'}
        onOpciones={() => go({ kind: 'opciones' })}
        avisosComunidad={avisosComunidad}
        busca={busca}
        setBusca={setBusca}
        campoBusca={campoBusca}
      />
      <div className="cuerpo">
      <aside className="sidebar">
        {/* Plegada, cada botón es su icono y dice qué es al pasar el ratón; los textos se esconden en Barra.css. */}
        <button className={`new-chat primario${view.kind === 'new' ? ' active' : ''}`} onClick={newChat} title={plegada ? 'Nuevo chat' : undefined}>
          <span className="new-chat-icon">
            <Icono de="mas" />
          </span>{' '}
          Nuevo chat
        </button>
        <div className="nav-grupo">Crear</div>
        {(!VENTA || creador) && (
          <button className={`new-chat${view.kind === 'ideas' ? ' active' : ''}`} onClick={() => go({ kind: 'ideas' })} title={plegada ? 'Ideas' : undefined}>
            <span className="new-chat-icon">
              <Icono de="foco" />
            </span>{' '}
            Ideas
          </button>
        )}
        {(!VENTA || creador) && (
          <button className={`new-chat${view.kind === 'clips' ? ' active' : ''}`} onClick={() => go({ kind: 'clips' })} title={plegada ? 'Clips' : undefined}>
            <span className="new-chat-icon">
              <Icono de="tramo" />
            </span>{' '}
            Clips
          </button>
        )}
        <button
          className={`new-chat${view.kind === 'galeria' && view.tipo === 'video' ? ' active' : ''}`}
          onClick={() => go({ kind: 'galeria', tipo: 'video' })}
          title={plegada ? 'Mis videos' : undefined}
        >
          <span className="new-chat-icon">
            <Icono de="video" />
          </span>{' '}
          Mis videos
        </button>
        <button
          className={`new-chat${view.kind === 'galeria' && view.tipo === 'imagen' ? ' active' : ''}`}
          onClick={() => go({ kind: 'galeria', tipo: 'imagen' })}
          title={plegada ? 'Mis imágenes' : undefined}
        >
          <span className="new-chat-icon">
            <Icono de="imagen" />
          </span>{' '}
          Mis imágenes
        </button>
        {(!VENTA || creador) && (
          <button
            className={`new-chat${view.kind === 'galeria' && view.tipo === 'articulo' ? ' active' : ''}`}
            onClick={() => go({ kind: 'galeria', tipo: 'articulo' })}
            title={plegada ? 'Mis artículos' : undefined}
          >
            <span className="new-chat-icon">
              <Icono de="lapiz" />
            </span>{' '}
            Mis artículos
          </button>
        )}
        <button
          className={`new-chat${view.kind === 'galeria' && view.tipo === 'presentacion' ? ' active' : ''}`}
          onClick={() => go({ kind: 'galeria', tipo: 'presentacion' })}
          title={plegada ? 'Mis presentaciones' : undefined}
        >
          <span className="new-chat-icon">
            <Icono de="diapositivas" />
          </span>{' '}
          Mis presentaciones
        </button>
        {/* modelos 3D */}
        <button className={`new-chat${view.kind === 'modelos3d' ? ' active' : ''}`} onClick={() => go({ kind: 'modelos3d' })} title={plegada ? 'Modelos 3D' : undefined}>
          <span className="new-chat-icon">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
              <path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9z" />
              <path d="M3 7.5 12 12.5l9-5M12 12.5v9" />
            </svg>
          </span>{' '}
          Modelos 3D
        </button>
        {/* La comunidad vive en la cabecera (icono de cuenta), con sus avisos sin leer de cuenta. */}
        {/* Redes: lo que falló o las sesiones que se cerraron, cada aviso con su enlace a donde se arregla. */}
        <div className="avisos-redes">
          <AvisoRedes connected={connected} />
        </div>
        <div className="sessions">
          {q ? (
            encontrados.length ? (
              <>
                <div className="barra-seccion">{encontrados.length === 1 ? '1 hilo' : `${encontrados.length} hilos`}</div>
                {encontrados.map(row)}
              </>
            ) : (
              <p className="barra-vacio">Ningún hilo dice «{busca.trim()}».</p>
            )
          ) : (
            <>
          {shownDrafts.length > 0 && <div className="barra-seccion">Borradores</div>}
          {shownDrafts.map(([id, d]) => (
            <div key={id} role="button" className={`session-row draft-row ${view.kind === 'draft' && view.id === id ? 'active' : ''}`} title={plegada ? `Borrador: ${d.text.trim().split('\n')[0] || 'Imagen'}` : undefined} onClick={() => go({ kind: 'draft', id })}>
              <span className="session-icon"><Icon icon={cardOf(d.cardId)?.icon ?? '•'} /></span>
              <span className="session-title">{d.text.trim().split('\n')[0] || 'Imagen'}</span>
              {/* Mientras lo editas no es un borrador todavía: la etiqueta sale al irte a otro hilo. */}
              {!(view.kind === 'draft' && view.id === id) && <span className="draft-tag">Borrador</span>}
              <button className="draft-x" title="Borrar el borrador" onClick={(e) => (e.stopPropagation(), dropDraft(id))}>
                ✕
              </button>
            </div>
          ))}
          {secciones.flatMap((sec) => [
            <div key={`seccion-${sec.nombre}`} className="barra-seccion">
              {sec.nombre}
            </div>,
            ...sec.items.map((x) => {
              if (!Array.isArray(x)) return row(x)
              const { id, videos, abierto } = delLote(x)
              return <LoteFila key={id} videos={videos} card={cardOf(videos[0].cardId)} abierto={abierto} onToggle={() => setAbiertos({ ...abiertos, [id]: !abierto })} fila={row} vista={vistaDeLote(videos, avances)} />
            }),
          ])}
          {/* Los archivados, al final y plegados: casi siempre se llega a ellos buscando. */}
          {archived.length > 0 && (
            <button
              className={`barra-seccion archivados ${showArchived ? 'on' : ''}`}
              title="Los hilos sin estudio que ya viste terminar bien se archivan solos a las 12 h. Desarchívalos con clic derecho."
              onClick={() => setShowArchived(!showArchived)}
            >
              Archivados <span className="cuantos">{archived.length}</span>
            </button>
          )}
          {showArchived && archived.map(row)}
            </>
          )}
        </div>
        {/* La selección flota fuera de la barra lateral, a media altura, señalando a los hilos. */}
        {selected && (
          <SelectBar
            picked={sessions.filter((s) => selected.has(s.id))}
            y={pickY}
            app={app}
            onClose={() => setSelected(null)}
            onDeleted={(ids) => openId && ids.includes(openId) && go({ kind: 'new' })}
          />
        )}
        {menu && (
          <SessionMenu
            {...menu}
            app={app}
            onClose={() => setMenu(null)}
            onSelect={() => {
              if (!selected) setPickY(menu.y)
              setSelected(new Set([...(selected ?? []), menu.session.id]))
              setAnchor(menu.session.id)
            }}
            onDeleted={(id) => openId === id && go({ kind: 'new' })}
            onRename={() => (plegar(false), setRenombrando(menu.session.id))}
          />
        )}
      </aside>

      <main className="main">
        <Bienvenida version={version} />
        <AvisoVideos />
        <AvisoFlow />
        {view.kind === 'opciones' && (
          <Opciones creador={creador} onDone={() => go({ kind: 'new' })} />
        )}
        {(!VENTA || creador) && view.kind === 'ideas' && (
          <Ideas
            canalId={view.canalId}
            cards={cards}
            models={models}
            sessions={sessions}
            onCanal={(canalId) => go({ kind: 'ideas', canalId })}
            onHilo={(id) => go({ kind: 'session', id })}
            // «Hacer con…»: un borrador de esa card con la idea ya escrita, para revisarla antes de mandarla. Si es vertical
            // o un video largo para YouTube lo dice la primera línea de la idea.
            onBorrador={(cardId, texto) => {
              const id = newId()
              setDrafts((all) => ({ ...all, [id]: { text: texto, html: textoAHtml(texto), images: [], cardId, at: Date.now() } }))
              go({ kind: 'draft', id })
            }}
          />
        )}
        {(!VENTA || creador) && view.kind === 'clips' && <Clips sessions={sessions} models={models} onHilo={(id) => go({ kind: 'session', id })} />}
        {view.kind === 'modelos3d' && <Modelos3D />} {/* modelos 3D */}
        {view.kind === 'comunidad' && <Comunidad />}
        {/* comunidad: «Pedir una mejora», que abre el símbolo del agente de cualquier hilo y la publica en Mejoras. */}
        <PedirMejora sessions={sessions} />
        {view.kind === 'galeria' && view.tipo === 'video' && (
          <ConNavegadorRedes>
            <MisVideos cards={cards} sessions={sessions} estilo={view.estilo} onEstilo={(estilo) => go({ kind: 'galeria', tipo: 'video', estilo })} />
          </ConNavegadorRedes>
        )}
        {view.kind === 'galeria' && view.tipo === 'imagen' && <MisImagenes cards={cards} sessions={sessions} />}
        {(!VENTA || creador) && view.kind === 'galeria' && view.tipo === 'articulo' && <MisArticulos cards={cards} sessions={sessions} />}
        {view.kind === 'galeria' && view.tipo === 'presentacion' && <MisPresentaciones cards={cards} sessions={sessions} />}
        {newCard && draftId && (
          <NewSession
            key={draftId}
            card={newCard}
            cards={cards}
            sessions={sessions}
            models={models}
            draft={drafts[draftId]}
            onDraft={(d) =>
              setDrafts((all) => {
                const old = all[draftId]
                // Abrirlo no lo cambia: así no salta al principio de la lista solo por mirarlo.
                if (old ? old.html === d.html && old.images.length === d.images.length : !filled(d)) return all
                return { ...all, [draftId]: { ...old, ...d, cardId: newCard.id, at: Date.now() } }
              })
            }
            onPick={(c) => {
              localStorage.setItem('card', c.id)
              // En un borrador la card es suya; en el hilo nuevo va en el hash.
              setDrafts((all) => (all[draftId] ? { ...all, [draftId]: { ...all[draftId], cardId: c.id } } : all))
              if (view.kind === 'new') go({ kind: 'new', cardId: c.id })
            }}
            onCreated={(id) => {
              setDrafts(({ [draftId]: _, ...rest }) => rest)
              go({ kind: 'session', id })
            }}
          />
        )}
        {view.kind === 'session' && (
          <SessionView
            id={view.id}
            session={sessions.find((s) => s.id === view.id)}
            card={cardOf(sessions.find((s) => s.id === view.id)?.cardId ?? '')}
            models={models}
          />
        )}
      </main>
      </div>
      <BarraEstado
        connected={connected}
        fallo={falloEstado}
        trabajando={trabajando.length}
        nombres={trabajando.map((s) => s.title)}
        modelo={modeloActivo}
        version={version}
        terminadas={[...sinVer]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((s) => {
            const card = cardOf(s.cardId)
            return { id: s.id, titulo: s.title, tarjeta: card?.title, icono: card?.icon, error: s.acaboBien === false, espera: !!s.pendiente }
          })}
        avisosComunidad={avisosComunidad}
        alAbrir={(id) => go({ kind: 'session', id })}
        alComunidad={() => go({ kind: 'comunidad' })}
      />
      <Novedades />
    </div>
    </>
  )
}

