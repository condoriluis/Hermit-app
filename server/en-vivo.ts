import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ServerPush, VivoClip, VivoEstado, VivoSegmento } from '../shared/types.ts'
import { cuerpo, json } from './http.ts'
import { chromiumDelSistema, navegadorBajado } from './chromium.ts'
import type { Browser } from 'playwright-core'
import { BANDERAS, rutaPythonHermit } from './requisitos.ts'
import { carpetaSkill } from './skills.ts'
import { carpetaTrabajo } from './trabajo.ts'
import { guardar } from './disco.ts'
import { matarArbol } from './rpc-lineas.ts'

/**
 * El live de la página Clips: pegas la URL de una emisión en directo y Hermit la graba en un buffer circular de
 * ~10 minutos. Un solo ffmpeg baja el stream una vez y lo parte en dos salidas `-f segment`: los segmentos `.ts`
 * copiados que forman el buffer (de ahí salen los clips, sin perder calidad) y la voz en WAV de 16 kHz que
 * `en_vivo.py` transcribe trozo a trozo con el Whisper/Parakeet del Python de Hermit (el Whisper ya cargado de
 * `voz_viva.py` en las NVIDIA). Cada clip pedido corta los últimos segundos del buffer y pasa por el mismo
 * `hacer.py` de la card «Clips`: reencuadre, subtítulos karaoke, portada y -14 LUFS, todo local.
 *
 * - `GET  /api/en-vivo` → `{ vivo }`: el estado del live y su transcripción entera (para recargar la página).
 * - `POST /api/en-vivo` `{url}` → lo abre: yt-dlp saca el stream (solo `is_live`; un VOD, un directo que aún no
 *   empieza o uno con DRM no entra), ffmpeg empieza a grabar y el transcriptor a oír. Si el live no suelta un
 *   m3u8 para el navegador, la grabación y los clips funcionan igual: solo falta la vista previa.
 * - `POST /api/en-vivo/clip` `{segundos, formato, subtitulos, acento?, portada_titulo?, gancho?, ...}` → corta
 *   los últimos `segundos` del buffer y los manda a la cola de render (de uno en uno, como un lote).
 * - `POST /api/en-vivo/cerrar` → mata ffmpeg y el transcriptor y borra el buffer y la voz; los clips y sus
 *   fuentes se quedan en el proyecto, que es una carpeta más de la card «Clips» (sus videos entran a «Mis videos»).
 *
 * El estado y la transcripción salen por el WebSocket (`envivo` y `envivo-texto`), como las ideas y las redes.
 * Un live a la vez: abrir otro primero cierra el anterior. Con el live terminado se pueden seguir pidiendo clips
 * de lo grabado, hasta cerrarlo.
 */

/** Cada cuánto se mira el buffer y la voz (los procesos escriben archivos, no avisan). */
const PASO_MS = 3000
/** Segundos de cada segmento de video del buffer. */
const SEG_VIDEO = 8
/** Segundos de cada trozo de voz que se transcribe. */
const SEG_VOZ = 20
/** ~10 minutos de buffer: 75 segmentos de 8 s. Es lo que hay detrás para cortar. */
const VENTANA_SEG = 75
/** Aire al final del clip: termina un poco antes del borde grabado, sin frames a medio llegar. */
const COLA_CLIP = 0.4
/** Segundos de más que la ventana debe cubrir sobre el clip (bordes de segmento y de keyframe). */
const MARGEN_CLIP = SEG_VIDEO
/** Lo que se deja de cola de clips esperando render (cada uno pesa su fuente y su render). */
const MAX_COLA_CLIPS = 6
/** Renders de clip a la vez: ffmpeg (Media Foundation) y Parakeet aguantan dos sin pisarse; más saturaría el equipo. */
const MAX_RENDERS_CLIPS = 2
/** Segundos sin un archivo nuevo del live antes de dar ffmpeg por colgado y relanzarlo. */
const SILENCIO_MS = 45_000
/** Lo que se espera a que el live dé su primer segmento antes de rendirse. */
const ARRANQUE_MS = 90_000
/** Relanzamientos seguidos de ffmpeg sin progreso: pasado el tope, el live se da por perdido. */
const MAX_REINICIOS = 5
/** Lo que acepta el servidor; la página ofrece las duraciones cortas. */
const MIN_CLIP = 5
const MAX_CLIP = 600

const SUBTILOS = new Set(['minimal', 'top', 'archivo', 'varela', 'crimen', 'ninguno', 'centro'])
/** Los `acento`, `portada_fuente` y `reencuadre` de `cortes.json` (los mismos que valida `hacer.py`). */
const ACENTOS = new Set(['amarillo', 'rojo', 'naranja', 'verde', 'cyan', 'azul', 'morado', 'rosa'])
const PORTADA_FUENTES = new Set(['anton', 'archivo', 'bebas', 'courier', 'varela'])
const REENCUADRES = new Set(['auto', 'centrado', 'difuminado', 'persona'])

interface FormatoStream {
  url?: string
  manifest_url?: string
  protocol?: string
  format_id?: string
  vcodec?: string
  acodec?: string
  height?: number
  resolution?: string
  tbr?: number
  http_headers?: Record<string, string>
}

export interface StreamElegido {
  /** La entrada de vídeo para ffmpeg: un video solo, o el muxado que trae video y audio. */
  video?: string
  /** La entrada de audio aparte, si el live la da separada: así no se baja el vídeo dos veces. */
  audio?: string
  /** Si la entrada de vídeo elegida trae audio (formato muxado). */
  conAudio?: boolean
  vHeaders?: Record<string, string>
  aHeaders?: Record<string, string>
  /** Cuánto hay que retrasar el audio aparte (ms) para alinearlo con el vídeo: cuando las dos pistas vienen
   *  de pipelines con latencias distintas (TikTok: vídeo HLS con segundos de cola, audio FLV casi en vivo),
   *  el sonido se adelanta a la imagen esa diferencia. Se mide del manifiesto al conectar. */
  audioDelayMs?: number
  /** El m3u8 para previsualizar en el navegador (`hls.js`), si el live lo suelta. */
  stream: { url: string; headers?: Record<string, string> } | null
}

interface PedidoClip {
  segundos: number
  formato: 'vertical' | 'horizontal'
  subtitulos: string
  acento?: string
  portadaTitulo?: string
  gancho?: string
  portadaResaltar?: string
  portadaFuente?: string
  reencuadre?: string
}

interface ClipVivo extends VivoClip {
  pedido: PedidoClip
}

/**
 * Borra un archivo sin tumbar el servidor: en Windows el `.ts` o el `.wav` puede seguir abierto un instante
 * (ffmpeg cerrando el segmento, el transcriptor o el antivirus) y un `rmSync` suelto lanza EBUSY que tira el
 * proceso entero — ya pasó: el servidor se cayó a los segundos de empezar la transcripción. Se reintenta un
 * rato; si aun así no sale, queda en disco y lo barre el `rmSync` recursivo de `cerrar`.
 */
function borrar(ruta: string) {
  const intentar = (n: number) => {
    try {
      rmSync(ruta, { force: true })
    } catch {
      if (n > 0) {
        const t = setTimeout(() => intentar(n - 1), 700)
        t.unref?.()
      }
    }
  }
  intentar(8)
}

interface Vivo {
  id: string
  url: string
  titulo: string
  canal?: string
  estado: VivoEstado['estado']
  error?: string
  /** La carpeta del live dentro de la card «Clips» (`trabajo/video-clips/en-vivo-…`): ahí caen sus clips. */
  proyecto: string
  buffer: string
  vozDir: string
  ffmpeg?: ChildProcess
  transcriptor?: ChildProcess
  /** WAVs cortados que esperan turno de transcripción, con su segundo de inicio en la emisión. */
  colaVoz: { wav: string; desde: number }[]
  procesandoVoz?: string
  /** El corrimiento del trozo que el transcriptor tiene ahora (para reencolarlo si hay que relanzarlo). */
  vozDesdeActual: number
  /** Cuándo se lanzó el transcriptor y cuándo contestó por última vez: un Whisper atascado se nota aquí. */
  vozEspera: number
  /** Relanzamientos seguidos del transcriptor mudo: pasado el tope, la voz se da por perdida. */
  vozReinicios: number
  /** Los WAV ya transcritos: quedan en `hechos` aunque el borrado tarde (en Windows el archivo sigue un
   *  instante abierto por el transcriptor o el antivirus), para que `paso` no los vuelva a encolar. */
  hechos: Set<string>
  /** Segundos de emisión ya cubiertos por los WAV encolados (cada trozo empieza donde acabó el anterior). */
  offsetVoz: number
  /** Lo transcrito hasta ahora; `textoEnviado` es cuántos ya salieron por el WebSocket. */
  transcript: VivoSegmento[]
  textoEnviado: number
  vozOk: boolean
  /** La cola de error del transcriptor: sus avisos van por stderr (el stdout es solo el JSON del protocolo). */
  vozLog: string
  /** Los segmentos del buffer por nombre, con su duración: el plan de cada clip. */
  segmentos: Map<string, number>
  clips: ClipVivo[]
  renderizando: boolean
  proximo: number
  /** La cola de error de ffmpeg, para decir por qué murió. */
  errores: string
  /** La entrada elegida al conectar: con ella se relanza ffmpeg si el vivo se queda colgado. */
  elegido: StreamElegido
  /** Cuándo se lanzó ffmpeg (para el límite de «conectando») y cuándo dio su último archivo (para el de «colgado»). */
  inicio: number
  ultimoAvance: number
  /** Relanzamientos seguidos de ffmpeg sin que llegue un segmento nuevo: pasado el tope, el live se da por perdido. */
  reinicios: number
  /** Cuándo fue el último relanzamiento: si el live lleva 5 min sano, el contador vuelve a cero. */
  ultimoReinicio: number
  /** El reencuadre «quien habla» por formato pedido: el estado del crop que va siguiendo la cara. */
  caras?: Partial<Record<'vertical' | 'horizontal', CaraEnVivo>>
  /** Una detección de caras a la vez: la previa pregunta cada ~2,5 s y no se encimar. */
  caraOcupado?: boolean
}

