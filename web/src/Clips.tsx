import { useEffect, useRef, useState } from 'react'
import type { Model, SessionMeta } from '../../shared/types'
import { api } from './api'
import { Icono } from './Iconos'
import { Logo } from './Logos'
import { gruposModelos, Picker } from './Composer'
import { Fila } from './Modelos'
import { ClipsEnVivo } from './ClipsEnVivo'
import './Clips.css'

/**
 * La sección Clips: pegas la URL de un video (propio o con permiso) y un hilo de la card «Clips» se encarga
 * de bajarlo, transcribirlo, proponerte los momentos y cortarlos con `video-clips/scripts/hacer.py`. Cada clip
 * queda en `out/redes/` del proyecto y entra solo a la cola de publicación de redes.
 */

/** El modelo para los hilos de la sección: el último que elegiste, o el primero del catálogo. */
function eleccion(models: Model[]) {
  try {
    const c = JSON.parse(localStorage.getItem('choice') ?? 'null') as { model: string; effort?: string } | null
    const m = models.find((x) => x.id === c?.model)
    if (m) return { model: m.id, effort: c!.effort && m.efforts.includes(c!.effort) ? c!.effort : m.defaultEffort }
  } catch {}
  const m = models[0]
  return m && { model: m.id, effort: m.defaultEffort }
}

/** Un nombre corto y único para el hilo y su carpeta: el id del video de YouTube o el último tramo de la ruta. */
function slugDe(url: string): string {
  try {
    const yt = /(?:youtube\.com\/(?:watch\?[^ ]*v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url)
    if (yt) return yt[1]
    const u = new URL(url)
    const partes = u.pathname.split('/').filter(Boolean)
    const ultimo = (partes.at(-1) ?? u.hostname).replace(/\.[a-z]+$/i, '')
    return ultimo.slice(0, 40) || u.hostname
  } catch {
    return url.slice(0, 40)
  }
}

/** La plataforma de una URL, para enseñarla con su logo mientras escribes. */
function plataforma(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    if (h === 'youtube.com' || h === 'youtu.be' || h.endsWith('.youtube.com')) return 'youtube'
    if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok'
    if (h === 'instagram.com' || h.endsWith('.instagram.com')) return 'instagram'
  } catch {}
  return undefined
}

/** La URL limpia y válida, o `undefined` si aún no sirve. */
function urlValida(url: string): string | undefined {
  const u = url.trim()
  if (!u) return undefined
  try {
    const p = new URL(u)
    return p.protocol === 'https:' || p.protocol === 'http:' ? u : undefined
  } catch {
    return undefined
  }
}

