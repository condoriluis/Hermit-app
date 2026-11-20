import { test } from 'node:test'
import assert from 'node:assert/strict'
import { candidatosMuxados, elegirStreams, explicarFalloLive, esLiveTikTok, esReintentableLive, limpiarTituloLive, limpiarUrlLive, pasoPersona, planVentana, sacarRoomId, slugEnVivo, ventanaEncuadre } from './en-vivo.ts'

/** Un formato de yt-dlp como llega en `-j`, con lo que mira elegirStreams. */
const fmt = (o: Record<string, unknown>) => ({
  protocol: 'm3u8_native',
  vcodec: 'none',
  acodec: 'none',
  ...o
}) as any

test('elegirStreams: video y audio separados, una descarga por pista', () => {
  const info = {
    formats: [
      fmt({ url: 'https://x/v.m3u8', vcodec: 'avc1', acodec: 'none', height: 720 }),
      fmt({ url: 'https://x/v2.m3u8', vcodec: 'avc1', acodec: 'none', height: 1080 }),
      fmt({ url: 'https://x/a.m3u8', vcodec: 'none', acodec: 'mp4a' }),
      fmt({ url: 'https://x/m.m3u8', vcodec: 'avc1', acodec: 'mp4a', height: 480, manifest_url: 'https://x/master.m3u8' })
    ]
  }
  const e = elegirStreams(info)
  assert.equal(e.video, 'https://x/v2.m3u8') // el mejor video solo
  assert.equal(e.audio, 'https://x/a.m3u8') // el mejor audio solo
  assert.equal(e.conAudio, false)
  // La vista previa es la lista maestra del mejor formato que la trae.
  assert.equal(e.stream?.url, 'https://x/master.m3u8')
})

test('elegirStreams: solo muxado (Twitch), una entrada con video y audio', () => {
  const info = {
    formats: [
      fmt({ url: 'https://t/mux.m3u8', vcodec: 'avc1', acodec: 'mp4a', height: 720 }),
      fmt({ url: 'https://t/chico.m3u8', vcodec: 'avc1', acodec: 'mp4a', height: 360 })
    ]
  }
  const e = elegirStreams(info)
  assert.equal(e.video, 'https://t/mux.m3u8')
  assert.equal(e.audio, undefined)
  assert.equal(e.conAudio, true)
  // Sin manifest_url ni formato con audio+video distinto, la vista previa usa el url muxado.
  assert.equal(e.stream?.url, 'https://t/mux.m3u8')
})

test('elegirStreams: video solo sin audio se previsualiza igual (mudo)', () => {
  const info = { formats: [fmt({ url: 'https://x/v.m3u8', vcodec: 'avc1', acodec: 'none', height: 1080 })] }
  const e = elegirStreams(info)
  assert.equal(e.video, 'https://x/v.m3u8')
  assert.equal(e.conAudio, false)
  // El HLS de vídeo sí lo reproduce el navegador (mudo); el sonido llega con el buffer local.
  assert.equal(e.stream?.url, 'https://x/v.m3u8')
})

test('elegirStreams: ignora formatos que no son live (http plano sin m3u8)', () => {
  const info = {
    formats: [fmt({ url: 'https://x/v.mp4', protocol: 'https', vcodec: 'avc1', acodec: 'none' })]
  }
  const e = elegirStreams(info)
  assert.equal(e.video, undefined)
  assert.equal(e.stream, null)
})

test('elegirStreams: audio de YouTube con acodec null (pista HLS sin codec declarado)', () => {
  // yt-dlp reporta las pistas de solo audio del live de YouTube con `acodec: null` y `vcodec: 'none'`:
  // son audio aunque el codec no se conozca hasta abrir el manifiesto. Sin verlas, el live se grababa
  // sin sonido y los clips no tenían voz que transcribir.
  const info = {
    formats: [
      fmt({ url: 'https://x/v.m3u8', vcodec: 'avc1', acodec: 'none', height: 720 }),
      fmt({ url: 'https://x/a.m3u8', vcodec: 'none', acodec: null }),
      fmt({ url: 'https://x/a2.m3u8', vcodec: 'none', acodec: null })
    ]
  }
  const e = elegirStreams(info)
  assert.equal(e.video, 'https://x/v.m3u8')
  assert.equal(e.audio, 'https://x/a.m3u8') // la primera de las dos pistas de audio
  assert.equal(e.conAudio, false)
})