/** El estado que ven la página y el WebSocket: sin procesos ni rutas de trabajo. */
function publico(v: Vivo): VivoEstado {
  return {
    id: v.id,
    url: v.url,
    titulo: v.titulo,
    canal: v.canal,
    estado: v.estado,
    error: v.error,
    // La vista previa es SIEMPRE la del propio buffer (`/api/en-vivo/hls.m3u8`): mismo origen, sin CORS, y es
    // la misma grabación que se corta — ni una descarga extra ni un stream que se adelante. Sin m3u8 externo
    // de por medio: cambiar de playlist a mitad de la emisión hacía saltar el video hacia atrás una vez.
    // Antes del primer segmento no hay nada que previsualizar todavía (el hueso de carga lo cubre).
    stream: v.segmentos.size ? { url: '/api/en-vivo/hls.m3u8' } : null,
    voz: v.vozOk,
    vozPendientes: v.colaVoz.length + (v.procesandoVoz ? 1 : 0),
    minutos: Math.round((((v.segmentos.size || VENTANA_SEG) * SEG_VIDEO) / 60) * 10) / 10,
    // Un clip «listo» cuyo mp4 ya no está (borrado desde «Mis videos») no es un fallo ni hay nada que
    // mostrar: sale de la repisa. Los errores de render de verdad sí se quedan.
    clips: v.clips
      .filter(({ estado, archivo }) => !(estado === 'listo' && archivo && !existsSync(archivo)))
      .map(({ pedido: _p, ...c }) => c)
  }
}

/** Los meses en español e inglés (largo y abreviado) que pueden aparecer en el título de un live. */
const MESES_LIVE =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|' +
  'january|february|march|april|may|june|july|august|september|october|november|december|' +
  'ene\\.?|feb\\.?|mar\\.?|abr\\.?|may\\.?|jun\\.?|jul\\.?|ago\\.?|sep\\.?|oct\\.?|nov\\.?|dic\\.?|' +
  'jan\\.?|feb\\.?|mar\\.?|apr\\.?|jun\\.?|jul\\.?|aug\\.?|sep\\.?|oct\\.?|nov\\.?|dec\\.?'
/** Una fecha completa en texto: ISO, dd/mm/aaaa, «19 de noviembre de 2026» o «November 19, 2026». */
const FECHA_LIVE =
  '(?:\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}' +
  '|\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}' +
  `|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:de\\s+)?(?:${MESES_LIVE})\\.?,?\\s*(?:de\\s+)?\\d{4}` +
  `|(?:${MESES_LIVE})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})`
/** Una hora: 22:17, 22.17, 22h17, con segundos y a.m./p.m. opcionales. */
const HORA_LIVE = '\\d{1,2}[:.h]\\d{2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?'
/** Fecha (+hora, con «a las»/«at»/«hrs» opcional) pegada al final del título, con su separador; o el título que es solo eso. */
const RE_FECHA_LIVE = new RegExp(
  `(?:^|[\\s·|\\-—:;,]+)(?:${FECHA_LIVE})(?:(?:[\\sT]+(?:(?:a\\s+las|at|hrs?\\.?|h)\\s+)?)?${HORA_LIVE})?[\\s.]*$`,
  'i'
)
/** Una hora suelta al final solo cuenta si lleva a.m./p.m. («Episode 42 22:17» no se toca). */
const RE_HORA_LIVE = new RegExp(`[\\s·|\\-—:;,]+\\d{1,2}[:.h]\\d{2}\\s*[ap]\\.?m\\.?[\\s.]*$`, 'i')

/**
 * El título del live sin la fecha y la hora que las plataformas agregan al final (TikTok pone
 * «2026-11-19 22:17», otros «19/11/2026», «November 19, 2026»…). Solo recorta sufijos de fecha-hora:
 * un «Top 10 2026» o un «Episode 42» se conservan. Si no queda nada, devuelve ''.
 */
export function limpiarTituloLive(titulo: string): string {
  let t = titulo
  for (let i = 0; i < 3; i++) {
    const antes = t
    t = t.replace(RE_FECHA_LIVE, '').replace(RE_HORA_LIVE, '').replace(/[\s·|:;,.—–-]+$/u, '').trim()
    if (t === antes) break
  }
  return t
}

/** Los enlaces de live compartidos traen parámetros de tracking que confunden al extractor de TikTok
 * («not currently live» con el directo emitiendo): en `/@canal/live` no hace falta ninguno y se quitan.
 * El resto de plataformas conserva los suyos (`v=` de YouTube, firmas de Twitch…). */
export function limpiarUrlLive(url: string): string {
  try {
    const u = new URL(url)
    if (/(^|\.)tiktok\.com$/i.test(u.hostname) && /\/live\/?$/i.test(u.pathname)) u.search = ''
    return u.toString()
  } catch {
    return url
  }
}

/**
 * El fallo de yt-dlp dicho para el usuario: los mensajes crudos («ERROR: [tiktok:live] canal: The channel is
 * not currently live») no explican nada. Se reconocen los casos que más salen —directo terminado, sin empezar,
 * privado, con login, protegido, por región, enlace caducado— y se devuelve una frase clara; lo que no se
 * reconoce conserva la línea de yt-dlp para no esconder un fallo nuevo.
 */
