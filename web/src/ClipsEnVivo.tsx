import { Fragment, type CSSProperties, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import { NAVEGADOR_CLIPS, type VivoClip, type VivoEstado, type VivoSegmento } from '../../shared/types'
import { api, ErrorApi } from './api'
import { Icono } from './Iconos'
import { Logo } from './Logos'
import { ACENTOS_CLIP } from '../../shared/clips'
import { abrirNavegador, hayNavegador, PanelNavegador, useNavegadorAbierto, verEnNavegador } from './Navegador'

/**
 * La sección «En vivo» de Clips: pegas la URL de una emisión y Hermit la graba en un buffer circular de ~10
 * minutos, la transcribe trozo a trozo (Whisper/Parakeet del Python de Hermit) y deja cortar los últimos
 * segundos en vertical u horizontal con el mismo `hacer.py` de los clips por lote: subtítulos karaoke,
 * portada y -14 LUFS, todo local. El estado llega por `/api/en-vivo` y los avisos `hermit-envivo*` del
 * WebSocket; los clips caen en `out/redes/` del proyecto y entran a «Mis videos».
 */

/** Lo que devuelve `GET /api/en-vivo`: el estado público más la transcripción entera. */
type VivoCompleto = VivoEstado & { texto: VivoSegmento[] }

const FORMATOS = [
  { v: 'vertical', ico: 'vertical', nombre: 'Vertical', detalle: 'TikTok · Reels · Shorts' },
  { v: 'horizontal', ico: 'horizontal', nombre: 'Horizontal', detalle: 'YouTube' }
] as const

const SUBTITULOS = [
  { v: 'minimal', nombre: 'Minimal' },
  { v: 'top', nombre: 'Top' },
  { v: 'archivo', nombre: 'Archivo' },
  { v: 'varela', nombre: 'Varela' },
  { v: 'crimen', nombre: 'Crimen' },
  { v: 'ninguno', nombre: 'Ninguno' }
] as const

// «Sin acento» no va en la paleta: es la opción de que el clip salga sin golpe de color.
const ACENTOS = [{ v: '', nombre: 'Sin acento', hex: 'transparent' }, ...ACENTOS_CLIP.map((a) => ({ v: a.nombre, nombre: a.nombre[0].toUpperCase() + a.nombre.slice(1), hex: a.hex }))]

// El acento que cada estilo de subtítulo usa por defecto cuando no se elige uno: los `acento` de
// subtitulos.py, centralizados como tokens en tokens.css. La maqueta pinta la palabra activa con ese
// mismo color, no con negro.
const ACENTO_POR_ESTILO: Record<string, string> = {
  minimal: 'var(--sub-acento-minimal)',
  archivo: 'var(--sub-acento-archivo)',
  varela: 'var(--sub-acento-varela)',
  crimen: 'var(--sub-acento-crimen)',
  top: 'var(--sub-acento-top)'
}

const REENCUADRES = [
  { v: 'auto', nombre: 'Automático' },
  { v: 'centrado', nombre: 'Centrado' },
  { v: 'difuminado', nombre: 'Pantalla completa' },
  { v: 'persona', nombre: 'Quien habla' }
] as const

const DURACIONES = [15, 30, 45, 60, 90]

// Las plataformas con live que yt-dlp lee de forma habitual; el resto entra por la misma puerta si el extractor lo sabe.
const PLATAFORMAS = [
  { id: 'youtube', nombre: 'YouTube', prueba: /(?:youtube\.com|youtu\.be)/i },
  { id: 'twitch', nombre: 'Twitch', prueba: /twitch\.tv/i },
  { id: 'kick', nombre: 'Kick', prueba: /kick\.com/i },
  { id: 'tiktok', nombre: 'TikTok', prueba: /tiktok\.com/i },
  { id: 'facebook', nombre: 'Facebook', prueba: /facebook\.com|fb\.watch/i }
] as const

/** La plataforma de una URL de live, para el logo junto al título. */
const plataformaDe = (url: string) => PLATAFORMAS.find((p) => p.prueba.test(url))

/** `m:ss` para las marcas de la transcripción. */
const marca = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

type StreamLive = NonNullable<VivoEstado['stream']>

/**
 * Conecta un <video> al m3u8 del live: hls.js en Chromium, HLS nativo en Safari. Lo usan el reproductor
 * grande y la maqueta del clip (que muestra el mismo directo, en pequeño y sin sonido). Devuelve el
 * destructor para el efecto.
 */
function adjuntarLive(v: HTMLVideoElement, stream: StreamLive): (() => void) | undefined {
  if (Hls.isSupported()) {
    const h = new Hls({ liveSyncDurationCount: 3 })
    const headers = stream.headers
    if (headers && Object.keys(headers).length) {
      // Solo las que el navegador deja poner: User-Agent, Sec-*, Cookie y demás del navegador son intocables.
      const PROHIBIDAS = /^(user-agent|sec-|host|cookie|origin|referer|connection|content-|accept-charset|accept-encoding|dnt|expect|keep-alive|te$|trailer|transfer-encoding|upgrade|via|proxy-)/i
      const puestas = Object.entries(headers).filter(([k]) => !PROHIBIDAS.test(k))
      if (puestas.length) {
        h.config.xhrSetup = (xhr) => {
          for (const [k, val] of puestas) xhr.setRequestHeader(k, val)
        }
      }
    }
    h.loadSource(stream.url)
    h.attachMedia(v)
    return () => h.destroy()
  }
  if (v.canPlayType('application/vnd.apple.mpegurl')) {
    v.src = stream.url
    return () => v.removeAttribute('src')
  }
}

/**
 * Pinta el frame del directo en el lienzo de la maqueta, con el reencuadre que hará el render al cortar:
 * la ventana con la proporción del formato dentro de la fuente (la misma cuenta que `ventana()` de
 * `encuadre.py`), centrada en `centrado`/`auto` y siguiendo la fracción de `pos` en `persona` (0–1 del
 * recorrido, como la devuelve `/api/en-vivo/cara`). `difuminado` se dibuja como el render: el cuadro
 * entero nítido al 42 % del alto sobre su copia a cover desenfocada (~1,4 % del ancho, boxblur=24
 * proporcional). `directo` (el live ya tiene la proporción) sale entero, contain.
 */
function pintarCuadro(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, w: number, h: number, modo: string, pos?: { x: number; y: number }) {
  const vw = v.videoWidth
  const vh = v.videoHeight
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (modo === 'difuminado') {
    const s = Math.max(w / vw, h / vh)
    const dw = vw * s
    const dh = vh * s
    ctx.save()
    ctx.filter = `blur(${w * 0.014}px)`
    ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh)
    ctx.restore()
    const sc = w / vw
    const fw = vw * sc
    const fh = vh * sc
    ctx.drawImage(v, (w - fw) / 2, (h - fh) * 0.42, fw, fh)
    return
  }
  if (modo === 'directo') {
    const s = Math.min(w / vw, h / vh)
    const dw = vw * s
    const dh = vh * s
    ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh)
    return
  }
  // La ventana del formato dentro de la fuente: más ancha → recorta X; más alta → recorta Y.
  const aspecto = w / h
  let sx = 0
  let sy = 0
  let sw = vw
  let sh = vh
  if (vw / vh > aspecto) {
    sw = vh * aspecto
    sx = (vw - sw) * (pos?.x ?? 0.5)
  } else {
    sh = vw / aspecto
    sy = (vh - sh) * (pos?.y ?? 0.5)
  }
  ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h)
}