test('elegirStreams: TikTok — video en HLS 9:16 y audio en un FLV only_audio mal etiquetado', () => {
  // Salida real de yt-dlp para un live de TikTok: el video es HLS 720x1440 y el audio un FLV aparte que
  // yt-dlp marca con `vcodec: 'h264'` y sin `acodec`. Antes se grababa sin sonido ni transcripción.
  const info = {
    formats: [
      fmt({ url: 'https://tt/flv-ao.flv?only_audio=1', protocol: 'https', format_id: 'flv-ao', ext: 'flv', vcodec: 'h264', acodec: null }),
      fmt({ url: 'https://tt/flv-hd.flv', protocol: 'https', format_id: 'flv-hd', vcodec: 'h264', resolution: '720x1440', tbr: 1000 }),
      fmt({ url: 'https://tt/hls-hd/index.m3u8', protocol: 'm3u8_native', format_id: 'hls-hd', vcodec: 'h264', resolution: '720x1440', tbr: 1000 }),
      fmt({ url: 'https://tt/hls-pull/index.m3u8', protocol: 'm3u8_native', format_id: 'hls-pull', vcodec: 'h264' })
    ]
  }
  const e = elegirStreams(info)
  // El video: el mejor HLS (a igual peso, el m3u8 gana al FLV continuo).
  assert.equal(e.video, 'https://tt/hls-hd/index.m3u8')
  // El audio: el FLV only_audio, aunque yt-dlp lo llame «video».
  assert.equal(e.audio, 'https://tt/flv-ao.flv?only_audio=1')
  assert.equal(e.conAudio, false)
  // La vista previa: el HLS de vídeo (sin sonido hasta que el buffer local junte ambos).
  assert.equal(e.stream?.url, 'https://tt/hls-hd/index.m3u8')
})

test('candidatosMuxados: el FLV de TikTok es candidato, el only_audio no', () => {
  // Con pistas separadas (vídeo HLS + audio FLV = dos pipelines y el sonido adelantado), el servidor
  // busca una entrada que traiga ambos. El FLV del directo de TikTok va muxado aunque yt-dlp diga
  // `acodec: null`; el `only_audio` queda fuera por su marca en la URL.
  const info = {
    formats: [
      fmt({ url: 'https://tt/flv-ao.flv?only_audio=1', protocol: 'https', format_id: 'flv-ao', ext: 'flv', vcodec: 'h264', acodec: null }),
      fmt({ url: 'https://tt/flv-hd.flv', protocol: 'https', format_id: 'flv-hd', vcodec: 'h264' }),
      fmt({ url: 'https://tt/rtmp-pull.flv', protocol: 'https', format_id: 'rtmp-pull', vcodec: 'h264' }),
      fmt({ url: 'https://tt/hls-hd/index.m3u8', protocol: 'm3u8_native', format_id: 'hls-hd', vcodec: 'h264' })
    ]
  }
  const e = elegirStreams(info)
  const cands = candidatosMuxados(info.formats, e).map((f) => f.url)
  assert.deepEqual(cands.sort(), ['https://tt/flv-hd.flv', 'https://tt/rtmp-pull.flv'].sort())
})

test('limpiarUrlLive: quita el tracking de TikTok /live y conserva el resto', () => {
  // Los enlaces compartidos de TikTok traen ?_r=1&enter_from… y su extractor responde «not currently live»
  // con el directo emitiendo. En /@canal/live no hace falta ningún parámetro.
  assert.equal(
    limpiarUrlLive('https://www.tiktok.com/@continental_group_ada/live?_r=1&enter_from_merge=pc_share'),
    'https://www.tiktok.com/@continental_group_ada/live'
  )
  // Otras rutas de TikTok y otras plataformas conservan sus parámetros.
  assert.equal(
    limpiarUrlLive('https://www.tiktok.com/@user/video/123?_r=1'),
    'https://www.tiktok.com/@user/video/123?_r=1'
  )
  assert.equal(
    limpiarUrlLive('https://www.youtube.com/watch?v=abc&si=xyz'),
    'https://www.youtube.com/watch?v=abc&si=xyz'
  )
})