export function explicarFalloLive(fallo: string): string {
  const f = fallo.toLowerCase()
  const casos: [RegExp, string][] = [
    [/not currently live|livestream has ended|isn'?t live|this live (event )?(has|will) end|will begin|premieres in|starts in/, 'Ese directo ya terminó o todavía no empieza. Cuando esté emitiendo, vuelve a pegar el enlace.'],
    [/private|unlisted/, 'Ese contenido es privado o no listado: no se puede leer.'],
    [/sign in|log ?in|cookies|members.?only|channel'?s members|sponsors only/, 'Esa plataforma pide iniciar sesión o ser miembro para ver el directo.'],
    [/drm|encrypted/, 'Ese directo está protegido y no se puede grabar.'],
    [/not available in your (country|region)|geo|region.?blocked/, 'Ese directo no está disponible en tu región.'],
    [/404|not found|does not exist|no longer available/, 'El enlace no existe o ya caducó: cópialo de nuevo desde el directo.'],
    [/captcha|challenge|verify you|are you a robot|unusual traffic/, 'La plataforma está pidiendo verificación: espera un momento y vuelve a intentarlo.'],
    [/unsupported url|not a valid url|no suitable|unable to extract|does not support/, 'No reconozco ese enlace como directo. Prueba con la dirección de la emisión (la que abre el reproductor del live).'],
    [/timed? ?out|timeout|timed out|connection (reset|refused|closed)/, 'El directo tardó demasiado en responder: puede que esté caído o saturado. Inténtalo de nuevo.']
  ]
  for (const [re, msg] of casos) if (re.test(f)) return msg
  const linea = fallo.trim().split('\n').filter((l) => l.trim()).at(-1) ?? ''
  return linea ? `No pude leer ese directo: ${linea.slice(0, 160)}` : 'No pude leer ese directo. Revisa que el enlace sea el del live y esté emitiendo ahora.'
}

/**
 * Si el fallo de yt-dlp merece otro intento. Las plataformas de live —sobre todo TikTok, que a veces
 * responde «not currently live» o un error pasajero con el directo emitiendo— fallan al primer golpe y
 * conectan al segundo o tercero. Los definitivos (privado, login, DRM, región, enlace muerto, URL que no
 * es directo) no mejoran reintentando: se dicen tal cual.
 */
export function esReintentableLive(error: string | undefined): boolean {
  if (!error) return false
  return !/privado|no listado|iniciar sesión|ser miembro|protegido|región|caducó|no existe|No reconozco/.test(error)
}

/** La URL de un live de TikTok con nombre de canal: la que yt-dlp tiene que scrapear, y donde su WAF estorba. */
export function esLiveTikTok(url: string): boolean {
  return /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[\w.-]+\/live(?:[/?#]|$)/i.test(url)
}

/** El `roomId` en el HTML de la página del live de TikTok (su JSON embebido o la URL del reproductor). */
export function sacarRoomId(html: string): string | null {
  return /"roomId"\s*:\s*"?(\d{10,})"?/.exec(html)?.[1] ?? /[?&]room_id=(\d{10,})/.exec(html)?.[1] ?? null
}

/** La ventana de crop del formato dentro de la fuente, igual que `ventana()` de `encuadre.py` de
 *  video-base: fuente más ancha que el formato → panea en X con todo el alto; más alta → en Y con
 *  todo el ancho. `maxX`/`maxY` es el recorrido del crop (0 cuando el formato ya cubre la fuente). */
export function ventanaEncuadre(sw: number, sh: number, formato: 'vertical' | 'horizontal') {
  const [dw, dh] = formato === 'vertical' ? [1080, 1920] : [1920, 1080]
  if (sw / sh > dw / dh) {
    const h = sh
    let w = Math.round((h * dw) / dh)
    w -= w % 2
    return { w, h, eje: 'x' as const, maxX: sw - w, maxY: sh - h }
  }
  const w = sw
  let h = Math.round((w * dh) / dw)
  h -= h % 2
  return { w, h, eje: 'y' as const, maxX: sw - w, maxY: sh - h }
}

/** Lo que el reencuadre «quien habla» recuerda por formato: dónde va el crop (esquina sup. izq. en
 *  coordenadas de la fuente), el centro de la cara suavizado y cuándo se actualizó por última vez. */
export interface CaraEnVivo {
  x: number
  y: number
  suave: { x: number; y: number } | null
  /** ms de la última muestra (para el paneo por segundo). */
  t: number
}

/**
 * Una muestra del reencuadre en vivo: la misma regla que `encuadre.trayectoria` de video-base, pero sobre
 * UN frame (el más nuevo del buffer): la cara principal es la de mayor alto, su centro se suaviza (ALFA
 * 0,4), la cámara no se mueve dentro de la zona muerta (22 % de la ventana) y panea a lo sumo 1,2
 * ventanas por segundo. Sin cara, la cámara se queda donde estaba. `ahora` en ms.
 */
export function pasoPersona(estado: CaraEnVivo, cara: { x: number; y: number } | null, sw: number, sh: number, formato: 'vertical' | 'horizontal', ahora: number): CaraEnVivo {
  const v = ventanaEncuadre(sw, sh, formato)
  const suave = cara
    ? estado.suave
      ? { x: estado.suave.x + 0.4 * (cara.x - estado.suave.x), y: estado.suave.y + 0.4 * (cara.y - estado.suave.y) }
      : { ...cara }
    : estado.suave
  const dt = Math.min(Math.max((ahora - estado.t) / 1000, 0.1), 5)
  const pos = { x: estado.x, y: estado.y }
  const e = v.eje
  const dim = e === 'x' ? v.w : v.h
  const tope = e === 'x' ? v.maxX : v.maxY
  if (suave && tope > 0) {
    const fc = e === 'x' ? suave.x : suave.y
    const rel = fc - (pos[e] + dim / 2)
    if (Math.abs(rel) > dim * 0.22) {
      const objetivo = Math.min(Math.max(fc - dim / 2, 0), tope)
      const vmax = 1.2 * dim
      pos[e] = Math.min(Math.max(pos[e] + Math.min(Math.max(objetivo - pos[e], -vmax * dt), vmax * dt), 0), tope)
    }
  }
  return { x: pos.x, y: pos.y, suave, t: ahora }
}

/**
 * El `roomId` del live de TikTok leído con un Chromium real: el WAF de TikTok sirve a yt-dlp una página de
 * verificación («Please wait…») aunque el directo emita, y el navegador la resuelve solo. La página tarda
 * unos segundos en recargar ya con los datos; se espera ~25 s. Sin navegador no hay plan B: `null`.
 */
async function roomIdTikTok(url: string): Promise<string | null> {
  const exe = chromiumDelSistema(true) ?? navegadorBajado()
  if (!exe) return null
  let b: Browser | undefined
  try {
    const { chromium } = await import('playwright-core')
    b = await chromium.launch({ executablePath: exe, headless: true, args: ['--mute-audio'] })
    const page = await b.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {})
    const limite = Date.now() + 25_000
    while (Date.now() < limite) {
      const id = sacarRoomId(await page.content().catch(() => ''))
      if (id) return id
      await new Promise((r) => setTimeout(r, 1500))
    }
  } catch {
    // Sin navegador o sin página: el fallo de yt-dlp se reporta como siempre.
  } finally {
    await b?.close().catch(() => {})
  }
  return null
}

/** Un nombre corto y único para la carpeta del live: fecha, hora y un pedazo del título o de la URL. */
export function slugEnVivo(titulo: string, url: string, ahora = new Date()): string {
  const d = (n: number) => String(n).padStart(2, '0')
  const fecha = `${d(ahora.getMonth() + 1)}${d(ahora.getDate())}-${d(ahora.getHours())}${d(ahora.getMinutes())}`
  let base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '')
  if (!base) {
    const yt = /(?:youtube\.com\/(?:watch\?[^ ]*v=|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url)
    base = yt ? yt[1] : (url.split('/').filter(Boolean).at(-1) ?? 'live').slice(0, 24)
  }
  return `en-vivo-${fecha}-${base}`
}

// Un live no siempre es m3u8: TikTok da el video en HLS pero el audio en un FLV `only_audio` por https, y
// ffmpeg lee ambos igual. Solo se abren m3u8 y flv: un `.mp4` por https suele ser un VOD, no un live.
const esLive = (f: FormatoStream) =>
  /m3u8/i.test(f.protocol ?? '') ||
  /\.(m3u8|flv)(\?|#|$)/i.test(f.url ?? '') ||
  !!f.manifest_url
const tieneVideo = (f: FormatoStream) => !!f.vcodec && f.vcodec !== 'none'
// yt-dlp a veces etiqueta mal la pista de audio de un live (TikTok da el FLV `only_audio` con `vcodec: h264`
// y sin `acodec`): la marca de solo-audio está en la URL o en el id del formato (`flv-ao`, `-audio`…).
const marcaAudio = (f: FormatoStream) => /only_audio=1/i.test(f.url ?? '') || /[-_.](?:ao|audio)(?:[-_.]|$)/i.test(f.format_id ?? '')
const esVideo = (f: FormatoStream) => tieneVideo(f) && !marcaAudio(f)
// yt-dlp no siempre sabe el codec de audio de una pista HLS (`acodec: null` en las de solo audio de YouTube):
// ahí manda el `vcodec: 'none'` — una entrada de live sin vídeo y sin audio declarado es la pista de sonido.
const tieneAudio = (f: FormatoStream) =>
  (f.acodec ? f.acodec !== 'none' : (f.vcodec === 'none' || marcaAudio(f)) && !!(f.url || f.manifest_url))
const altoDe = (f: FormatoStream) => f.height ?? (Number(/(\d{3,4})x\d+/.exec(f.resolution ?? '')?.[1]) || 0)
// A igual resolución y tasa, el m3u8 gana: se reconecta mejor que un FLV continuo.
const peso = (f: FormatoStream) => altoDe(f) * 10000 + (f.tbr ?? 0) + (/m3u8/i.test(f.protocol ?? '') ? 5000 : 0)

/**
 * De la ficha de yt-dlp (`-j`), las entradas que graba ffmpeg y la que previsualiza el navegador. Puro, para
 * probarlo: prefiere el video y el audio por separado (una descarga por pista), el formato muxado si es lo único
 * que hay, y como vista previa el `manifest_url` —la lista maestra con video y audio— del mejor formato con vídeo.
 */
export function elegirStreams(info: { formats?: FormatoStream[] }): StreamElegido {
  const formatos = (info.formats ?? []).filter((f) => f.url && esLive(f))
  const mejor = (fs: FormatoStream[]) => fs.reduce<FormatoStream | undefined>((a, f) => (!a || peso(f) > peso(a) ? f : a), undefined)
  const videoSolo = mejor(formatos.filter((f) => esVideo(f) && !tieneAudio(f)))
  const audioSolo = mejor(formatos.filter((f) => tieneAudio(f) && !esVideo(f)))
  const ambos = mejor(formatos.filter((f) => esVideo(f) && tieneAudio(f)))
  let video: string | undefined
  let audio: string | undefined
  let conAudio = false
  let vHeaders: Record<string, string> | undefined
  let aHeaders: Record<string, string> | undefined
  if (videoSolo && audioSolo) {
    // Lo mejor: dos pistas separadas, una descarga cada una.
    video = videoSolo.url
    audio = audioSolo.url
    vHeaders = videoSolo.http_headers
    aHeaders = audioSolo.http_headers
  } else if (ambos) {
    // Solo queda el muxado (Twitch y compañía): una entrada con video y audio.
    video = ambos.url
    conAudio = true
    vHeaders = ambos.http_headers
  } else if (videoSolo) {
    video = videoSolo.url
    vHeaders = videoSolo.http_headers
  } else if (audioSolo) {
    // Un live solo de audio no da clips: la página lo dice antes de grabar.
    audio = audioSolo.url
    aHeaders = audioSolo.http_headers
  }
  // La vista previa quiere la lista maestra (lleva las pistas de audio y vídeo juntas): la del mejor formato
  // que la traiga; si no hay, el url de un formato muxado, que también la lleva. Si solo hay pistas separadas
  // (TikTok: video en HLS, audio en FLV), se previsualiza el mejor HLS de vídeo — sin sonido hasta que el
  // buffer local (que sí junta ambos) tenga segmentos.
  const conManifiesto = mejor(formatos.filter((f) => f.manifest_url && esVideo(f)))
  const muxadoVista = mejor(formatos.filter((f) => esVideo(f) && tieneAudio(f)))
  const hlsVista = mejor(formatos.filter((f) => /m3u8/i.test(f.protocol ?? '') && esVideo(f)))
  const urlVista = conManifiesto?.manifest_url ?? muxadoVista?.url ?? hlsVista?.url
  const headersVista = conManifiesto?.http_headers ?? muxadoVista?.http_headers ?? vHeaders ?? aHeaders
  return { video, audio, conAudio, vHeaders, aHeaders, stream: urlVista ? { url: urlVista, headers: headersVista } : null }
}

/**
 * La edad del contenido más nuevo del directo, en ms, leída del manifiesto HLS: con `EXT-X-PROGRAM-DATE-TIME`
 * es exacta (hora del último segmento + su duración); sin ella se estima con el target-duration, que es lo
 * que tarda como mucho en publicarse el segmento completo más reciente. 0 si no se puede saber: en ese caso
 * no se compensa nada y el audio queda como estaba.
 */
async function latenciaBordeMs(url: string | undefined, headers?: Record<string, string>): Promise<number> {
  if (!url || !/m3u8/i.test(url)) return 0
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return 0
    const texto = await res.text()
    let target = 0
    let pdt = 0
    let dur = 0
    const segmentos: { pdt: number; dur: number }[] = []
    for (const l of texto.split('\n')) {
      const t = l.trim()
      if (t.startsWith('#EXT-X-TARGETDURATION:')) target = Number(t.slice(22)) || 0
      else if (t.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) pdt = Date.parse(t.slice(25)) || 0
      else if (t.startsWith('#EXTINF:')) dur = Number(t.slice(8).split(',')[0]) || 0
      else if (t && !t.startsWith('#')) {
        if (pdt) segmentos.push({ pdt, dur })
        pdt = 0
        dur = 0
      }
    }
    const ultimo = segmentos.at(-1)
    if (ultimo) {
      const edad = Date.now() - (ultimo.pdt + ultimo.dur * 1000)
      if (edad > 400 && edad < 60_000) return Math.round(edad)
    }
    // Sin hora de programa: el último segmento completo terminó hace ~un target-duration como mucho.
    if (target > 0 && target < 30) return Math.round(target * 1000)
    return 0
  } catch {
    return 0
  }
}

/**
 * Las entradas live que podrían traer video y audio en una sola peldaña (un FLV continuo, no un m3u8):
 * candidatas a muxado cuando las pistas elegidas vienen separadas y cada una llega por su pipeline.
 */
export function candidatosMuxados(formatos: FormatoStream[] | undefined, e: StreamElegido): FormatoStream[] {
  return (formatos ?? [])
    .filter((f) => f.url && f.url !== e.video && f.url !== e.audio && esLive(f) && esVideo(f)
      && !/m3u8/i.test(f.protocol ?? '') && !/\.m3u8(?:\?|#|$)/i.test(f.url) && !f.manifest_url)
    .sort((a, b) => peso(b) - peso(a))
}

/**
 * ¿La entrada trae pista de audio? yt-dlp a veces no la declara (el FLV muxado de TikTok dice `acodec: null`
 * y sí la trae): se le pregunta a ffprobe, que lee los primeros paquetes del live. Si ffprobe no está o el
 * live no suelta datos a tiempo, cuenta como que no hay: nunca se empeora lo que ya funcionaba.
 */
function tienePistaAudio(url: string, headers?: Record<string, string>): Promise<boolean> {
  return new Promise((ok) => {
    const args = ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0']
    if (headers && Object.keys(headers).length) {
      args.push('-headers', Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n'))
    }
    args.push(url)
    const p = spawn('ffprobe', args, { windowsHide: true })
    let salida = ''
    let listo = false
    const cerrar = (si: boolean) => {
      if (listo) return
      listo = true
      clearTimeout(reloj)
      matarArbol(p, true)
      ok(si)
    }
    const reloj = setTimeout(() => cerrar(false), 12_000)
    p.stdout.on('data', (d) => {
      salida += d
      if (/audio/.test(salida)) cerrar(true)
    })
    p.on('error', () => cerrar(false))
    p.on('close', () => cerrar(/audio/.test(salida)))
  })
}

/** La primera entrada candidata que de verdad traiga audio, comprobado con ffprobe (yt-dlp miente a veces). */
async function muxadoConAudio(info: { formats?: FormatoStream[] }, e: StreamElegido): Promise<FormatoStream | undefined> {
  const probadas = new Set<string>()
  for (const f of candidatosMuxados(info.formats, e).slice(0, 3)) {
    if (probadas.has(f.url!)) continue
    probadas.add(f.url!)
    if (await tienePistaAudio(f.url!, f.http_headers)) return f
  }
  return undefined
}

/** Cuántos segmentos del final hacen falta para un clip de `segundos`: del más nuevo hacia atrás. */
export function planVentana(durs: number[], segundos: number): number {
  let cubierto = 0
  let n = 0
  for (let i = durs.length - 1; i >= 0 && cubierto < segundos + MARGEN_CLIP; i--, n++) cubierto += durs[i]
  return n
}

/** El siguiente número libre de `prefijo-NNNNN.ext` en una carpeta: el `-segment_start_number` de un ffmpeg que se relanza. */
function proximoNumero(dir: string, prefijo: string): number {
  let max = -1
  try {
    for (const f of readdirSync(dir)) {
      const m = new RegExp(`^${prefijo}(\\d+)\\.`).exec(f)
      if (m) max = Math.max(max, Number(m[1]))
    }
  } catch {}
  return max + 1
}

/** El `-headers` de ffmpeg para las cabeceras de un formato de yt-dlp. */
const cabeceras = (h?: Record<string, string>) =>
  h && Object.keys(h).length ? ['-headers', Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n'] : []

export function enVivo(app: string, broadcast: (msg: ServerPush) => void) {
  let vivo: Vivo | null = null
  let ticker: ReturnType<typeof setInterval> | undefined

  const emitir = () => vivo && broadcast({ type: 'envivo', vivo: publico(vivo) })
  const emitirTexto = () => {
    if (!vivo) return
    const nuevos = vivo.transcript.slice(vivo.textoEnviado)
    if (!nuevos.length) return
    const desde = vivo.textoEnviado
    vivo.textoEnviado = vivo.transcript.length
    broadcast({ type: 'envivo-texto', desde, segmentos: nuevos })
  }

  /** yt-dlp como módulo del Python de Hermit (como en fuente.py), con un cliente de reserva si YouTube frena. */
  function ytdlpInfo(url: string, args: string[] = []): Promise<{ info?: any; error?: string }> {
    return new Promise((ok) => {
      const py = rutaPythonHermit()
      if (!py) return ok({ error: 'No está el Python de Hermit: instálalo en Opciones → Herramientas.' })
      const p = spawn(py, [...BANDERAS, '-m', 'yt_dlp', '-j', '--no-warnings', '--socket-timeout', '30', ...args, url], { windowsHide: true })
      let salida = ''
      let fallo = ''
      const reloj = setTimeout(() => {
        matarArbol(p, true)
        ok({ error: 'El directo tardó demasiado en responder: puede que esté caído o saturado. Inténtalo de nuevo.' })
      }, 60_000)
      p.stdout.on('data', (d) => (salida += d))
      p.stderr.on('data', (d) => (fallo += d))
      p.on('error', (e) => (clearTimeout(reloj), ok({ error: e.message })))
      p.on('close', (c) => {
        clearTimeout(reloj)
        if (c !== 0) return ok({ error: explicarFalloLive(fallo || salida) })
        try {
          ok({ info: JSON.parse(salida) })
        } catch {
          ok({ error: 'El directo no devolvió su información: inténtalo de nuevo.' })
        }
      })
    })
  }

  /** Si el mp4 tiene pista de audio (ffprobe): sin ella no hay voz que transcribir ni sonido que masterizar. */
  function hayAudio(archivo: string): boolean {
    const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', archivo], { encoding: 'utf8' })
    return (r.stdout ?? '').includes('audio')
  }

  /** Duración e inicio de un archivo de media, con ffprobe. */
  function sonda(archivo: string): { dur: number; inicio: number } {
    const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,start_time', '-of', 'json', archivo], { encoding: 'utf8' })
    try {
      const f = JSON.parse(r.stdout).format ?? {}
      return { dur: Number(f.duration) || 0, inicio: Number(f.start_time) || 0 }
    } catch {
      return { dur: 0, inicio: 0 }
    }
  }

  /**
   * La posición del crop «quien habla» ahora mismo, para la previa del clip: ffmpeg saca el último
   * frame del segmento más nuevo del buffer (lo mismo que la previa está reproduciendo) y
   * `detectar.py --una` mide sus caras con YuNet. Devuelve la posición como fracción del recorrido
   * de la ventana (0–1 por eje; 0,5 = centrado) o null si no hay con qué medir. Es el mismo criterio
   * que `encuadre.trayectoria` usará al renderizar, así la previa va donde irá el clip.
   */
  async function encuadreEnVivo(v: Vivo, formato: 'vertical' | 'horizontal'): Promise<{ x: number; y: number } | null> {
    const segs = [...v.segmentos.keys()].filter((f) => /^seg-\d+\.ts$/.test(f)).sort()
    const ultimo = segs.at(-1)
    const py = rutaPythonHermit()
    const base = carpetaSkill('video-base')
    if (!ultimo || !py || !base || v.caraOcupado) return null
    v.caraOcupado = true
    try {
      const foto = join(tmpdir(), `hermit-cara-${v.id}.jpg`)
      const ff = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-sseof', '-2', '-i', join(v.buffer, ultimo),
        '-frames:v', '1', '-q:v', '4', '-y', foto], { timeout: 20_000, windowsHide: true })
      if (ff.status !== 0 || !existsSync(foto)) return null
      const d = await new Promise<{ ancho?: number; alto?: number; caras?: { x: number; y: number; w: number; h: number }[] } | null>((ok) => {
        const p = spawn(py, [...BANDERAS, '-X', 'utf8', join(base, 'scripts', 'detectar.py'), '--una', foto], { windowsHide: true })
        let out = ''
        const reloj = setTimeout(() => (matarArbol(p, true), ok(null)), 30_000)
        p.stdout.on('data', (x) => (out += x))
        p.on('error', () => (clearTimeout(reloj), ok(null)))
        p.on('close', () => {
          clearTimeout(reloj)
          try {
            ok(JSON.parse(out.trim().split('\n').at(-1) ?? ''))
          } catch {
            ok(null)
          }
        })
      })
      rmSync(foto, { force: true })
      if (!d?.ancho || !d?.alto) return null
      const principal = (d.caras ?? []).reduce<{ x: number; y: number; w: number; h: number } | null>((a, b) => (!a || b.h > a.h ? b : a), null)
      const centro = principal ? { x: principal.x + principal.w / 2, y: principal.y + principal.h / 2 } : null
      const win = ventanaEncuadre(d.ancho, d.alto, formato)
      const previo = v.caras?.[formato] ?? { x: win.maxX / 2, y: win.maxY / 2, suave: null, t: 0 }
      const nuevo = pasoPersona(previo, centro, d.ancho, d.alto, formato, Date.now())
      v.caras = { ...(v.caras ?? {}), [formato]: nuevo }
      return { x: win.maxX > 0 ? nuevo.x / win.maxX : 0.5, y: win.maxY > 0 ? nuevo.y / win.maxY : 0.5 }
    } finally {
      v.caraOcupado = false
    }
  }

  /** ffmpeg grabando el live: una descarga, dos salidas de segmentos (el buffer y la voz). */
  function lanzarFfmpeg(v: Vivo, e: StreamElegido) {
    // Las opciones de entrada (`-reconnect`, `-rw_timeout`) aplican solo a la siguiente `-i`: van delante de
    // cada una. Sin ellas en la segunda pista, un corte de red en el audio congela ffmpeg entero (ya pasó:
    // el buffer se quedó en 7 segmentos y la voz no escribió ni un WAV).
    const RECONEXION = ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
      '-reconnect_on_network_error', '1', '-rw_timeout', '15000000']
    const args = ['-hide_banner', '-nostdin', '-v', 'warning']
    if (e.video) args.push(...RECONEXION, ...cabeceras(e.vHeaders), '-i', e.video)
    // Si el audio viene de otro pipeline (TikTok: FLV casi en vivo vs HLS con cola), `-itsoffset` lo retrasa
    // lo que el vídeo tarda en llegar: sin él el sonido se adelanta a la imagen toda la emisión.
    if (e.audio && e.audio !== e.video) {
      args.push(...RECONEXION, ...cabeceras(e.aHeaders))
      if (e.audioDelayMs && e.audioDelayMs >= 500) args.push('-itsoffset', (e.audioDelayMs / 1000).toFixed(3))
      args.push('-i', e.audio)
    }
    if (!e.video) return fallar(v, 'El live no trae vídeo: no hay nada que grabar para clips.')
    // El índice del audio: la segunda entrada si el live la da aparte; la primera si el formato es muxado.
    const idxAudio = e.audio && e.audio !== e.video ? '1' : '0'
    const hayAudio = !!e.audio || !!e.conAudio
    // `-segment_start_number` sigue la numeración donde quedó: si ffmpeg se relanza (el vivo se cayó y se
    // reconecta solo), los nombres no pisan los segmentos que ya están en el buffer ni en la cola de voz.
    const desdeSeg = proximoNumero(v.buffer, 'seg-')
    const desdeVoz = proximoNumero(v.vozDir, 'voz-')
    // Salida 1: el buffer, copiado (no re-codifica: es lo que permite cortar sin perder calidad).
    args.push('-map', '0:v:0?', hayAudio ? '-map' : '-an', ...(hayAudio ? [`${idxAudio}:a?`] : []),
      '-c', 'copy', '-f', 'segment', '-segment_time', String(SEG_VIDEO), '-segment_format', 'mpegts',
      '-reset_timestamps', '1', '-segment_start_number', String(desdeSeg), join(v.buffer, 'seg-%05d.ts'))
    // Salida 2: la voz del mismo live, a WAV mono 16 kHz para el transcriptor (solo si hay audio).
    if (hayAudio) {
      // Solo la primera pista de audio: el muxer wav no admite más de una (y el buffer copia lo que haya).
      args.push('-map', `${idxAudio}:a:0?`, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
        '-f', 'segment', '-segment_time', String(SEG_VOZ), '-segment_format', 'wav',
        '-segment_start_number', String(desdeVoz), join(v.vozDir, 'voz-%05d.wav'))
    }
    const p = spawn('ffmpeg', args, { windowsHide: true })
    v.ffmpeg = p
    p.stderr.on('data', (d) => (v.errores = (v.errores + d).slice(-4000)))
    p.on('error', (e) => {
      if (v.ffmpeg === p) fallar(v, `No pude lanzar FFmpeg: ${e.message}. ¿Está en el PATH?`)
    })
    p.on('close', (c) => {
      // Un ffmpeg viejo que se cerró al relanzarlo no decide nada: el que manda es el actual.
      if (v.ffmpeg !== p || v.estado === 'cerrado' || v.estado === 'error') return
      if (c === 0) {
        // El último segmento y el último WAV se asientan al cerrar ffmpeg: un respiro y un repaso antes
        // de dar el live por terminado, para no perder la cola de la emisión.
        setTimeout(() => {
          if (v.estado === 'cerrado' || v.estado === 'error') return
          paso(v)
          v.estado = 'terminado'
          emitir()
        }, 3000)
      } else if (v.reinicios < MAX_REINICIOS && v.estado !== 'terminado') {
        // Se cayó solo (se cortó la red o el stream): un relanzamiento más antes de rendirse.
        v.reinicios++
        relanzar(v)
      } else {
        fallar(v, `FFmpeg se cayó grabando el live: ${v.errores.trim().split('\n').at(-1) ?? `salió con ${c}`}`)
      }
    })
  }

  /** El último archivo de una carpeta con el patrón del buffer o de la voz (el que ffmpeg tiene abierto al morir). */
  const ultimoArchivo = (dir: string, re: RegExp) => {
    try {
      return readdirSync(dir).filter((f) => re.test(f)).sort().at(-1)
    } catch {
      return undefined
    }
  }

  /**
   * ffmpeg se quedó colgado o se cayó: se relanza con la misma entrada y la numeración sigue donde iba
   * (`-segment_start_number`). El buffer y la transcripción no se tocan; solo se pierden los segundos que
   * tarda en volver a conectar. El último `.ts`/`.wav` quedaron a medio escribir al morir: fuera, que un
   * segmento truncado no entre al concat ni un WAV cortado corrompa el corrimiento de la voz.
   */
  function relanzar(v: Vivo) {
    if (!v.elegido.video || v.estado === 'cerrado' || v.estado === 'error' || v.estado === 'terminado') return
    // Primero se mata ffmpeg (en Windows no se puede borrar el archivo que tiene abierto; `esperar` espera al
    // taskkill para que los mangos se suelten antes de limpiar) y después se quitan los restos del trozo a medio escribir.
    if (v.ffmpeg) {
      matarArbol(v.ffmpeg, true)
      v.ffmpeg = undefined
    }
    const ts = ultimoArchivo(v.buffer, /^seg-\d+\.ts$/)
    if (ts && !v.segmentos.has(ts)) borrar(join(v.buffer, ts))
    const w = ultimoArchivo(v.vozDir, /^voz-\d+\.wav$/)
    if (w) {
      const ruta = join(v.vozDir, w)
      if (!v.colaVoz.some((c) => c.wav === ruta) && v.procesandoVoz !== ruta) {
        v.hechos.add(ruta)
        borrar(ruta)
      }
    }
    v.ultimoAvance = Date.now()
    v.ultimoReinicio = v.ultimoAvance
    lanzarFfmpeg(v, v.elegido)
  }

  /** El transcriptor persistente (`en_vivo.py`): Whisper/Parakeet del Python de Hermit, de uno en uno. */
  function lanzarTranscriptor(v: Vivo) {
    const py = rutaPythonHermit()
    const script = join(app, 'skills', 'video-base', 'scripts', 'en_vivo.py')
    if (!py || !existsSync(script)) {
      v.vozOk = false
      return emitir()
    }
    const p = spawn(py, [...BANDERAS, script], { windowsHide: true })
    v.transcriptor = p
    v.vozEspera = Date.now()
    p.on('spawn', () => {
      v.vozOk = true
      emitir()
    })
    let buffer = ''
    // El stderr hay que leerlo siempre: si se llena su cola, el transcriptor se bloquea escribiendo.
    p.stderr?.on('data', (d) => (v.vozLog = (v.vozLog + d).slice(-2000)))
    p.stdout.on('data', (d) => {
      buffer += d
      let i
      while ((i = buffer.indexOf('\n')) >= 0) {
        const linea = buffer.slice(0, i).trim()
        buffer = buffer.slice(i + 1)
        // Solo las líneas JSON son respuestas: cualquier aviso que se cuele no debe gastar un trozo
        // de la cola (un «Esperando…» del turno GPU ya se tomó por respuesta y vacío la transcripción).
        if (linea.startsWith('{')) oirRespuesta(v, linea)
      }
    })
    p.on('error', () => {
      v.vozOk = false
      emitir()
    })
    p.on('close', () => {
      if (v.transcriptor === p) v.transcriptor = undefined
      if (v.estado === 'en-vivo' || v.estado === 'conectando') {
        v.vozOk = false
        emitir()
      }
    })
  }

  /** La respuesta de `en_vivo.py` a un trozo: sus frases, corridas a su segundo dentro de la emisión. */
  function oirRespuesta(v: Vivo, linea: string) {
    const trozo = v.procesandoVoz
    v.procesandoVoz = undefined
    v.vozEspera = Date.now()
    v.vozReinicios = 0 // una respuesta, aunque sea de error, prueba que el transcriptor vive
    if (trozo) {
      try {
        const r = JSON.parse(linea)
        if (r.ok) {
          // El corrimiento del trozo es el que `siguienteVoz` guardó al lanzarlo (`vozDesdeActual`): el WAV ya
          // salió de `colaVoz`, así que buscarlo ahí siempre daba 0 y las frases se veían como si cada trozo
          // empezara la emisión.
          const desde = v.vozDesdeActual
          for (const s of r.segmentos ?? []) {
            if (s.text?.trim()) v.transcript.push({ start: desde + (s.start ?? 0), end: desde + (s.end ?? 0), text: String(s.text).trim() })
          }
          emitirTexto()
        }
      } catch {}
      // Marcado antes de borrar: si el archivo sigue abierto un instante, `paso` no lo vuelve a transcribir.
      v.hechos.add(trozo)
      borrar(trozo)
    }
    siguienteVoz(v)
  }

  /** El siguiente WAV en espera entra al transcriptor (de uno en uno: la GPU no admite más). */
  function siguienteVoz(v: Vivo) {
    if (v.procesandoVoz || !v.transcriptor || v.estado === 'cerrado' || !v.colaVoz.length) return
    const t = v.colaVoz.shift()!
    v.procesandoVoz = t.wav
    v.vozDesdeActual = t.desde
    try {
      v.transcriptor.stdin!.write(JSON.stringify({ wav: t.wav }) + '\n')
    } catch {
      v.procesandoVoz = undefined
      v.vozOk = false
      emitir()
    }
  }

  /** Un WAV recién cortado por ffmpeg: se anota su corrimiento y entra a la cola del transcriptor. */
  function oirTrozo(v: Vivo, wav: string, offset: number) {
    v.colaVoz.push({ wav, desde: offset })
    siguienteVoz(v)
  }

  /** Mira el buffer y la voz: segmentos nuevos, el anillo que se poda y los WAV que esperan transcripción. */
  function paso(v: Vivo) {
    // «terminado» también drena la voz: los últimos trozos del live se terminan de transcribir.
    if (v.estado !== 'en-vivo' && v.estado !== 'conectando' && v.estado !== 'terminado') return
    const ahora = Date.now()
    // El vivo sano: si en 45 s no llegó ni un archivo, ffmpeg está colgado (stream caído a medias) y se
    // relanza solo; si en 90 s no arrancó ni el primero, se rinde con un motivo claro.
    if (v.estado === 'en-vivo' && ahora - v.ultimoAvance > SILENCIO_MS) {
      if (v.reinicios >= MAX_REINICIOS) return fallar(v, 'El live no se sostiene: el stream se corta cada vez que se reconecta.')
      v.reinicios++
      return relanzar(v)
    }
    if (v.estado === 'conectando' && ahora - v.inicio > ARRANQUE_MS && v.segmentos.size === 0) {
      return fallar(v, 'El live no empezó a dar imagen: el stream no suelta datos (¿se cayó o cambió la emisión?).')
    }
    // El transcriptor mudo: un trozo que lleva >2 min sin respuesta tiene el Whisper/Parakeet atascado
    // (carga de modelo o turno de GPU). Se relanza con el trozo de vuelta a la cola; tres veces seguidas
    // y la voz se da por perdida (la página lo dice con «sin transcripción»).
    if (v.procesandoVoz && ahora - v.vozEspera > 120_000) {
      const trozo = v.procesandoVoz
      v.procesandoVoz = undefined
      v.colaVoz.unshift({ wav: trozo, desde: v.vozDesdeActual })
      if (v.transcriptor) {
        matarArbol(v.transcriptor)
        v.transcriptor = undefined
      }
      if (v.vozReinicios >= 3) {
        v.vozOk = false
        v.vozReinicios = 0
        return emitir()
      }
      v.vozReinicios++
      return lanzarTranscriptor(v)
    }
    // Los segmentos de video: el último puede seguir escribiéndose (su mtime es de hace un instante): no se toca.
    let toco = false
    try {
      const ts = readdirSync(v.buffer).filter((f) => /^seg-\d+\.ts$/.test(f)).sort()
      for (const f of ts) {
        const ruta = join(v.buffer, f)
        const st = statSync(ruta, { throwIfNoEntry: false })
        if (!st || v.segmentos.has(f) || ahora - st.mtimeMs < 2500) continue
        const { dur } = sonda(ruta)
        if (dur > 0) {
          v.segmentos.set(f, dur)
          toco = true
        }
      }
      // El anillo: solo los últimos VENTANA_SEG; lo viejo se borra para no llenar el disco en un live largo.
      const orden = [...v.segmentos.keys()].sort()
      for (const f of orden.slice(0, Math.max(0, orden.length - VENTANA_SEG))) {
        borrar(join(v.buffer, f))
        v.segmentos.delete(f)
      }
    } catch {}
    if (toco && v.estado === 'conectando') {
      v.estado = 'en-vivo'
      emitir()
    } else if (toco) {
      emitir()
    }
    // Los trozos de voz: cada WAV nuevo se mide y se apunta a su segundo de la emisión.
    try {
      const wavs = readdirSync(v.vozDir).filter((f) => /^voz-\d+\.wav$/.test(f)).sort()
      for (const f of wavs) {
        const ruta = join(v.vozDir, f)
        const st = statSync(ruta, { throwIfNoEntry: false })
        if (!st || ahora - st.mtimeMs < 2500) continue
        if (v.colaVoz.some((c) => c.wav === ruta) || v.procesandoVoz === ruta || v.hechos.has(ruta)) continue
        const { dur } = sonda(ruta)
        if (dur <= 0) continue
        oirTrozo(v, ruta, v.offsetVoz)
        v.offsetVoz += dur
        toco = true // la voz también es avance: un live solo hablado no debe relanzar ffmpeg
      }
    } catch {}
    if (toco) {
      v.ultimoAvance = ahora
      // Cinco minutos de ritmo sano y el contador de relanzamientos vuelve a cero: un live largo puede
      // tener sus tropiezos sin que el tope de «se corta siempre» lo mate.
      if (v.reinicios > 0 && ahora - v.ultimoReinicio > 300_000) v.reinicios = 0
    }
  }

  /** Los `n` últimos segmentos completos del buffer, listos para el concat de la ventana. */
  function ventana(v: Vivo, segundos: number): { lista: string; durs: number[] } | null {
    const orden = [...v.segmentos.entries()].sort(([a], [b]) => a.localeCompare(b))
    const n = planVentana(orden.map(([, d]) => d), segundos)
    if (!n || n > orden.length) return null
    const trozos = orden.slice(-n)
    const lista = join(v.proyecto, 'concat.txt')
    writeFileSync(lista, trozos.map(([f]) => `file '${join(v.buffer, f).replaceAll('\\', '/')}'`).join('\n') + '\n')
    return { lista, durs: trozos.map(([, d]) => d) }
  }

  /** Corta la ventana del buffer y deja `fuente-<n>.mp4` listo para `hacer.py`, con sus tiempos en `cortes.json`. */
  function prepararFuente(v: Vivo, pedido: PedidoClip): { fuente: string; desde: number; hasta: number } | { error: string } {
    const w = ventana(v, pedido.segundos)
    if (!w) return { error: `El buffer aún no cubre ${pedido.segundos} s de live: espera a que pasen y vuelve a pedirlo.` }
    const nombre = `fuente-${v.proximo}.mp4`
    const salida = join(v.proyecto, nombre)
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-v', 'error', '-f', 'concat', '-safe', '0',
      '-i', w.lista, '-map', '0:v:0?', '-map', '0:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
      '-movflags', '+faststart', salida], { encoding: 'utf8' })
    if (r.status !== 0 || !existsSync(salida)) {
      return { error: `No pude juntar los segmentos del buffer: ${(r.stderr || '').trim().split('\n').at(-1) ?? ''}` }
    }
    // El concat puede empezar donde empezó el live (pts grandes): `cortes.json` mide desde 0, así que se corre
    // el inicio a cero con una segunda pasada de copia (rápida: no re-codifica).
    let s = sonda(salida)
    if (s.inicio > 0.05) {
      const corrido = salida.replace(/\.mp4$/, '.corr.mp4')
      const r2 = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-v', 'error', '-i', salida,
        '-map', '0:v:0?', '-map', '0:a:0?', '-c', 'copy', '-output_ts_offset', `-${s.inicio.toFixed(3)}`, '-movflags', '+faststart', corrido], { encoding: 'utf8' })
      if (r2.status === 0 && existsSync(corrido)) {
        borrar(salida)
        renameSync(corrido, salida)
        s = sonda(salida)
      }
    }
    // Sin audio no hay clip: la transcripción y el masterizado lo necesitan. Mejor decirlo que dejar que
    // `hacer.py` caiga en `masterizar.mjs` con un «map 0:a:0» sin pistas.
    if (!hayAudio(salida)) return { error: 'El live no está trayendo audio en este tramo: sin voz no hay subtítulos ni sonido para el clip.' }
    const total = s.dur
    const hasta = total - COLA_CLIP
    const desde = Math.max(0, hasta - pedido.segundos)
    if (hasta - desde < MIN_CLIP) return { error: `La ventana salió demasiado corta (${(hasta - desde).toFixed(1)} s): pide menos segundos.` }
    return { fuente: nombre, desde, hasta }
  }

  /** Escribe el `cortes.json` del clip y lanza `hacer.py` de video-clips, contando su avance en la fila del clip. */
  function lanzarRender(v: Vivo, clip: ClipVivo) {
    const dir = carpetaSkill('video-clips') ?? join(app, 'skills', 'video-clips')
    const script = join(dir, 'scripts', 'hacer.py')
    const py = rutaPythonHermit()
    const proc = spawn(py ?? 'python', [...(py ? BANDERAS : []), '-I', '-B', '-X', 'utf8', script, '--en', v.proyecto], { windowsHide: true })
    let salida = ''
    let errout = ''
    proc.stdout.on('data', (d) => {
      salida += d
      const linea = salida.trim().split('\n').filter((l) => l.trim()).at(-1) ?? ''
      if (linea && linea !== clip.detalle) {
        clip.detalle = linea.slice(0, 140)
        emitir()
      }
    })
    proc.stderr.on('data', (d) => (errout = (errout + d).slice(-2000)))
    proc.on('error', (e) => {
      clip.estado = 'error'
      clip.error = `No pude lanzar el render: ${e.message}`
      emitir()
      seguirCola(v)
    })
    proc.on('close', (c) => {
      if (c === 0) {
        const esperado = join(v.proyecto, 'out', 'redes', `1-${clip.nombre}.mp4`)
        if (existsSync(esperado)) {
          clip.estado = 'listo'
          clip.archivo = esperado
        } else {
          clip.estado = 'error'
          clip.error = 'El render terminó pero no apareció el mp4 en out/redes/.'
        }
      } else {
        clip.estado = 'error'
        clip.error = `hacer.py falló: ${salida.trim().split('\n').filter((l) => l.trim()).slice(-3).join(' · ') || errout.trim().split('\n').at(-1) || `salió con ${c}`}`.slice(0, 300)
      }
      emitir()
      seguirCola(v)
    })
  }

  /** Suelta renders de la cola hasta MAX_RENDERS_CLIPS a la vez: los clips salen de dos en dos. */
  function seguirCola(v: Vivo) {
    if (v.estado === 'cerrado') return emitir()
    while (v.clips.filter((c) => c.estado === 'renderizando').length < MAX_RENDERS_CLIPS) {
      const clip = v.clips.find((c) => c.estado === 'cola')
      if (!clip) break
      void renderizar(v, clip)
    }
    v.renderizando = v.clips.some((c) => c.estado === 'renderizando')
    emitir()
  }

  async function renderizar(v: Vivo, clip: ClipVivo) {
    v.renderizando = true
    clip.estado = 'renderizando'
    clip.detalle = 'Preparando la fuente…'
    emitir()
    // Un fallo de disco aquí no debe tumbar el servidor: el clip queda en error y sigue la cola.
    let prep: ReturnType<typeof prepararFuente>
    try {
      prep = prepararFuente(v, clip.pedido)
    } catch (e) {
      prep = { error: `No pude preparar la fuente del clip: ${e instanceof Error ? e.message : e}` }
    }
    if ('error' in prep) {
      clip.estado = 'error'
      clip.error = prep.error
      emitir()
      return seguirCola(v)
    }
    const p = clip.pedido
    // La portada sin título propio toma el del live (o el del canal), recortado: «clip-01» a secas no le
    // dice nada a nadie. Si el live no trae título ni canal, `hacer.py` cae a su propio respaldo.
    const propio = p.portadaTitulo?.trim()
    // Sin título propio, la portada toma el del live ya limpio de su fecha-hora («Bienvenidas 2026-11-19
    // 22:17» → «Bienvenidas»); si el título era solo la fecha, cae al canal.
    const delLive = [limpiarTituloLive(v.titulo), v.canal].map((t) => t?.trim()).find(Boolean)?.split(/\s+/).slice(0, 6).join(' ')
    const portadaTitulo = propio || delLive
    const corte = {
      desde: prep.desde,
      hasta: prep.hasta,
      nombre: clip.nombre,
      ...(p.gancho && { gancho: p.gancho }),
      subtitulos: p.subtitulos,
      formato: p.formato,
      ...(portadaTitulo && { portada_titulo: portadaTitulo }),
      ...(p.acento && { acento: p.acento }),
      ...(p.portadaResaltar && { portada_resaltar: p.portadaResaltar }),
      ...(p.portadaFuente && { portada_fuente: p.portadaFuente }),
      ...(p.reencuadre && { reencuadre: p.reencuadre })
    }
    try {
      guardar(join(v.proyecto, 'cortes.json'), JSON.stringify({ fuente: prep.fuente, formato: p.formato, cortes: [corte] }, null, 1))
    } catch (e) {
      clip.estado = 'error'
      clip.error = `No pude escribir cortes.json: ${e instanceof Error ? e.message : e}`
      emitir()
      return seguirCola(v)
    }
    clip.detalle = 'Renderizando…'
    emitir()
    lanzarRender(v, clip)
  }

  function fallar(v: Vivo, error: string) {
    if (v.estado === 'cerrado' || v.estado === 'error') return
    v.estado = 'error'
    v.error = error
    matar(v)
    emitir()
  }

  function matar(v: Vivo) {
    for (const p of [v.ffmpeg, v.transcriptor]) if (p) matarArbol(p)
    v.ffmpeg = v.transcriptor = undefined
  }

  /** Cierra el live: mata sus procesos y borra el buffer y la voz (los clips y fuentes se quedan). */
  function cerrar() {
    const v = vivo
    if (!v) return
    vivo = null
    clearInterval(ticker)
    ticker = undefined
    if (v.estado !== 'error') v.estado = 'cerrado'
    matar(v)
    // Los clips que aún esperaban su turno ya no salen; el que se está renderizando termina y cae en out/redes.
    for (const c of v.clips) {
      if (c.estado === 'cola') {
        c.estado = 'error'
        c.error = 'El live se cerró antes de renderizarlo.'
      }
    }
    // El buffer y la voz son puro trabajo temporal; los clips y sus fuentes se quedan en el proyecto.
    try {
      rmSync(v.buffer, { recursive: true, force: true })
      rmSync(v.vozDir, { recursive: true, force: true })
    } catch {}
    broadcast({ type: 'envivo', vivo: null })
  }

  async function conectar(url: string): Promise<VivoEstado | { error: string }> {
    if (vivo && (vivo.estado === 'conectando' || vivo.estado === 'en-vivo')) {
      return { error: 'Ya hay un live abierto: ciérralo antes de conectar otro.' }
    }
    cerrar()
    // yt-dlp: hasta 3 intentos antes de rendirse — los lives de TikTok (y alguna otra plataforma) fallan
    // al primer golpe aunque emitan y conectan al reintentar. El 2.º intento usa el cliente de reserva de
    // YouTube (pide login desde octubre de 2026); los fallos definitivos no gastan reintentos.
    // La URL va limpia: los parámetros de share de TikTok hacen fallar su extractor aunque el live emita.
    const limpia = limpiarUrlLive(url)
    let r: { info?: any; error?: string } = {}
    for (let intento = 0; intento < 3; intento++) {
      const args = intento === 1 ? ['--extractor-args', 'youtube:player_client=web_embedded'] : []
      r = await ytdlpInfo(limpia, args)
      if (r.info || !esReintentableLive(r.error)) break
      if (intento < 2) await new Promise((res) => setTimeout(res, 2500))
    }
    let info = r.info
    // TikTok responde a veces su página de verificación (WAF) en vez del directo aunque emita, y yt-dlp
    // la toma por «not currently live». Plan B: leer el roomId con un Chromium real y entrar por la URL
    // share de la sala, que va directo a su API sin scrapear la página protegida.
    if (!info && esReintentableLive(r.error) && esLiveTikTok(limpia)) {
      const roomId = await roomIdTikTok(limpia)
      if (roomId) {
        for (let intento = 0; intento < 2 && !info; intento++) {
          if (intento) await new Promise((res) => setTimeout(res, 2000))
          r = await ytdlpInfo(`https://m.tiktok.com/share/live/${roomId}`)
          info = r.info
        }
      }
    }
    if (!info) return { error: r.error ?? 'No pude leer ese directo: inténtalo de nuevo.' }
    // Solo emisiones en directo: un VOD o «a punto de empezar» no tiene borde vivo que grabar.
    const estadoLive = info.live_status ?? (info.is_live ? 'is_live' : undefined)
    if (estadoLive === 'is_upcoming') return { error: 'Ese live aún no ha empezado: vuelve cuando esté emitiendo.' }
    if (estadoLive !== 'is_live') return { error: 'Esa URL no es un live ahora mismo (o no se pudo confirmar). Prueba con la del directo.' }
    const elegido = elegirStreams(info)
    if (!elegido.video) {
      return { error: elegido.audio ? 'Ese live solo trae audio: no hay imagen para los clips.' : 'El live no soltó ninguna entrada que FFmpeg pueda leer (¿DRM o un formato raro?).' }
    }
    // Pistas separadas = pipelines distintos: el audio puede llegar segundos antes que el vídeo (pasa en
    // TikTok, donde el audio es un FLV casi en vivo y el vídeo un HLS con cola). Si el live también suelta
    // un formato muxado (video y audio en la misma entrada), se prefiere: una sola descarga y la imagen y
    // el sonido nacen del mismo reloj, sin compensar nada. Si no hay, se retrasa el audio lo que el vídeo
    // tarda en llegar, medido del manifiesto (el FLV se estima ~1 s más nuevo).
    if (elegido.audio && elegido.audio !== elegido.video) {
      const mux = await muxadoConAudio(info, elegido)
      if (mux) {
        elegido.video = mux.url
        elegido.audio = undefined
        elegido.conAudio = true
        elegido.vHeaders = mux.http_headers
        elegido.aHeaders = undefined
        elegido.audioDelayMs = undefined
      } else {
        const edad = await latenciaBordeMs(elegido.video, elegido.vHeaders)
        const retardo = edad - 1000
        if (retardo >= 500) elegido.audioDelayMs = retardo
      }
    }
    const titulo = String(info.title ?? info.id ?? url).slice(0, 120)
    // El id al final: dos lives del mismo título en el mismo minuto no comparten carpeta (cada uno conserva sus clips).
    const proyecto = join(carpetaTrabajo(app), 'video-clips', `${slugEnVivo(titulo, url)}-${randomUUID().slice(0, 4)}`)
    mkdirSync(join(proyecto, 'buffer'), { recursive: true })
    mkdirSync(join(proyecto, 'voz'), { recursive: true })
    mkdirSync(join(proyecto, 'out', 'redes'), { recursive: true })
    const v: Vivo = {
      id: randomUUID().slice(0, 8),
      url,
      titulo,
      canal: info.channel ?? info.uploader,
      estado: 'conectando',
      proyecto,
      buffer: join(proyecto, 'buffer'),
      vozDir: join(proyecto, 'voz'),
      colaVoz: [],
      hechos: new Set(),
      vozDesdeActual: 0,
      vozEspera: Date.now(),
      vozReinicios: 0,
      offsetVoz: 0,
      transcript: [],
      textoEnviado: 0,
      vozOk: false,
      vozLog: '',
      segmentos: new Map(),
      clips: [],
      renderizando: false,
      proximo: 1,
      errores: '',
      elegido,
      inicio: Date.now(),
      ultimoAvance: Date.now(),
      reinicios: 0,
      ultimoReinicio: 0
    }
    vivo = v
    lanzarFfmpeg(v, elegido)
    lanzarTranscriptor(v)
    ticker ??= setInterval(() => vivo && paso(vivo), PASO_MS)
    ticker.unref?.()
    emitir()
    return publico(v)
  }

  function pedirClip(b: Record<string, unknown>): { error?: string } {
    const v = vivo
    if (!v || (v.estado !== 'en-vivo' && v.estado !== 'conectando' && v.estado !== 'terminado')) {
      return { error: 'No hay un live grabando: conecta uno primero.' }
    }
    const segundos = Number(b.segundos)
    if (!Number.isFinite(segundos) || segundos < MIN_CLIP || segundos > MAX_CLIP) return { error: `La duración del clip va de ${MIN_CLIP} a ${MAX_CLIP} segundos.` }
    const formato = b.formato === 'horizontal' ? 'horizontal' : 'vertical'
    const subtitulos = String(b.subtitulos ?? 'minimal')
    if (!SUBTILOS.has(subtitulos)) return { error: `El estilo de subtítulos «${subtitulos}» no existe.` }
    const acento = b.acento ? String(b.acento).trim().toLowerCase() : undefined
    if (acento && !ACENTOS.has(acento) && !/^#[0-9a-f]{6}$/i.test(acento)) return { error: 'El acento es un color de la lista o un #RRGGBB.' }
    const portadaFuente = b.portadaFuente ? String(b.portadaFuente).trim().toLowerCase() : undefined
    if (portadaFuente && !PORTADA_FUENTES.has(portadaFuente)) return { error: 'Esa letra de portada no existe.' }
    const reencuadre = b.reencuadre ? String(b.reencuadre).trim().toLowerCase() : undefined
    if (reencuadre && !REENCUADRES.has(reencuadre)) return { error: 'Ese reencuadre no existe.' }
    const texto = (k: string, max: number) => {
      const t = b[k] ? String(b[k]).trim().slice(0, max) : undefined
      return t || undefined
    }
    const pedido: PedidoClip = {
      segundos,
      formato,
      subtitulos,
      acento,
      portadaTitulo: texto('portadaTitulo', 60),
      gancho: texto('gancho', 80),
      portadaResaltar: texto('portadaResaltar', 40),
      portadaFuente,
      reencuadre
    }
    if (v.clips.filter((c) => c.estado === 'cola' || c.estado === 'renderizando').length >= MAX_COLA_CLIPS) {
      return { error: `Ya hay ${MAX_COLA_CLIPS} clips en cola: espera a que salgan.` }
    }
    const clip: ClipVivo = {
      id: randomUUID().slice(0, 8),
      nombre: `clip-${String(v.proximo++).padStart(2, '0')}`,
      estado: 'cola',
      formato,
      t: Date.now(),
      pedido
    }
    v.clips.push(clip)
    emitir()
    void atenderCola(v)
    return {}
  }

  /** Encola el render del clip: entra en marcha si hay sitio (MAX_RENDERS_CLIPS a la vez). */
  function atenderCola(v: Vivo) {
    if (v.estado === 'cerrado') return
    seguirCola(v)
  }

  /** La lista HLS del buffer para la vista previa: una ventana deslizante de los segmentos completos, como un live local. */
  function playlistHls(v: Vivo): string | null {
    const orden = [...v.segmentos.entries()].sort(([a], [b]) => a.localeCompare(b))
    if (!orden.length) return null
    const maxDur = Math.max(...orden.map(([, d]) => d))
    const seq = Number(/^seg-(\d+)\.ts$/.exec(orden[0][0])?.[1] ?? 0)
    const lineas = ['#EXTM3U', '#EXT-X-VERSION:3', `#EXT-X-TARGETDURATION:${Math.ceil(maxDur)}`, `#EXT-X-MEDIA-SEQUENCE:${seq}`]
    // Cada `.ts` se grabó con sus tiempos desde cero (`-reset_timestamps`): todo borde de segmento es una
    // discontinuidad. Sin la marca, hls.js ve el reloj retroceder en cada archivo y el preview se congela.
    orden.forEach(([f, d], i) => {
      if (i > 0) lineas.push('#EXT-X-DISCONTINUITY')
      lineas.push(`#EXTINF:${d.toFixed(3)}`, `/api/en-vivo/seg/${f}`)
    })
    return lineas.join('\n') + '\n'
  }

  return {
    async api(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
      // La vista previa del live, servida del propio buffer: mismo origen (sin CORS) y es lo mismo que se corta.
      if (path === '/api/en-vivo/hls.m3u8' && req.method === 'GET') {
        const lista = vivo ? playlistHls(vivo) : null
        if (!lista) {
          res.writeHead(404)
          res.end()
          return true
        }
        res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-store' })
        res.end(lista)
        return true
      }
      const seg = /^\/api\/en-vivo\/seg\/(seg-\d+\.ts)$/.exec(path)
      if (seg && req.method === 'GET') {
        const archivo = vivo ? join(vivo.buffer, seg[1]) : ''
        if (!archivo || !existsSync(archivo)) {
          res.writeHead(404)
          res.end()
          return true
        }
        res.writeHead(200, { 'content-type': 'video/mp2t', 'cache-control': 'no-store' })
        createReadStream(archivo).pipe(res)
        return true
      }
      if (path === '/api/en-vivo' && req.method === 'GET') {
        return json(res, 200, { vivo: vivo ? { ...publico(vivo), texto: vivo.transcript.slice(-500) } : null })
      }
      if (path === '/api/en-vivo' && req.method === 'POST') {
        const b = await cuerpo<{ url?: string }>(req)
        const url = String(b.url ?? '').trim()
        if (!/^https?:\/\//i.test(url)) return json(res, 400, { error: 'Pega la URL del live (https://…).' })
        const r = await conectar(url)
        // Ojo: `publico()` siempre trae la clave `error` (a veces undefined), así que `'error' in r` no
        // distingue: el éxito se reconoce por tener `id`. Con el `in` a secas, conectar devolvía 400 `{}`
        // y la página pintaba «Bad Request» aunque el live hubiera arrancado bien.
        return 'id' in r ? json(res, 200, r) : json(res, 400, { error: r.error })
      }
      if (path === '/api/en-vivo/cara' && req.method === 'GET') {
        // La posición del reencuadre «quien habla» para la previa: la cara más grande del último
        // frame del buffer, con la misma regla de zona muerta y paneo que usará el render.
        if (!vivo) return json(res, 200, { x: 0.5, y: 0.5 })
        const formato = new URL(req.url ?? '/', 'http://local').searchParams.get('formato') === 'horizontal' ? 'horizontal' : 'vertical'
        const r = await encuadreEnVivo(vivo, formato)
        return json(res, 200, r ?? { x: 0.5, y: 0.5 })
      }
      if (path === '/api/en-vivo/clip' && req.method === 'POST') {
        const b = await cuerpo<Record<string, unknown>>(req)
        const r = pedirClip(b)
        return r.error ? json(res, 400, { error: r.error }) : json(res, 200, { ok: true })
      }
      if (path === '/api/en-vivo/cerrar' && req.method === 'POST') {
        cerrar()
        return json(res, 200, { ok: true })
      }
      return false
    },
    ocupado(): string | null {
      if (vivo?.renderizando) return 'Se está renderizando un clip del live de Clips. Espera a que termine.'
      if (vivo && (vivo.estado === 'conectando' || vivo.estado === 'en-vivo')) return 'Hay un live de Clips grabando. Ciérralo antes de reiniciar.'
      return null
    },
    cerrar
  }
}