/** Cuánto hace del último movimiento, en corto («hace 2 h»). */
function hace(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

export function Clips(props: { sessions: SessionMeta[]; models: Model[]; onHilo(id: string): void }) {
  // «Video»: el lote de siempre (URL → hilo → el agente corta los mejores momentos). «En vivo»: el live, al momento.
  const [vista, setVista] = useState<'video' | 'en-vivo'>('video')
  const [url, setUrl] = useState('')
  const [permiso, setPermiso] = useState('')
  const [conPermiso, setConPermiso] = useState(false)
  const [formato, setFormato] = useState<'vertical' | 'horizontal'>('vertical')
  const [elegido, setElegido] = useState<{ model: string; effort?: string } | undefined>(() => eleccion(props.models))
  const [error, setError] = useState('')
  const [mandando, setMandando] = useState(false)
  const [agenteOpen, setAgenteOpen] = useState(false)
  const agenteRef = useRef<HTMLDivElement>(null)

  // El menú del agente se cierra al pulsar fuera o con Escape, igual que en «Nuevo chat».
  useEffect(() => {
    if (!agenteOpen) return
    const away = (e: PointerEvent) => !agenteRef.current?.contains(e.target as Node) && setAgenteOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !agenteRef.current?.querySelector('.picker.open') && setAgenteOpen(false)
    addEventListener('pointerdown', away)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', away)
      removeEventListener('keydown', esc)
    }
  }, [agenteOpen])

  const modelo = elegido ?? eleccion(props.models)
  const modelObj = props.models.find((m) => m.id === modelo?.model)

  const hilos = props.sessions
    .filter((s) => s.cardId === 'video-clips' && !s.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  // La validación en vivo: mientras escribes se ve si la URL ya sirve y de qué plataforma es.
  const limpia = url.trim() ? urlValida(url) : undefined
  const red = plataforma(limpia ?? '')
  const tocada = url.length > 0

  async function pegar() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setUrl(t.trim())
    } catch {
      /* sin permiso de portapapeles: se pega a mano */
    }
  }

  async function mandar() {
    const u = urlValida(url)
    if (!u) return setError('Pega la URL del video (https://…).')
    if (!modelo) return setError('No hay ningún agente disponible: elige uno en Opciones → Agentes.')
    setMandando(true)
    setError('')
    try {
      const lineas = [
        `Título: Clips · ${slugDe(u)}`,
        '',
        `Saca clips de este video: ${u}`,
        conPermiso && permiso.trim() && `Permiso: ${permiso.trim()}`,
        `Formato: ${formato}`
      ].filter(Boolean)
      const meta = await api<SessionMeta>('/api/sessions', { cardId: 'video-clips', text: lineas.join('\n'), ...modelo })
      props.onHilo(meta.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setMandando(false)
    }
  }

  return (
    <div className="clips">
      <div className="clips-dentro">
        {/* En «En vivo» no hay cabecera: la pestaña es un espacio de trabajo como el estudio del hilo.
            El botón «Volver» vive dentro del panel de la URL, en su esquina superior derecha. */}
        {vista === 'video' && (
        <header className="clips-head galeria-head">
          <div>
            <h1>Clips</h1>
            <p>Pega la URL de un video y el agente lo corta en clips listos para redes.</p>
          </div>
          <div className="clips-pestanas" role="tablist">
            {(
              [
                { v: 'video', nombre: 'Video' },
                { v: 'en-vivo', nombre: 'En vivo' }
              ] as const
            ).map((t) => (
              <button key={t.v} role="tab" aria-selected={vista === t.v} className={`clips-pestana ${vista === t.v ? 'on' : ''}`} onClick={() => setVista(t.v)}>
                {t.nombre}
              </button>
            ))}
          </div>
        </header>
        )}

        {vista === 'en-vivo' ? (
          <ClipsEnVivo onVolver={() => setVista('video')} />
        ) : (
        <>
        <section className="clips-panel">
          {/* La URL, con su plataforma y el pegado de un toque. */}
          <div className={`clips-url ${tocada && !limpia ? 'mal' : ''} ${limpia ? 'bien' : ''}`}>
            <span className="clips-url-red">
              {red ? <Logo de={red} chico nombre={red} /> : <Icono de="play" />}
            </span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="Pega la URL del video…"
              value={url}
              onChange={(e) => (setUrl(e.target.value), setError(''))}
              onKeyDown={(e) => e.key === 'Enter' && limpia && !mandando && void mandar()}
              disabled={mandando}
              aria-label="URL del video"
              aria-invalid={tocada && !limpia}
            />
            {tocada && limpia && <Icono de="palomita" />}
            <button className="clips-pegar" onClick={() => void pegar()} disabled={mandando} title="Pegar del portapapeles">
              Pegar
            </button>
          </div>
          <p className={`clips-pista ${tocada && !limpia ? 'mal' : ''}`}>
            {tocada && !limpia
              ? 'Esa no parece una URL: empieza por https://'
              : limpia
                ? `Listo: ${new URL(limpia).hostname.replace(/^www\./, '')}`
                : 'YouTube, TikTok, Instagram… o el archivo de tu equipo'}
          </p>

          {/* Tres columnas parejas: formato, agente y permiso en el mismo renglón; el botón va abajo
              a todo lo ancho, como el CTA del live. */}
          <div className="clips-opciones">
            <div className="clips-grupo">
              <span className="clips-grupo-titulo">Formato</span>
              <div className="clips-formato" role="radiogroup" aria-label="Formato">
                {(
                  [
                    { v: 'vertical', ico: 'vertical', nombre: 'Vertical', detalle: 'TikTok · Reels · Shorts' },
                    { v: 'horizontal', ico: 'horizontal', nombre: 'Horizontal', detalle: 'YouTube' }
                  ] as const
                ).map((f) => (
                  <button
                    key={f.v}
                    role="radio"
                    aria-checked={formato === f.v}
                    className={`clips-formato-op ${formato === f.v ? 'on' : ''}`}
                    onClick={() => setFormato(f.v)}
                    disabled={mandando}
                  >
                    <Icono de={f.ico} />
                    <span>
                      <b>{f.nombre}</b>
                      <small>{f.detalle}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="clips-grupo">
              <span className="clips-grupo-titulo">Agente</span>
                <div ref={agenteRef} className={`picker modelos-selector clips-agente${agenteOpen ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="picker-trigger"
                    disabled={mandando || !props.models.length}
                    onClick={() => setAgenteOpen(!agenteOpen)}
                  >
                    {modelObj?.label ?? modelo?.model ?? 'Modelo'}
                    {modelo?.effort ? ` · ${modelo.effort}` : ''}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {agenteOpen && (
                    <div className="picker-menu modelos-menu">
                      <div className="modelos-filas">
                        <Fila nombre="Hilo principal" para="Lo que escribe, decide y arma">
                          <Picker
                            className="modelos-selector"
                            menuClassName="modelos-lista"
                            flotante
                            label={modelObj?.label ?? modelo?.model ?? 'Modelo'}
                            value={modelo?.model ?? ''}
                            groups={gruposModelos(props.models)}
                            onChange={(id) => {
                              const m = props.models.find((x) => x.id === id)
                              if (!m) return
                              const c = { model: m.id, effort: m.efforts.includes(modelo?.effort ?? '') ? modelo?.effort : m.defaultEffort }
                              setElegido(c)
                              try {
                                localStorage.setItem('choice', JSON.stringify(c))
                              } catch {}
                            }}
                          />
                          <Picker
                            className="modelos-selector"
                            menuClassName="modelos-lista"
                            menuWidth={160}
                            flotante
                            label={modelo?.effort ?? 'Esfuerzo'}
                            value={modelo?.effort ?? ''}
                            disabled={!modelObj?.efforts.length}
                            groups={[{ label: 'Esfuerzo', options: (modelObj?.efforts ?? []).map((e) => ({ value: e, label: e })) }]}
                            onChange={(effort) => {
                              if (!modelo) return
                              const c = { ...modelo, effort }
                              setElegido(c)
                              try {
                                localStorage.setItem('choice', JSON.stringify(c))
                              } catch {}
                            }}
                          />
                        </Fila>
                      </div>
                      <p className="modelos-nota muted small">
                        El hilo de clips va en el modelo y esfuerzo que elijas aquí; queda guardado como tu elección para las demás cards.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* El permiso es la tercera columna del mismo renglón: solo si hace falta decirlo. */}
              <div className="clips-permiso">
                <span className="clips-grupo-titulo">Permiso</span>
                <button
                  className={`clips-permiso-toggle ${conPermiso ? 'on' : ''}`}
                  onClick={() => setConPermiso(!conPermiso)}
                  disabled={mandando}
                  aria-expanded={conPermiso}
                >
                  <Icono de="bandera" />
                  Tengo permiso o es mi video
                  <Icono de={conPermiso ? 'cerrar' : 'mas'} />
                </button>
                {conPermiso && (
                  <input
                    type="text"
                    placeholder="¿De quién es y por qué puedes usarlo?"
                    value={permiso}
                    onChange={(e) => setPermiso(e.target.value)}
                    disabled={mandando}
                    autoFocus
                  />
                )}
              </div>
            </div>

          <div className="clips-acciones">
            {error && <p className="bad small">{error}</p>}
            <button className="clips-mandar" onClick={() => void mandar()} disabled={mandando || !limpia}>
              {mandando ? 'Abriendo…' : 'Hacer clips'}
              {!mandando && <Icono de="flecha" />}
            </button>
          </div>
        </section>

        {hilos.length > 0 && (
          <section className="clips-hilos">
            <div className="clips-hilos-titulo">Tus clips</div>
            {hilos.map((s) => (
              <button key={s.id} className="clips-hilo" onClick={() => props.onHilo(s.id)}>
                <Icono de="tramo" />
                <span className="clips-hilo-titulo">{s.title}</span>
                <span className={`muted small ${s.running ? 'trabajando' : ''}`}>
                  {s.running ? 'trabajando' : hace(s.updatedAt)}
                </span>
                <Icono de="flecha" />
              </button>
            ))}
          </section>
        )}
        </>
        )}
      </div>
    </div>
  )
}