test('limpiarTituloLive: quita la fecha-hora del final, de cualquier plataforma', () => {
  // El caso real de TikTok: la plataforma agrega «aaaa-mm-dd hh:mm» al título del directo.
  assert.equal(limpiarTituloLive('Bienvenidas Caseritas😊🌸 2026-11-19 22:17'), 'Bienvenidas Caseritas😊🌸')
  assert.equal(limpiarTituloLive('Lets Go LIVE! 2026-11-19 22:17'), 'Lets Go LIVE!')
  // Otras formas de fecha al final, con su separador.
  assert.equal(limpiarTituloLive('Charla nocturna · 19/11/2026 22:17'), 'Charla nocturna')
  assert.equal(limpiarTituloLive('Show - November 19, 2026'), 'Show')
  assert.equal(limpiarTituloLive('Directo 19 de noviembre de 2026 a las 22:17'), 'Directo')
  assert.equal(limpiarTituloLive('Noche de confidencias | 19.11.2026'), 'Noche de confidencias')
  // Solo fecha, o fecha-hora ISO con T y segundos.
  assert.equal(limpiarTituloLive('Episode 42 — 2026-11-19'), 'Episode 42')
  assert.equal(limpiarTituloLive('Top cien 2026-11-19T22:17:30'), 'Top cien')
  // Hora suelta con a.m./p.m. también sale; sin marca, un «22:17» del título se conserva.
  assert.equal(limpiarTituloLive('En vivo 10:30 PM'), 'En vivo')
  assert.equal(limpiarTituloLive('Maratón 22:17'), 'Maratón 22:17')
  // Lo que no es fecha-hora no se toca: años sueltos, números, títulos normales.
  assert.equal(limpiarTituloLive('Top 10 de 2026'), 'Top 10 de 2026')
  assert.equal(limpiarTituloLive('Charlas con Luis: Ep. 42'), 'Charlas con Luis: Ep. 42')
  assert.equal(limpiarTituloLive('2026-11-19'), '')
  assert.equal(limpiarTituloLive(''), '')
})

test('planVentana: del segmento más nuevo hacia atrás hasta cubrir el clip + margen', () => {
  // 10 segmentos de 8 s: un clip de 30 s pide 30+8=38 s → 5 segmentos (40 s).
  assert.equal(planVentana(Array(10).fill(8), 30), 5)
  // 15 s → 23 s → 3 segmentos (24 s).
  assert.equal(planVentana(Array(10).fill(8), 15), 3)
  // Sin segmentos no hay ventana.
  assert.equal(planVentana([], 30), 0)
})

test('slugEnVivo: fecha, título limpio y fallback a la URL', () => {
  const s = slugEnVivo('Charlas con Luis: Ep. 42', 'https://youtube.com/watch?v=abc', new Date(2026, 9, 7, 15, 30))
  assert.match(s, /^en-vivo-1007-1530-charlas-con-luis-ep-42$/)
  const yt = slugEnVivo('', 'https://youtu.be/dQw4w9WgXcQ', new Date(2026, 0, 2, 3, 4))
  assert.match(yt, /-dQw4w9WgXcQ$/)
})

test('explicarFalloLive: los fallos de yt-dlp se dicen claros', () => {
  assert.match(explicarFalloLive('ERROR: [tiktok:live] lalos_room: The channel is not currently live'), /terminó o todavía no empieza/)
  assert.match(explicarFalloLive('ERROR: This livestream has ended'), /terminó o todavía no empieza/)
  assert.match(explicarFalloLive('ERROR: This video is private'), /privado/)
  assert.match(explicarFalloLive('ERROR: Sign in to confirm your age'), /iniciar sesión/)
  assert.match(explicarFalloLive('ERROR: This live event will begin in 2 hours'), /terminó o todavía no empieza/)
  assert.match(explicarFalloLive('ERROR: HTTP Error 404: Not Found'), /caducó/)
  assert.match(explicarFalloLive('WARNING algo\nERROR: HTTP Error 403: Forbidden captcha challenge'), /verificación/)
  assert.match(explicarFalloLive('ERROR: Unsupported URL: https://x.com/raro'), /No reconozco ese enlace/)
  assert.match(explicarFalloLive('ERROR: _ssl.c:999: The handshake operation timed out'), /tardó demasiado/)
  assert.match(explicarFalloLive('un fallo que nadie previó'), /No pude leer ese directo: un fallo/)
})

