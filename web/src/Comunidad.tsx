import { type DragEvent, useEffect, useRef, useState } from 'react'
import type { AdjuntoComunidad, CategoriaComunidad, FeedComunidad, PublicacionComunidad } from '../../shared/types'
import { api, ErrorApi } from './api'
import { Escribir, type Escrito } from './Escribir'
import { Liberar } from './Liberar'
import { Unirse } from './Licencia'
import { Abierta } from './ComunidadAbierta'
import { Avisos } from './ComunidadAvisos'
import { SECCIONES, Cara, Icono, leerVistas, seccionDe, VISTAS } from './ComunidadBase'
import { Perfil } from './ComunidadPerfil'
import { Tarjeta, Bienvenida, ElegirSeccion } from './ComunidadTarjetas'
import { Votar } from './ComunidadVotar'
import './Comunidad.css'

export { SECCIONES } from './ComunidadBase'

/**
 * «Comunidad»: lo que la gente hace con Hermit y cómo lo hace, como la comunidad de Skool y en la paleta de Hermit. Arriba
 * se escribe; luego, las secciones y el feed: lo fijado y después lo que tuvo actividad más reciente (un comentario la
 * sube). Cada publicación se abre en grande, con sus comentarios. A la derecha, la comunidad con sus números y tu perfil.
 * Vive en el Worker del cobro (`licencias/src/comunidad.ts`), por `server/comunidad.ts`, y se vuelve a pedir cada minuto
 * mientras se ve. Quién comentó algo que aún no abres lo recuerda esta computadora (`comunidad:vistas`).
 *
 * Mejoras es lo que la gente quiere que Hermit haga mejor: el creador dice cómo va cada una, y todos lo ven.
 * «Compartir» de un video de «Mis videos» abre el compositor en Lo que hice con ese video (`compartirVideo`).
 *
 * Los comentarios llevan imágenes, como el chat (se pegan, se sueltan o se eligen), se responden (un nivel) y se les da
 * me gusta. Lo de los demás se reporta, y lo reportado por 3 deja de
 * verse hasta que el creador lo revise. La campana junta tus avisos: te comentaron, te respondieron, te dieron me gusta,
 * cambió tu mejora o hay un anuncio; los que no has leído salen también junto a «Comunidad», en la barra lateral. Un
 * anuncio, además, llega como notificación (`avisarAnuncio`).
 */

const COMPARTIR = 'comunidad:compartir'
const ABRIR = 'comunidad:abrir'

/** Lleva a la comunidad con uno de «Mis videos» listo para publicarlo en Lo que hice. */
export function compartirVideo(v: { ruta: string; titulo: string; src: string }) {
  sessionStorage.setItem(COMPARTIR, JSON.stringify(v))
  location.hash = '/comunidad'
  dispatchEvent(new Event(COMPARTIR))
}
/** Lleva a la comunidad con una publicación abierta. */
export function abrirPublicacion(id: string) {
  sessionStorage.setItem(ABRIR, id)
  location.hash = '/comunidad'
  dispatchEvent(new Event(ABRIR))
}