/**
 * La maqueta del clip que va a salir: proporción del formato elegido, la palabra activa del subtítulo en el
 * acento y la portada si la hay. El video es un espejo del reproductor de la columna 1 — el mismo frame en
 * el mismo instante, pintado en un canvas con el reencuadre del modo elegido; subtítulos y portada son
 * overlays encima, cambian al instante con cada opción.
 */
function VistaClip({
  formato,
  subtitulos,
  acento,
  portadaTitulo,
  portadaResaltar,
  gancho,
  ratio,
  palabras,
  stream,
  listo,
  cargando,
  video,
  reencuadre
}: {
  formato: 'vertical' | 'horizontal'
  subtitulos: string
  acento: string
  portadaTitulo: string
  portadaResaltar: string
  gancho: string
  /** Proporción real del live (ancho/alto); 0 si aún no se sabe. */
  ratio: number
  /** Las últimas palabras del live, para que la maqueta subtitule con lo que se está diciendo de verdad. */
  palabras: string[]
  /** Hay stream del buffer: la maqueta refleja el video; null = hueso de carga. */
  stream: StreamLive | null
  /** El video de la columna 1 ya pintó su primer frame: hasta entonces la maqueta es hueso. */
  listo: boolean
  /** El directo está llegando de verdad (conectando o esperando su primer frame/segmento): solo ahí la
      maqueta muestra el hueso con brillo; sin live es un marco quieto que invita a conectar. */
  cargando: boolean
  /** El <video> del reproductor principal: la maqueta pinta sus mismos frames, ni una descarga de más. */
  video: RefObject<HTMLVideoElement | null>
  /** El reencuadre elegido: la maqueta lo simula con la misma ventana de crop que hará el render. */
  reencuadre: string
}) {
  const acentoHex = ACENTOS.find((a) => a.v === acento)?.hex
  const acentoColor = acentoHex && acentoHex !== 'transparent' ? acentoHex : undefined
  // La palabra activa: el acento elegido, o el que el estilo trae por defecto (como en subtitulos.py).
  const colorMarca = acentoColor ?? ACENTO_POR_ESTILO[subtitulos] ?? 'var(--text)'
  const vertical = formato === 'vertical'
  // El vivo ya es del formato pedido: sale sin reencuadre; si no, el clip lo reencuadra.
  const directo = ratio > 0 && (vertical ? ratio < 1 : ratio > 1)
  // La imagen es un espejo del video de la columna 1: cada frame se pinta en el canvas — el mismo
  // instante, sin segunda descarga del stream ni deriva entre dos hls.js. El reencuadre se dibuja con
  // la ventana de crop del render: centrado, siguiendo a quien habla o cuadro completo desenfocado.
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // La posición del crop «quien habla» (0–1 del recorrido), la que mide el servidor sobre el buffer.
  const posCara = useRef({ x: 0.5, y: 0.5 })
  useEffect(() => {
    if (reencuadre !== 'persona' || directo || !stream) return
    let vivo = true
    const preguntar = async () => {
      try {
        const r = await fetch(`/api/en-vivo/cara?formato=${formato}`)
        const d = (await r.json()) as { x?: number; y?: number }
        if (vivo && typeof d?.x === 'number') posCara.current = { x: d.x, y: typeof d.y === 'number' ? d.y : 0.5 }
      } catch {
        /* el live puede estar reiniciando el buffer: se vuelve a preguntar en el siguiente turno */
      }
    }
    void preguntar()
    const t = setInterval(() => void preguntar(), 2500)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [reencuadre, formato, directo, stream])
  useEffect(() => {
    const cv = canvasRef.current
    const v = video.current
    if (!cv || !v) return
    let raf = 0
    const pintar = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = cv.clientWidth
      const h = cv.clientHeight
      if (w > 0 && h > 0 && (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr))) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      const ctx = cv.getContext('2d')
      if (ctx && v.readyState >= 2 && v.videoWidth > 0 && cv.width > 0) {
        pintarCuadro(ctx, v, cv.width, cv.height, directo ? 'directo' : reencuadre, posCara.current)
      }
      raf = requestAnimationFrame(pintar)
    }
    raf = requestAnimationFrame(pintar)
    return () => cancelAnimationFrame(raf)
  }, [video, stream, listo, reencuadre, directo]) // eslint-disable-line react-hooks/exhaustive-deps
  const titulo = portadaTitulo.trim()
  const resaltar = portadaResaltar.trim()
  // La palabra «que se está diciendo» avanza sola por las palabras reales, como el karaoke del clip.
  const [activa, setActiva] = useState(0)
  useEffect(() => {
    setActiva(0)
    if (palabras.length < 2) return
    const t = setInterval(() => setActiva((a) => (a + 1) % palabras.length), 420)
    return () => clearInterval(t)
  }, [palabras])
  return (
    <div className="envivo-vista-campo">
      <span className="clips-grupo-titulo">Así quedará el clip</span>
      <div className={`envivo-vista ${vertical ? 'v' : 'h'} re-${reencuadre}`} style={acentoColor ? ({ '--acento': acentoColor } as CSSProperties) : undefined}>
        <div className="envivo-vista-fondo" />
        {/* La maqueta vacía solo cuando NO hay live: el marco queda quieto con su texto, sin brillo de
            «cargando» — el hueso es para cuando el directo sí está llegando. */}
        {(!stream || !listo) &&
          (cargando ? (
            <div className="envivo-vista-hueso" aria-hidden="true" />
          ) : (
            <div className="envivo-vista-vacia">
              <Icono de="video" />
              <p className="muted small">Conecta un live para ver la previa del clip.</p>
            </div>
          ))}
        {/* La imagen es el mismo frame del video de la izquierda, pintado en canvas: ni una descarga extra. */}
        {stream && <canvas ref={canvasRef} className="envivo-vista-lienzo" />}
        {stream && titulo && (
          <div className="envivo-vista-portada">
            <b>
              {resaltar
                ? titulo.split(new RegExp(`(${resaltar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i')).map((p, i) =>
                    p.toLowerCase() === resaltar.toLowerCase() ? <mark key={i}>{p}</mark> : p
                  )
                : titulo}
            </b>
            {gancho.trim() && <span>{gancho.trim()}</span>}
          </div>
        )}
        {stream && subtitulos !== 'ninguno' && (
          <p className={`envivo-vista-sub ${subtitulos}`}>
            {palabras.length ? (
              // Las palabras reales del live: la activa (la que «se dice») va en el acento, como el karaoke.
              palabras.map((w, i) => (
                <Fragment key={`${i}-${w}`}>
                  {i > 0 && ' '}
                  {i === activa ? <mark style={{ color: colorMarca }}>{w}</mark> : w}
                </Fragment>
              ))
            ) : (
              <>Mira cómo <mark style={{ color: colorMarca }}>quedan</mark> las palabras</>
            )}
          </p>
        )}
        <span className="envivo-vista-corner">{vertical ? '9:16' : '16:9'}</span>
      </div>
      <p className="muted small envivo-vista-pista">
        {ratio > 0
          ? directo
            ? 'El live ya tiene esta proporción: sale directo, sin reencuadre.'
            : reencuadre === 'persona'
              ? 'El clip seguirá a quien habla; la previa hace lo mismo sobre el live.'
              : reencuadre === 'auto'
                ? 'El clip elige el mejor encuadre solo al renderizar; la previa muestra el centrado.'
                : reencuadre === 'difuminado'
                  ? 'El clip muestra el video entero sobre el fondo desenfocado.'
                  : `El live es ${ratio < 1 ? 'vertical' : 'horizontal'}: el clip se reencuadra a ${vertical ? '9:16' : '16:9'}.`
          : `Vertical ${vertical ? '' : 'u horizontal '}según elijas: el clip sale en ${vertical ? '9:16' : '16:9'}.`}
      </p>
    </div>
  )
}

/** El nombre del archivo de un clip listo, para su `<video>` (por `/api/piezas/archivo`, el mismo de las piezas). */
const srcDe = (clip: VivoClip) => (clip.archivo ? `/api/piezas/archivo?ruta=${encodeURIComponent(clip.archivo)}` : undefined)

export function ClipsEnVivo({ onVolver }: { onVolver(): void }) {
  const [vivo, setVivo] = useState<VivoCompleto | null>(null)
  const [texto, setTexto] = useState<VivoSegmento[]>([])
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [conectando, setConectando] = useState(false)
  const [aviso, setAviso] = useState('')
  // El clip que se está viendo en grande (el mismo lightbox de «Mis videos»).
  const [viendo, setViendo] = useState<string | null>(null)

  // Las opciones del clip: se aplican al render, no hace falta agente para cambiarlas en vivo.
  const [segundos, setSegundos] = useState(30)
  const [formato, setFormato] = useState<'vertical' | 'horizontal'>('vertical')
  const [subtitulos, setSubtitulos] = useState('minimal')
  const [acento, setAcento] = useState('')
  const [extras, setExtras] = useState(false)
  const [portadaTitulo, setPortadaTitulo] = useState('')
  const [gancho, setGancho] = useState('')
  const [portadaResaltar, setPortadaResaltar] = useState('')
  const [reencuadre, setReencuadre] = useState('auto')

  const videoRef = useRef<HTMLVideoElement>(null)
  const textoRef = useRef<HTMLDivElement>(null)
  const alFinal = useRef(true)
  // El directo arranca silenciado (autoplay lo exige); un clic en el video o en la píldora le da sonido.
  const [sonado, setSonado] = useState(false)
  // El video tarda en pintar el primer frame (playlist local o stream externo): mientras, un hueso encima.
  const [videoListo, setVideoListo] = useState(false)
  // La proporción real del directo (ancho/alto): el marco del preview y la maqueta del clip la usan.
  const [ratio, setRatio] = useState(0)
  // El navegador de la app con el live abierto (para investigarlo sin salir de Hermit); va en la columna 1.
  const navAbierto = useNavegadorAbierto(NAVEGADOR_CLIPS)
  const alternarNavegador = () => {
    if (navAbierto) abrirNavegador(NAVEGADOR_CLIPS, false)
    else if (vivo?.url) verEnNavegador(NAVEGADOR_CLIPS, vivo.url)
  }
  const alternarSonido = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setSonado(!v.muted)
  }

  // El estado al abrir la página (si ya había un live del servidor) y los avisos del WebSocket.
  useEffect(() => {
    api<{ vivo: VivoCompleto | null }>('/api/en-vivo')
      .then((r) => {
        setVivo(r.vivo)
        setTexto(r.vivo?.texto ?? [])
      })
      .catch(() => {})
    const alVivo = (e: Event) => {
      const v = (e as CustomEvent<VivoEstado | null>).detail
      // Live cerrado: la mesa vuelve a su estado vacío — la transcripción y la proporción no quedan de antes.
      if (!v) {
        setVivo(null)
        setTexto([])
        setRatio(0)
        return
      }
      setVivo((antes) => {
        // El estado no trae la transcripción: se conserva la que ya se tiene.
        return { ...v, texto: antes?.texto ?? texto }
      })
    }
    const alTexto = (e: Event) => {
      const p = (e as CustomEvent<{ desde: number; segmentos: VivoSegmento[] }>).detail
      setTexto((t) => {
        if (p.desde > t.length) return t // un hueco: se resincroniza con el próximo GET
        return [...t.slice(0, p.desde), ...p.segmentos]
      })
    }
    addEventListener('hermit-envivo', alVivo)
    addEventListener('hermit-envivo-texto', alTexto)
    return () => {
      removeEventListener('hermit-envivo', alVivo)
      removeEventListener('hermit-envivo-texto', alTexto)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // La transcripción hace scroll sola mientras se mira el final; si subes a leer, deja de arrastrar.
  useEffect(() => {
    const el = textoRef.current
    if (el && alFinal.current) el.scrollTop = el.scrollHeight
  }, [texto])

  const alBajar = () => {
    const el = textoRef.current
    alFinal.current = !!el && el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  // La vista previa: el m3u8 del live con hls.js (Chromium no reproduce HLS solo); en Safari, nativo.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !vivo?.stream) return
    setVideoListo(false)
    setRatio(0)
    return adjuntarLive(v, vivo.stream)
  }, [vivo?.stream?.url]) // eslint-disable-line react-hooks/exhaustive-deps

  // Con el navegador de la app encima, el directo se pausa (la grabación del servidor sigue): al volver
  // retoma donde quedó sin recargar el stream.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (navAbierto) v.pause()
    else if (vivo?.stream && v.paused) void v.play().catch(() => {})
  }, [navAbierto, vivo?.stream]) // eslint-disable-line react-hooks/exhaustive-deps

  async function conectar() {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) return setError('Pega la URL del live (https://…).')
    setConectando(true)
    setError('')
    setAviso('')
    try {
      const v = await api<VivoEstado>('/api/en-vivo', { url: u })
      setVivo({ ...v, texto: [] })
      setTexto([])
      setUrl('')
    } catch (e) {
      // El live pide sesión (Facebook): se fue a Opciones → Redes, donde está el navegador para entrar;
      // la señal la retoma la fila de Facebook al montar. En Edge la ventana ya se abrió sola.
      const datos = e instanceof ErrorApi ? e.datos : undefined
      if (datos?.navegador === 'redes' && datos.enLaApp) {
        sessionStorage.setItem('hermit-fb-login', '1')
        location.hash = '/opciones/redes'
      }
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setConectando(false)
    }
  }

  async function cerrar() {
    try {
      await api('/api/en-vivo/cerrar', {})
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function hacerClip() {
    if (!vivo || vivo.estado === 'cerrado') return
    setError('')
    setAviso('')
    try {
      await api('/api/en-vivo/clip', {
        segundos,
        formato,
        subtitulos,
        acento: acento || undefined,
        portadaTitulo: portadaTitulo || undefined,
        gancho: gancho || undefined,
        portadaResaltar: portadaResaltar || undefined,
        reencuadre
      })
      setAviso(`Cortando los últimos ${segundos} s: el clip sale en cuanto el render acaba.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // La tecla C hace el clip con las opciones puestas, como un atajo de directo.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key.toLowerCase() !== 'c' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return
      if (vivo && (vivo.estado === 'en-vivo' || vivo.estado === 'conectando' || vivo.estado === 'terminado')) void hacerClip()
    }
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vivo, segundos, formato, subtitulos, acento, portadaTitulo, gancho, portadaResaltar, reencuadre])

  const enMarcha = vivo && vivo.estado !== 'cerrado' && vivo.estado !== 'error'
  // La proporción del marco: la real del directo si ya se sabe; si no, la que suele dar cada plataforma.
  const arDirecto = vivo?.stream ? ratio || (plataformaDe(vivo.url)?.id === 'tiktok' ? 9 / 16 : 16 / 9) : 0
  // Las últimas palabras del segmento más reciente de la transcripción: la maqueta subtitula con lo que
  // el live está diciendo ahora mismo, no con un texto de ejemplo.
  const palabrasClip = useMemo(() => (texto.at(-1)?.text ?? '').split(/\s+/).filter(Boolean).slice(-7), [texto])

  return (
    <div className="envivo">
      {navAbierto && !vivo?.stream ? (
        // Buscando directos sin live (o un live sin preview): el navegador ocupa todo el área; al
        // cerrarlo vuelven el formulario y la mesa. Con live y preview, va como overlay sobre el video.
        <section className="clips-panel envivo-entrar-nav">
          <div className="envivo-nav-barra">
            <span className="clips-grupo-titulo">Buscando directos</span>
            <button type="button" className="envivo-nav-cerrar" onClick={() => abrirNavegador(NAVEGADOR_CLIPS, false)}>
              <Icono de="cerrar" /> Volver
            </button>
          </div>
          <PanelNavegador hilo={NAVEGADOR_CLIPS} trabajando={false} />
        </section>
      ) : (
        <>
          <section className="clips-panel envivo-entrar">
            <p className="envivo-nota">
              Pega el enlace de un directo de TikTok, YouTube, Twitch o Kick: Hermit lo graba y te deja sacar clips al momento.
            </p>
            <div className={`clips-url ${url.trim() && !/^https?:\/\//i.test(url.trim()) ? 'mal' : ''}`}>
              <span className="clips-url-red">
                {/* La plataforma se reconoce sola al pegar el enlace: su logo ocupa el lugar del play. */}
                {plataformaDe(url) ? <Logo de={plataformaDe(url)!.id} chico /> : <Icono de="play" />}
              </span>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="Pega la URL del live…"
                value={url}
                onChange={(e) => (setUrl(e.target.value), setError(''))}
                onKeyDown={(e) => e.key === 'Enter' && url.trim() && !conectando && void conectar()}
                disabled={conectando}
                aria-label="URL del live"
              />
              {/* El navegador de la app para buscar el live sin salir de Hermit (solo en Electron): en la
                  misma fila, a la derecha de Conectar — una sola línea que aprovecha todo el ancho. */}
              {hayNavegador && (
                <button
                  type="button"
                  className={`envivo-buscar${navAbierto ? ' on' : ''}`}
                  onClick={() => abrirNavegador(NAVEGADOR_CLIPS, !navAbierto)}
                >
                  <Icono de="globo" /> {navAbierto ? 'Cerrar' : 'Buscar'}
                </button>
              )}
              <button className={`clips-pegar envivo-conectar${conectando ? ' on' : ''}`} onClick={() => void conectar()} disabled={conectando || !url.trim()}>
                {conectando && <i className="envivo-espera" aria-hidden />}
                {conectando ? 'Conectando…' : 'Conectar'}
              </button>
            </div>
            {error && <p className="bad small">{error}</p>}
            {/* La fila de plataformas lleva a la derecha la vuelta a la pestaña «Video»: usa el espacio
                que la fila ya tiene, sin fila extra ni esquina que pise el formulario. */}
            <div className="envivo-plataformas">
              <span className="envivo-plataformas-grupo">
                {PLATAFORMAS.map((p) => (
                  <span key={p.id} className="envivo-plataforma" title={p.nombre}>
                    <Logo de={p.id} chico /> {p.nombre}
                  </span>
                ))}
                <span className="envivo-plataformas-mas muted">y cualquier otro directo</span>
              </span>
              <button type="button" className="envivo-volver envivo-nav-cerrar" onClick={onVolver} title="Volver a los clips de video">
                <Icono de="izquierda" /> Video
              </button>
            </div>
            <p className="envivo-pista muted small">
              El video puede tardar unos segundos en aparecer. Los clips salen un poco detrás del directo: es la grabación.
            </p>
          </section>

          <div className="envivo-mesa">
          {/* La emisión, a la izquierda: video + estado + cerrar. Si el navegador de la app está abierto
              con el live, se pone ENCIMA del video (que sigue montado y grabando): al cerrarlo, el directo
              retoma donde quedó sin recargar el stream. Sin live, el panel queda en su estado vacío. */}
          <section className="envivo-preview">
            {vivo?.stream ? (
              // El marco toma la proporción real del directo: un live vertical (TikTok) se ve como marco
              // vertical, no como una caja ancha con bandas negras; `--ar` lo calculan las unidades cq*.
              <div className="envivo-video" style={{ '--ar': String(arDirecto) } as CSSProperties}>
                <div className={`envivo-video-marco ${arDirecto < 1 ? 'v' : 'h'}`}>
                  <video
                    ref={videoRef}
                    muted
                    autoPlay
                    playsInline
                    onClick={alternarSonido}
                    onCanPlay={() => setVideoListo(true)}
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget
                      if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight)
                    }}
                  />
                  {!videoListo && (
                    <div className="envivo-video-cargando" aria-label="Cargando el directo">
                      <i />
                      <p className="muted small">Cargando el directo…</p>
                    </div>
                  )}
                  <span className="envivo-vivo">
                    <i /> {vivo.estado === 'en-vivo' ? 'EN VIVO' : vivo.estado === 'conectando' ? 'CONECTANDO' : vivo.estado.toUpperCase()}
                  </span>
                  {/* Sonido siempre a la vista: toca para dar y para quitar; el video también alterna al clic. */}
                  <button className="envivo-sonido" onClick={alternarSonido} title={sonado ? 'Quitar el sonido del directo' : 'Darle sonido al directo'}>
                    <Icono de={sonado ? 'silencio' : 'sonido'} /> {sonado ? 'Silenciar' : 'Sonido'}
                  </button>
                </div>
                {navAbierto && (
                  <div className="envivo-navegador">
                    <PanelNavegador hilo={NAVEGADOR_CLIPS} trabajando={false} />
                  </div>
                )}
              </div>
            ) : (
              <div className="envivo-sinpreview">
                <i
                  className="envivo-hueso-video"
                  style={{ '--ar': vivo && plataformaDe(vivo.url)?.id === 'tiktok' ? '9 / 16' : '16 / 9' } as CSSProperties}
                  aria-hidden
                />
                <Icono de={vivo?.estado === 'conectando' ? 'recargar' : 'video'} />
                <p>
                  {!vivo
                    ? 'Conecta un live arriba: la vista del directo aparece aquí.'
                    : vivo.estado === 'conectando'
                      ? 'Conectando la vista previa: en unos segundos se ve el directo desde la propia grabación.'
                      : 'Este live no suelta un stream que se pueda previsualizar aquí, pero la grabación y los clips funcionan igual.'}
                </p>
              </div>
            )}
            {vivo && (
            <div className="envivo-info">
              <div className="envivo-quien">
                {plataformaDe(vivo.url) && <Logo de={plataformaDe(vivo.url)!.id} chico />}
                <div className="envivo-quien-txt">
                  <b>{vivo.titulo}</b>
                  <span className="muted small">
                    {vivo.canal ? `${vivo.canal} · ` : ''}
                    {vivo.estado === 'conectando' && 'Conectando al live…'}
                    {vivo.estado === 'en-vivo' && `Grabando · buffer de ~${vivo.minutos} min`}
                    {vivo.estado === 'terminado' && 'El live terminó: puedes seguir cortando lo grabado.'}
                    {vivo.estado === 'error' && `Error: ${vivo.error}`}
                    {vivo.voz ? ' · transcribiendo' : ' · sin transcripción'}
                  </span>
                  {/* La URL del directo: en la app abre el navegador de Hermit en esa emisión (para
                      investigarla sin salir); fuera de Electron, el enlace normal del sistema. */}
                  {hayNavegador ? (
                    <button
                      type="button"
                      className={`envivo-url muted small${navAbierto ? ' on' : ''}`}
                      onClick={alternarNavegador}
                      title={navAbierto ? 'Volver a la vista del directo' : `Abrir el live en el navegador de Hermit: ${vivo.url}`}
                    >
                      {vivo.url.replace(/^https?:\/\//, '')}
                    </button>
                  ) : (
                    <a className="envivo-url muted small" href={vivo.url} target="_blank" rel="noreferrer" title={`Abrir el live: ${vivo.url}`}>
                      {vivo.url.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
              <button className="clips-pegar envivo-cerrar" onClick={() => void cerrar()}>
                Cerrar live
              </button>
            </div>
            )}
          </section>

          {/* La transcripción y los clips, a la derecha. */}
          <section className="envivo-lado">
            <div
              className="envivo-texto"
              ref={textoRef}
              onScroll={alBajar}
              aria-live="polite"
              aria-label="Transcripción en vivo"
            >
              {texto.length === 0 ? (
                !vivo ? (
                  <p className="muted small envivo-texto-vacio">La transcripción del directo aparece aquí.</p>
                ) : vivo.estado === 'conectando' || (vivo.voz && vivo.estado === 'en-vivo') ? (
                  // Mientras el directo se estabiliza o llega la primera frase (~1 min), líneas-hueso como una
                  // transcripción de verdad (marca de tiempo + texto) en vez de un texto que parpadea. Si los
                  // trozos se amontonan, se dice cuántos van de retraso: la espera se entiende, no parece rota.
                  <div className="envivo-huesos" aria-label="Cargando la transcripción">
                    {[0, 1].map((i) => (
                      <div key={i} className="envivo-hueso-linea">
                        <i className="envivo-hueso-marca" />
                        <i className="envivo-hueso-texto" style={{ width: `${84 - i * 22}%` }} />
                      </div>
                    ))}
                    <p className="muted small envivo-huesos-nota">
                      {vivo.vozPendientes && vivo.vozPendientes > 2
                        ? `El transcriptor va con ${vivo.vozPendientes} trozos de retraso: la transcripción llega unos minutos detrás del directo.`
                        : 'La primera frase tarda ~1 min: el audio se escucha en trozos de 20 s.'}
                    </p>
                  </div>
                ) : (
                  <p className="muted small envivo-texto-vacio">
                    {vivo.estado === 'terminado' ? 'El live terminó sin frases transcritas.' : 'Este live no trae voz transcribible: la grabación sigue.'}
                  </p>
                )
              ) : (
                texto.map((s, i) => (
                  <p key={i} className="envivo-frase">
                    <span className="envivo-marca muted">{marca(s.start)}</span> {s.text}
                  </p>
                ))
              )}
            </div>

            <div className="envivo-cuerpo">
              <VistaClip
                formato={formato}
                subtitulos={subtitulos}
                acento={acento}
                portadaTitulo={portadaTitulo}
                portadaResaltar={portadaResaltar}
                gancho={gancho}
                ratio={ratio}
                palabras={palabrasClip}
                stream={vivo?.stream ?? null}
                listo={videoListo}
                cargando={!!vivo && (vivo.estado === 'conectando' || vivo.estado === 'en-vivo') && (!vivo.stream || !videoListo)}
                video={videoRef}
                reencuadre={reencuadre}
              />
              <div className="envivo-form">
              <div className="envivo-campo">
                <span className="clips-grupo-titulo">Clip de los últimos</span>
                <div className="envivo-duracion" role="radiogroup" aria-label="Duración del clip">
                  {DURACIONES.map((d) => (
                    <button key={d} role="radio" aria-checked={segundos === d} className={segundos === d ? 'on' : ''} onClick={() => setSegundos(d)}>
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="envivo-campo">
                <span className="clips-grupo-titulo">Formato</span>
                <div className="envivo-segmento" role="radiogroup" aria-label="Formato del clip">
                  {FORMATOS.map((f) => (
                    <button
                      key={f.v}
                      role="radio"
                      aria-checked={formato === f.v}
                      aria-label={`${f.nombre}: ${f.detalle}`}
                      title={`${f.nombre} · ${f.detalle}`}
                      className={formato === f.v ? 'on' : ''}
                      onClick={() => setFormato(f.v)}
                    >
                      <Icono de={f.ico} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="envivo-filas">
                <div className="envivo-grupo">
                  <span className="clips-grupo-titulo">Subtítulos</span>
                  <div className="envivo-chips">
                    {SUBTITULOS.map((s) => (
                      <button key={s.v} className={subtitulos === s.v ? 'on' : ''} onClick={() => setSubtitulos(s.v)}>
                        {s.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="envivo-grupo">
                  <span className="clips-grupo-titulo">Acento</span>
                  <div className="envivo-acento">
                    {ACENTOS.map((a) => (
                      <button
                        key={a.v || 'ninguno'}
                        className={`envivo-punto ${acento === a.v ? 'on' : ''}`}
                        style={a.v ? { background: a.hex } : undefined}
                        title={a.nombre}
                        aria-label={a.nombre}
                        onClick={() => setAcento(a.v)}
                      >
                        {!a.v && <Icono de="cerrar" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button className="envivo-extras" onClick={() => setExtras(!extras)} aria-expanded={extras}>
                <Icono de={extras ? 'cerrar' : 'mas'} /> Portada y reencuadre
              </button>
              {extras && (
                <div className="envivo-extras-campos">
                  <input type="text" placeholder="Título de la portada (2 a 5 palabras)" value={portadaTitulo} onChange={(e) => setPortadaTitulo(e.target.value)} maxLength={60} />
                  <input type="text" placeholder="Gancho (tarjeta de los primeros segundos, ≤80)" value={gancho} onChange={(e) => setGancho(e.target.value)} maxLength={80} />
                  <input type="text" placeholder="Palabra de la portada en el acento (opcional)" value={portadaResaltar} onChange={(e) => setPortadaResaltar(e.target.value)} maxLength={40} />
                  <select value={reencuadre} onChange={(e) => setReencuadre(e.target.value)} aria-label="Reencuadre">
                    {REENCUADRES.map((r) => (
                      <option key={r.v} value={r.v}>
                        Reencuadre: {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="envivo-acciones">
                {vivo && error && <p className="bad small">{error}</p>}
                {aviso && <p className="muted small envivo-aviso">{aviso}</p>}
                <button className="clips-mandar envivo-clip" onClick={() => void hacerClip()} disabled={!enMarcha}>
                  Hacer clip de {segundos} s
                  <kbd className="envivo-tecla">C</kbd>
                </button>
              </div>
              </div>
            </div>

            <div className="envivo-clips">
              <div className="clips-hilos-titulo">Clips del live</div>
              {(vivo?.clips ?? []).length === 0 ? (
                <p className="muted small envivo-clips-vacio">
                  {!vivo
                    ? 'Los clips del live salen aquí.'
                    : enMarcha
                      ? 'Los clips que hagas con C o el botón salen aquí, listos para ver.'
                      : 'No hay clips de este live.'}
                </p>
              ) : (
                <div className="envivo-clips-fila">
                  {(vivo?.clips ?? []).map((c) => {
                    const listo = c.estado === 'listo' && srcDe(c)
                    return (
                    <div
                      key={c.id}
                      className={`envivo-clip-tile ${c.formato === 'horizontal' ? 'h' : 'v'}${listo ? ' ver' : ''}`}
                      onClick={listo ? () => setViendo(srcDe(c)!) : undefined}
                      role={listo ? 'button' : undefined}
                      title={listo ? 'Ver el clip' : undefined}
                    >
                      <div className={`envivo-clip-pieza ${c.formato === 'horizontal' ? 'h' : ''}`}>
                        {listo ? (
                          <video src={srcDe(c)} muted playsInline preload="metadata" />
                        ) : c.estado === 'error' ? (
                          <span className="envivo-clip-icono">
                            <Icono de="cerrar" />
                          </span>
                        ) : (
                          // En cola o renderizando: la pieza-hueso toma la proporción del clip que sale.
                          <span className="envivo-clip-hueso" aria-label="El clip se está haciendo" />
                        )}
                      </div>
                      <span className="envivo-clip-info">
                        <b>Clip {Number(c.nombre.replace(/\D+/g, '')) || c.nombre}</b>
                        <small className={c.estado === 'error' ? 'bad' : c.estado === 'listo' ? 'muted' : 'envivo-trabajando'}>
                          {c.formato === 'horizontal' ? '16:9 · ' : '9:16 · '}
                          {c.estado === 'cola' && 'en cola'}
                          {c.estado === 'renderizando' && (c.detalle || 'renderizando…')}
                          {c.estado === 'listo' && 'listo'}
                          {c.estado === 'error' && (c.error || 'falló')}
                        </small>
                      </span>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
          </div>
        </>
      )}

      {/* El clip en grande: el mismo visor de «Mis videos» — clic fuera para cerrar. */}
      {viendo && (
        <div className="lightbox" onClick={() => setViendo(null)}>
          <video src={viendo} controls autoPlay onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