test('esReintentableLive: lo pasajero reintenta, lo definitivo no', () => {
  // El caso real: TikTok dice «not currently live» con el directo emitiendo — se reintenta.
  assert.equal(esReintentableLive('Ese directo ya terminó o todavía no empieza. Cuando esté emitiendo, vuelve a pegar el enlace.'), true)
  assert.equal(esReintentableLive('La plataforma está pidiendo verificación: espera un momento y vuelve a intentarlo.'), true)
  assert.equal(esReintentableLive('El directo tardó demasiado en responder: puede que esté caído o saturado. Inténtalo de nuevo.'), true)
  // Definitivos: repetir el pedido no cambia la respuesta.
  assert.equal(esReintentableLive('Ese contenido es privado o no listado: no se puede leer.'), false)
  assert.equal(esReintentableLive('Esa plataforma pide iniciar sesión o ser miembro para ver el directo.'), false)
  assert.equal(esReintentableLive('Ese directo está protegido y no se puede grabar.'), false)
  assert.equal(esReintentableLive('El enlace no existe o ya caducó: cópialo de nuevo desde el directo.'), false)
  assert.equal(esReintentableLive('No reconozco ese enlace como directo. Prueba con la dirección de la emisión (la que abre el reproductor del live).'), false)
  assert.equal(esReintentableLive(undefined), false)
})

test('esLiveTikTok: solo las URL de live con canal, no la share ni los videos', () => {
  assert.equal(esLiveTikTok('https://www.tiktok.com/@jhenny_calle/live'), true)
  assert.equal(esLiveTikTok('https://www.tiktok.com/@jhenny_calle/live?lang=es'), true)
  assert.equal(esLiveTikTok('https://m.tiktok.com/@canal.oficial/live/'), true)
  assert.equal(esLiveTikTok('https://m.tiktok.com/share/live/7710068128935398150'), false) // ya trae el roomId
  assert.equal(esLiveTikTok('https://www.tiktok.com/@jhenny_calle/video/123'), false)
  assert.equal(esLiveTikTok('https://www.youtube.com/watch?v=abc'), false)
})

test('sacarRoomId: del JSON embebido o de la URL del reproductor', () => {
  assert.equal(sacarRoomId('<script>"roomId":"7710068128935398150","title":"x"</script>'), '7710068128935398150')
  assert.equal(sacarRoomId('"roomId": 7710068128935398150,'), '7710068128935398150')
  assert.equal(sacarRoomId('pull.flv?room_id=7710068128935398150&sig=1'), '7710068128935398150')
  assert.equal(sacarRoomId('<html>sin datos</html>'), null)
  assert.equal(sacarRoomId('"roomId":"123"'), null) // muy corto para ser un roomId real
})

test('ventanaEncuadre: la ventana del formato dentro de la fuente, como encuadre.py', () => {
  // Fuente 16:9 → clip 9:16: todo el alto, panea en X.
  const v = ventanaEncuadre(1920, 1080, 'vertical')
  assert.equal(v.eje, 'x')
  assert.equal(v.h, 1080)
  assert.equal(v.w, 608) // 1080 * 9/16 = 607,5 → redondeado a par
  assert.equal(v.maxX, 1920 - 608)
  assert.equal(v.maxY, 0)
  // Fuente 9:16 → clip 16:9: todo el ancho, panea en Y.
  const h = ventanaEncuadre(1080, 1920, 'horizontal')
  assert.equal(h.eje, 'y')
  assert.equal(h.w, 1080)
  assert.equal(h.h, 608)
  assert.equal(h.maxX, 0)
  assert.equal(h.maxY, 1920 - 608)
})

test('pasoPersona: zona muerta, paneo limitado y cámara quieta sin cara', () => {
  const sw = 1920, sh = 1080
  const centro = { x: 960, y: 540 }
  const v = ventanaEncuadre(sw, sh, 'vertical')
  const inicio = { x: v.maxX / 2, y: 0, suave: null, t: 0 }
  // Cara dentro de la zona muerta (ventana 608 centrada en 656..1264; cara en 960): no se mueve.
  const quieto = pasoPersona(inicio, centro, sw, sh, 'vertical', 1000)
  assert.equal(quieto.x, inicio.x)
  // Cara lejos a la derecha (1700): fuera de la zona muerta → el crop avanza hacia ella, sin saltar.
  const lejos = pasoPersona(inicio, { x: 1700, y: 540 }, sw, sh, 'vertical', 2000)
  assert.ok(lejos.x > inicio.x, 'el crop persigue a la cara')
  assert.ok(lejos.x - inicio.x <= 1.2 * v.w * 1.1, 'el paneo no excede su velocidad')
  // Sin cara en la muestra siguiente: la cámara se queda donde estaba.
  const sinCara = pasoPersona(lejos, null, sw, sh, 'vertical', 4000)
  assert.equal(sinCara.x, lejos.x)
  assert.equal(sinCara.suave, lejos.suave)
})