export function Comunidad() {
  const [seccion, setSeccion] = useState<CategoriaComunidad | ''>(() => {
    const guardada = localStorage.getItem('comunidad:seccion')
    return SECCIONES.some((s) => s.id === guardada) ? (guardada as CategoriaComunidad) : ''
  })
  const [feed, setFeed] = useState<FeedComunidad | null>(null)
  const [lista, setLista] = useState<PublicacionComunidad[] | null>(null)
  const [mas, setMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState('')
  // La app que se vende sin cuenta gratis todavía (401): la crea aquí.
  const [sinCuenta, setSinCuenta] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  // El compositor abierto: en qué sección y, si llega de «Mis videos», con qué. `clave` lo vuelve a armar.
  const [escribiendo, setEscribiendo] = useState<{ seccion: CategoriaComunidad; titulo?: string; video?: { subida: Promise<AdjuntoComunidad>; poster?: string }; clave: number } | null>(null)
  // Tu perfil: al tocarlo o, sin nombre, antes de publicar, comentar o dar me gusta (`luego`).
  const [perfil, setPerfil] = useState<{ luego?: () => void } | null>(null)
  const [nueva, setNueva] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [vistas, setVistas] = useState(leerVistas)
  const [, setReloj] = useState(0)
  const subirAlCompositor = useRef<((archivos: File[]) => void) | null>(null)
  // La respuesta de una sección vieja que llega tarde no pisa la nueva.
  const pedido = useRef(0)
  const ahora = useRef({ lista, mas })
  ahora.current = { lista, mas }

  const yo = feed?.yo

  async function cargar(s: CategoriaComunidad | '' = seccion) {
    const n = ++pedido.current
    try {
      const f = await api<FeedComunidad>(`/api/comunidad${s ? `?categoria=${s}` : ''}`)
      if (n !== pedido.current) return
      setFeed(f)
      setError('')
      setSinCuenta(false)
      // Al volver a pedir, lo de las páginas siguientes se queda, si aún va después de la primera.
      const l = ahora.current.lista
      const ids = new Set(f.publicaciones.map((p) => p.id))
      const ultima = f.publicaciones.filter((p) => !p.fijada).at(-1)?.actividad
      const resto = l && f.mas && ultima ? l.filter((p) => !ids.has(p.id) && !p.fijada && p.actividad < ultima) : []
      setLista([...f.publicaciones, ...resto])
      setMas(resto.length ? ahora.current.mas : f.mas)
    } catch (e) {
      if (n !== pedido.current) return
      setSinCuenta(e instanceof ErrorApi && e.status === 401)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function verMas() {
    const ultima = lista?.filter((p) => !p.fijada).at(-1)?.actividad
    if (!ultima || cargandoMas) return
    setCargandoMas(true)
    try {
      const f = await api<FeedComunidad>(`/api/comunidad?${new URLSearchParams({ ...(seccion ? { categoria: seccion } : {}), antes: ultima })}`)
      setLista((l) => [...(l ?? []), ...f.publicaciones.filter((p) => !l?.some((x) => x.id === p.id))])
      setMas(f.mas)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargandoMas(false)
    }
  }

  // Al abrir, al cambiar de sección y cada minuto mientras se ve; también cuando algo se publica desde un hilo.
  useEffect(() => {
    void cargar()
    localStorage.setItem('comunidad:seccion', seccion)
  }, [seccion])
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && void cargar(), 60_000)
    const reloj = setInterval(() => setReloj((n) => n + 1), 60_000)
    const oir = () => void cargar()
    addEventListener('hermit-comunidad', oir)
    return () => (clearInterval(t), clearInterval(reloj), removeEventListener('hermit-comunidad', oir))
  }, [seccion])

  // Lo que llega de fuera: un video para compartir o una publicación para abrir.
  useEffect(() => {
    const compartido = () => {
      const v = sessionStorage.getItem(COMPARTIR)
      if (!v) return
      sessionStorage.removeItem(COMPARTIR)
      const { ruta, titulo, src } = JSON.parse(v) as { ruta: string; titulo: string; src: string }
      setEscribiendo({ seccion: 'hice', titulo, video: { subida: api<AdjuntoComunidad>('/api/comunidad/video', { ruta }), poster: `${src}&cuadro` }, clave: Date.now() })
    }
    const abrir = () => {
      const id = sessionStorage.getItem(ABRIR)
      if (!id) return
      sessionStorage.removeItem(ABRIR)
      setAbierta(id)
    }
    compartido()
    abrir()
    addEventListener(COMPARTIR, compartido)
    addEventListener(ABRIR, abrir)
    return () => (removeEventListener(COMPARTIR, compartido), removeEventListener(ABRIR, abrir))
  }, [])

  /** Sin nombre no se publica ni se comenta: primero se pide. */
  function conNombre(accion: () => void) {
    if (yo && !yo.nombre) setPerfil({ luego: accion })
    else accion()
  }

  function abrirCompositor(s: CategoriaComunidad = seccion && seccion !== 'anuncios' ? seccion : 'general', titulo?: string) {
    conNombre(() => setEscribiendo({ seccion: s, titulo, clave: Date.now() }))
  }

  async function publicar(e: Escrito, s: CategoriaComunidad) {
    const p = await api<PublicacionComunidad>('/api/comunidad/publicar', { categoria: s, ...e })
    setEscribiendo(null)
    setFeed((f) => f && { ...f, yo: { ...f.yo, publicaciones: f.yo.publicaciones + 1 } })
    // Entra después de lo fijado, si es de la sección que ves; si no, cambia a la suya.
    if (seccion && seccion !== s) return setSeccion(s), setLista(null), setNueva(p.id)
    setLista((l) => {
      const fijadas = (l ?? []).filter((x) => x.fijada)
      return [...fijadas, p, ...(l ?? []).filter((x) => !x.fijada)]
    })
    setNueva(p.id)
  }

  const actualizar = (p: PublicacionComunidad) => setLista((l) => l?.map((x) => (x.id === p.id ? p : x)) ?? l)

  async function megusta(p: PublicacionComunidad): Promise<PublicacionComunidad> {
    const antes = p
    const optimista = { ...p, megusta: !p.megusta, likes: p.likes + (p.megusta ? -1 : 1) }
    actualizar(optimista)
    try {
      const r = await api<{ likes: number; megusta: boolean }>(`/api/comunidad/p/${p.id}/megusta`, {})
      const listo = { ...optimista, ...r }
      actualizar(listo)
      return listo
    } catch (e) {
      actualizar(antes)
      setError(e instanceof Error ? e.message : String(e))
      return antes
    }
  }

  function visto(id: string) {
    setVistas((v) => {
      const nuevas = Object.fromEntries([...Object.entries({ ...v, [id]: new Date().toISOString() })].sort((a, b) => b[1].localeCompare(a[1])).slice(0, 400))
      localStorage.setItem(VISTAS, JSON.stringify(nuevas))
      return nuevas
    })
  }

  // Soltar una captura en cualquier parte la lleva al compositor (y lo abre).
  const sirve = (e: DragEvent) => e.dataTransfer.types.includes('Files') && !abierta && !perfil
  const soltar = {
    onDragOver: (e: DragEvent) => {
      if (!sirve(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setArrastrando(true)
      if (!escribiendo && yo?.nombre) abrirCompositor()
    },
    onDragLeave: (e: DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setArrastrando(false),
    onDrop: (e: DragEvent) => {
      setArrastrando(false)
      if (e.isDefaultPrevented() || !sirve(e)) return
      e.preventDefault()
      subirAlCompositor.current?.([...e.dataTransfer.files])
    },
  }

  const caras = [...new Map((lista ?? []).flatMap((p) => [p.autor, ...p.comentaron]).filter((a) => a.nombre).map((a) => [a.id, a])).values()].slice(0, 8)
  const escribe = escribiendo && seccionDe(escribiendo.seccion)

  return (
    <div className="com" {...soltar}>
      <div className="com-rejilla">
        <main className="com-centro">
          <header className="com-cabeza">
            <div>
              <h1>Comunidad</h1>
            </div>
            {feed && <Avisos sinLeer={feed.avisos} onAbrir={setAbierta} onLeidos={() => setFeed((f) => f && { ...f, avisos: 0 })} />}
          </header>

          {yo?.creador && <Liberar onAnunciar={(v) => abrirCompositor('anuncios', `Hermit ${v} ya es para todos`)} />}

          {escribiendo && escribe ? (
            <div className="com-nueva">
              <div className="com-nueva-cabeza">
                <Cara autor={yo} />
                <span>
                  <strong>{yo?.nombre || 'Tú'}</strong> publica en <span className="com-nueva-seccion">{escribe.nombre}</span>
                </span>
              </div>
              <Escribir
                key={escribiendo.clave}
                conTitulo
                conVideo
                ayuda={escribiendo.seccion === 'mejoras' || escribiendo.seccion === 'ayuda'}
                inicial={{ titulo: escribiendo.titulo }}
                videoCompartido={escribiendo.video}
                placeholder={escribe.escribe}
                accion="Publicar"
                autoFocus
                subir={subirAlCompositor}
                soltando={arrastrando}
                extra={<ElegirSeccion valor={escribiendo.seccion} creador={!!yo?.creador} onCambio={(s) => setEscribiendo((x) => x && { ...x, seccion: s })} />}
                onListo={(e) => publicar(e, escribiendo.seccion)}
                onCancelar={() => setEscribiendo(null)}
              />
            </div>
          ) : (
            <button className="com-escribe" disabled={!feed} onClick={() => abrirCompositor()}>
              <Cara autor={yo} />
              <span>Escribe algo</span>
            </button>
          )}

          <nav className="com-secciones" aria-label="Secciones">
            <button className={seccion === '' ? 'on' : ''} onClick={() => seccion !== '' && (setLista(null), setSeccion(''))}>
              Todo
            </button>
            {SECCIONES.map((s) => (
              <button key={s.id} className={seccion === s.id ? 'on' : ''} onClick={() => seccion !== s.id && (setLista(null), setSeccion(s.id))}>
                <Icono de={s.icono} />
                {s.nombre}
              </button>
            ))}
          </nav>

          {yo && (
            <Bienvenida
              yo={yo}
              onNombre={() => setPerfil({})}
              onPresentarse={() => abrirCompositor('general', '¡Hola! Soy…')}
              onComentar={() => (setLista(null), setSeccion('hice'))}
            />
          )}

          {sinCuenta && <Unirse onListo={() => void cargar()} />}
          {error && !sinCuenta && (
            <div className="com-error">
              {error}
              <button onClick={() => void cargar()}>Reintentar</button>
            </div>
          )}
          {lista === null && !error && <div className="com-cargando">Cargando…</div>}
          {lista?.length === 0 && (
            <div className="com-vacio">
              <div className="com-vacio-logo">
                <img src="/icon.svg" alt="" />
              </div>
              <strong>{seccion ? `Aún no hay nada en ${seccionDe(seccion).nombre}` : 'Aún no hay nada aquí'}</strong>
              <p>{seccion === 'anuncios' ? 'Lo nuevo de Hermit saldrá aquí.' : 'Sé el primero: preséntate o comparte un video que hiciste con Hermit.'}</p>
            </div>
          )}

          {!!lista?.length && (
            <div className="com-feed">
              {lista.map((p) => (
                <Tarjeta
                  key={p.id}
                  p={p}
                  yo={yo}
                  nueva={nueva === p.id}
                  visto={vistas[p.id]}
                  onAbrir={() => setAbierta(p.id)}
                  onMegusta={() => conNombre(() => void megusta(p))}
                />
              ))}
              {mas && (
                <button className="com-mas" disabled={cargandoMas} onClick={() => void verMas()}>
                  {cargandoMas ? 'Cargando…' : 'Ver más'}
                </button>
              )}
            </div>
          )}
        </main>

        <aside className="com-lado">
          <div className="com-comunidad">
            <div className="com-comunidad-cabeza">
              <img src="/icon.svg" alt="" />
              <div className="com-comunidad-id">
                <h2>Comunidad Hermit</h2>
                <p>Comparte, pregunta y pide lo que le falta.</p>
              </div>
            </div>
            <div className="com-comunidad-pie">
              <span className="com-stats">
                <span><b>{feed ? feed.miembros.toLocaleString('es-MX') : '–'}</b> miembros</span>
                <span><b>{feed ? feed.activos.toLocaleString('es-MX') : '–'}</b> activos hoy</span>
                <span><b>1</b> creador</span>
              </span>
              <span className="com-comunidad-acciones">
                {caras.length > 0 && (
                  <span className="com-caras">
                    {caras.map((a) => (
                      <Cara key={a.id} autor={a} tam="chica" />
                    ))}
                  </span>
                )}
                <button className="com-perfil" disabled={!yo} onClick={() => setPerfil({})}>
                  <Cara autor={yo} tam="chica" />
                  {yo?.nombre ? 'Tu perfil' : 'Ponte tu nombre'}
                </button>
              </span>
            </div>
          </div>
          {feed && <Votar roadmap={feed.roadmap} fundador={feed.yo.insignia === 'fundador'} onVoto={(roadmap) => setFeed((f) => f && { ...f, roadmap })} />}
        </aside>
      </div>

      {abierta && yo && (
        <Abierta
          id={abierta}
          previa={lista?.find((p) => p.id === abierta)}
          yo={yo}
          onCambio={actualizar}
          onMegusta={megusta}
          onComento={() => setFeed((f) => f && { ...f, yo: { ...f.yo, comentarios: f.yo.comentarios + 1 } })}
          onBorrada={() => (setLista((l) => l?.filter((x) => x.id !== abierta) ?? l), setAbierta(null))}
          conNombre={conNombre}
          onCerrar={() => (visto(abierta), setAbierta(null))}
        />
      )}
      {perfil && yo && (
        <Perfil
          yo={yo}
          onListo={(a) => {
            setFeed((f) => f && { ...f, yo: { ...f.yo, ...a } })
            // Tu nombre y tu foto también en lo que ya está a la vista.
            setLista((l) => l?.map((p) => ({ ...p, autor: p.autor.id === a.id ? a : p.autor, comentaron: p.comentaron.map((c) => (c.id === a.id ? a : c)) })) ?? l)
            const luego = perfil.luego
            setPerfil(null)
            luego?.()
          }}
          onCerrar={() => setPerfil(null)}
        />
      )}
    </div>
  )
}
