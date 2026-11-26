import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Marcas, Model, Previa, Serie, SessionMeta, VideoHecho } from '../../shared/types'
import { esDeVideo } from '../../shared/types'
import { api } from './api'
import { CuentaClaude, Requisitos, useCuentasConectadas, useSinClaude } from './Opciones'
import { AvisoEquipo } from './Equipo' // tu equipo
import { VideoDe } from './MisVideos'
import { Rejilla } from './Piezas'
import { YoutubeLote } from './YoutubeProgramar'
import { CalendarioYoutube } from './YoutubeCalendario'
import { TusCambios } from './TusCambios'
import { TarjetasEnlaces } from './Enlaces' // tarjeta de los enlaces
import { Confirm } from './Confirm'
import { Composer, Icon, Picker, type Draft } from './Composer'
import { Segmento } from './Segmento'
import { nombreDeVoz, SelectorVoz, useVoz, vozPosible } from './Voz' // voz de AI Studio, Fish Audio o ElevenLabs
import { lineaMusica, lineaVoz } from '../../shared/voz'
import { SelectorClips, SelectorImagenes, useChatGPT, useFlow } from './Flow' // Google Flow
import { imagenPosible, lineaClips, lineaImagenes, OPCIONES_CLIPS } from '../../shared/flow'
import { useSoltar } from './Soltar'
import { usePublicar } from './Redes' // redes
import { CON_CHATGPT, conOpenCode, conPrimero, elegirModelos, lineaSubagentes, Modelos, type Avanzado } from './Modelos'
import { elegidoAMano, enlacesDe, formatoReal, FORMATOS_ENCUEADRE, FORMATOS_IMAGEN, lastChoice, useStored } from './AppBase'
import { Carteles, type AccionesCartel } from './AppEstante'

/**
 * Los videos terminados de un estilo, de sus hilos y de las carpetas de fuera que nombra la card. Se vuelven a pedir cuando
 * avanza uno de sus hilos. `null` mientras se mira.
 */
function useTerminados(card: Card | null, hilos: SessionMeta[]) {
  const [videos, setVideos] = useState<VideoHecho[] | null>(null)
  const [vuelta, setVuelta] = useState(0)
  useEffect(() => {
    const refrescar = () => setVuelta((n) => n + 1)
    addEventListener('hermit-videos', refrescar)
    return () => removeEventListener('hermit-videos', refrescar)
  }, [])
  // Al cambiar de estilo se vacía; si solo avanzó un hilo, se ve lo de antes mientras se vuelve a mirar.
  useEffect(() => setVideos(null), [card?.id])
  const clave = hilos.map((s) => s.id + s.updatedAt).join()
  useEffect(() => {
    if (!card) return
    let vivo = true
    api<VideoHecho[]>(`/api/cards/${card.id}/videos`).then((v) => vivo && setVideos(v), () => vivo && setVideos([]))
    return () => {
      vivo = false
    }
  }, [card?.id, clave, vuelta])
  return videos
}

/** Las series de la skill de una card (`GET /api/cards/<id>/series`). Si falla, no hay ninguna y no sale el selector. */
function useSeries(card: Card) {
  const [series, setSeries] = useState<Serie[]>([])
  useEffect(() => {
    if (!card.skill) return setSeries([])
    let vivo = true
    api<Serie[]>(`/api/cards/${card.id}/series`).then((s) => vivo && setSeries(s), () => vivo && setSeries([]))
    return () => {
      vivo = false
    }
  }, [card.id])
  return series
}

/** Las marcas de la carpeta de trabajo de una card (`GET /api/cards/<id>/marcas`). Si falla, ninguna. */
function useMarcas(card: Card) {
  const [marcas, setMarcas] = useState<Marcas>({ otras: [] })
  useEffect(() => {
    if (!card.skill) return setMarcas({ otras: [] })
    let vivo = true
    api<Marcas>(`/api/cards/${card.id}/marcas`).then((m) => vivo && setMarcas(m), () => vivo && setMarcas({ otras: [] }))
    return () => {
      vivo = false
    }
  }, [card.id])
  return marcas
}

/**
 * La previa de cada card de estilo: su último video terminado o su última imagen (`server/previas.ts`). Se vuelve a pedir
 * cuando un hilo deja de trabajar, que es cuando puede haber un video nuevo. La primera vez tarda lo que FFmpeg en hacer
 * las de video.
 */
function usePrevias(cards: Card[], sessions: SessionMeta[]) {
  const [previas, setPrevias] = useState<Record<string, Previa>>({})
  const clave = cards.map((c) => c.id).join() + '|' + sessions.flatMap((s) => (s.running ? [] : [s.id])).join()
  useEffect(() => {
    let vivo = true
    api<Record<string, Previa>>('/api/previas').then((p) => vivo && setPrevias(p), () => {})
    return () => {
      vivo = false
    }
  }, [clave])
  return previas
}

/** El único inicio: la card elegida arriba, el compositor y debajo las cards para cambiar de skill. */
export function NewSession(props: {
  card: Card
  cards: Card[]
  sessions: SessionMeta[]
  models: Model[]
  draft?: Draft
  onDraft(draft: Draft): void
  onPick(c: Card): void
  onCreated(id: string): void
}) {
  const { card, models } = props
  // El modelo: «Optimizado» usa lo medido para esta card (el hilo y cada subagente) o, sin medir, lo último que elegiste
  // a mano; «Avanzado», lo que elegiste para ella.
  const [avanzados, setAvanzados] = useStored<Record<string, Avanzado>>('modelos', {})
  // Sin Claude, lo medido no podría empezar: sin elección tuya, la card va en «Avanzado» con ChatGPT, con OpenCode o con
  // el primer modelo del agente que tengas.
  const sinClaude = useSinClaude(models)
  const { conectados } = useCuentasConectadas(models)
  const avanzado = avanzados[card.id] ?? (sinClaude === 'codex' ? CON_CHATGPT : sinClaude === 'opencode' ? conOpenCode(models) : sinClaude ? conPrimero(models, sinClaude) : undefined)
  const { choice, tareas } = useMemo(() => elegirModelos(card.modelos, models, avanzado, lastChoice(models), conectados), [card.modelos, models, avanzado, conectados])
  function cambiarModelos(a: Avanzado | undefined) {
    const { [card.id]: _, ...resto } = avanzados
    setAvanzados(a ? { ...resto, [card.id]: a } : resto)
    // Cambiar el modelo del hilo en «Avanzado» es elegirlo a mano; pasar a «Avanzado» o cambiar un subagente, no.
    if (a?.principal && avanzado && a.principal !== avanzado.principal) elegidoAMano(a.principal)
  }
  const [borrando, setBorrando] = useState<Card | null>(null)
  // Duplicar no pregunta: la copia no rompe nada y se quita con ✕. Si falla, se dice junto a las skills.
  const [fallo, setFallo] = useState('')
  async function duplicar(c: Card) {
    setFallo('')
    try {
      const { id } = await api<{ id: string }>(`/api/cards/${c.id}/duplicate`, {})
      props.onPick({ ...c, id })
    } catch (e) {
      setFallo(`No se pudo duplicar «${c.title}»: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  // Al elegir un estilo de video, sus videos ocupan el sitio de las cards hasta volver a «Todos los estilos». El aviso de
  // redes de la barra lateral los abre con `#/new/<card>/videos`.
  const [enEstilo, setEnEstilo] = useState(() => location.hash.endsWith('/videos'))
  useEffect(() => {
    const ver = () => location.hash.endsWith('/videos') && setEnEstilo(true)
    addEventListener('hashchange', ver)
    return () => removeEventListener('hashchange', ver)
  }, []) // redes
  const hilos = props.sessions.filter((s) => s.cardId === card.id).sort((a, b) => b.createdAt - a.createdAt)
  const videos = useTerminados(enEstilo && esDeVideo(card) ? card : null, hilos)
  const previas = usePrevias(props.cards, props.sessions) // previas de las cards
  const publicar = usePublicar(enEstilo && esDeVideo(card) ? card : null, videos) // redes
  // El video de una carpeta de fuera, sin hilo que abrir, se ve en grande.
  const [viendo, setViendo] = useState<string | null>(null)
  // Con dos enlaces o más, la card que hace lotes ofrece un video por enlace. Hay que elegirlo: dos enlaces también pueden
  // ser las fuentes de un solo video. La card recuerda la última elección, para quien hace lotes siempre.
  const enlaces = enlacesDe(props.draft?.text ?? '')
  const [porEnlace, setPorEnlace] = useStored<Record<string, boolean>>('porEnlace', {})
  // Una serie (`skills/video-base/series/` o de la skill): sin escribir nada, el agente elige el tema y hace el video.
  const series = useSeries(card)
  const [serie, setSerie] = useState('')
  useEffect(() => setSerie(''), [card.id])
  const laSerie = series.find((s) => s.id === serie)
  // La marca (una por canal, en la carpeta de trabajo de la card): el selector sale con dos o más. Sin elegir, la de
  // siempre.
  const marcas = useMarcas(card)
  const [marca, setMarca] = useState('')
  useEffect(() => setMarca(''), [card.id])
  const conMarcas = (marcas.base !== undefined ? 1 : 0) + marcas.otras.length > 1
  const laMarca = conMarcas && marcas.otras.includes(marca) ? marca : ''
  const lote = !!card.lote && enlaces.length > 1 && !!porEnlace[card.id]
  // Todo estilo de video hace los dos formatos (skills/video-base/FORMATO.md): la skill hace solo el elegido. La card
  // recuerda el último; una idea de YouTube ya lo trae escrito en el mensaje (`Formato: horizontal`), y ese manda.
  // La card de imágenes ofrece además las otras proporciones que Nano Banana compone (`FORMATOS_IMAGEN`); el mensaje
  // lleva la proporción tal cual (`Formato: 1:1`).
  const esImagen = card.produce === 'imagen'
  const formatoOpciones = esImagen ? FORMATOS_IMAGEN : FORMATOS_ENCUEADRE
  const tokensFormato = esImagen ? [...formatoOpciones.map((o) => o.valor), 'vertical', 'horizontal', 'cuadrada'] : formatoOpciones.map((o) => o.valor)
  const [formatos, setFormatos] = useStored<Record<string, string>>('formato', {})
  const formatoEscrito = new RegExp(`^Formato: (${tokensFormato.join('|')})\\s*$`, 'm').exec(props.draft?.text ?? '')?.[1]
  // Las presentaciones son 16:9 por defecto (skills/presentaciones); las imágenes, 9:16; el video, vertical.
  const formatoPorDefecto = card.produce === 'presentacion' ? 'horizontal' : esImagen ? '9:16' : 'vertical'
  const formato = formatoReal(formatoEscrito ?? formatos[card.id] ?? formatoPorDefecto, esImagen)
  const formatoActual = formatoOpciones.find((o) => o.valor === formato) ?? formatoOpciones[0]
  // Los controles del compositor los decide lo que produce la card (`produce`), no sus etapas: el video lleva
  // formato, duración, voz, música e imágenes; las imágenes y las presentaciones llevan formato e imágenes (la
  // proporción de las diapositivas o de cada imagen); el artículo solo el motor de su portada.
  const conVideo = card.produce === 'video'
  const conFormato = conVideo || card.produce === 'imagen' || card.produce === 'presentacion'
  const conImagenes = !!card.produce
  // Solo las cards con `clips` (las novelas y minidrama, que se arman con clips de Flow) reparten la duración en
  // clips de 8 s; las demás la toman como la duración total del video (`video-base/DURACION.md`).
  const conClips = !!card.clips
  // Cuánto dura el video. Sin elegir, la que pida el mensaje; la skill reparte los clips de 8 s para llegar
  // (`skills/video-base/DURACION.md`), y el montaje recorta a lo exacto.
  const [duraciones, setDuraciones] = useStored<Record<string, string>>('duracion', {})
  const duracion = duraciones[card.id] ?? ''
  // La ficha del estilo (nombre, descripción, avisos) se pliega a una línea: en una laptop ocupaba media
  // pantalla. En ventanas bajas arranca plegada; al elegir un estilo del estante se abre sola. Se recuerda.
  const [detalle, setDetalle] = useStored<boolean>('estilo-detalle', !matchMedia('(max-height: 860px)').matches)
  // La voz: mandarla tú o que el agente la genere en AI Studio, Fish Audio o ElevenLabs (`Voz.tsx`). La card recuerda
  // la última; sin la cuenta o la llave de esa voz, la mandas tú.
  const voz = useVoz()
  const [voces, setVoces] = useStored<Record<string, string>>('voz', {})
  const vozElegida = vozPosible(voz.estado, voces[card.id] ?? '') ? voces[card.id] : ''
  // La música de fondo, en el menú «Voz» de los estilos que la saben poner (`card.musica`): apagada hasta que la
  // enciendas; la card recuerda la última elección.
  const [musicas, setMusicas] = useStored<Record<string, boolean>>('musica', {})
  const musica = !!card.musica && !!musicas[card.id]
  // Las imágenes: con ChatGPT o con un modelo de Google Flow (`Flow.tsx`), según lo que tengas conectado.
  const hayChatGPT = useChatGPT()
  const [imagenes, setImagenes] = useStored<string>('imagenes', '')
  const flow = useFlow()
  const imagenElegida = imagenPosible(imagenes, { chatgpt: hayChatGPT, google: !!voz.estado?.cuenta || !!flow.estado?.cuentas.length })
  // Los clips: con qué modelo de Flow se generan (`Flow.tsx`). Sin elegir, mandan los del estilo.
  const [clips, setClips] = useStored<Record<string, string>>('clips', {})
  const clipsElegidos = OPCIONES_CLIPS[clips[card.id] ?? ''] ? clips[card.id] : ''
  // Un archivo o un enlace soltado en cualquier parte del inicio va al mensaje.
  const soltar = useSoltar()

  // Sin la cuenta del agente conectada, el video no podría empezar: el aviso de encima lo dice y no se manda.
  const [sinCuenta, setSinCuenta] = useState<boolean>()

  // Lo que hacen los carteles, siempre las mismas funciones (van memorizados) y con lo de ahora.
  const alCartel = useRef<AccionesCartel>(null as never)
  alCartel.current = {
    // Sin videos terminados (sin previa) solo se elige: su galería saldría vacía.
    elegir: (c) => (props.onPick(c), setDetalle(true), setEnEstilo(esDeVideo(c) && !!previas[c.id])),
    duplicar: (c) => void duplicar(c),
    borrar: setBorrando
  }
  const accionesCartel = useMemo<AccionesCartel>(() => ({ elegir: (c) => alCartel.current.elegir(c), duplicar: (c) => alCartel.current.duplicar(c), borrar: (c) => alCartel.current.borrar(c) }), [])

  const composer = (
      <Composer
        models={models}
        choice={choice}
        draft={props.draft}
        onDraft={props.onDraft}
        bloqueo={sinCuenta ? 'Primero conecta tu cuenta (arriba)' : undefined}
        placeholder={card.skill ? `Qué quieres de /${card.skill}…` : 'Qué cambio quieres en Hermit…'}
        modelos={<Modelos conf={card.modelos} models={models} avanzado={avanzado} choice={choice} tareas={tareas} sinClaude={sinClaude} conectados={conectados} onAvanzado={cambiarModelos} />}
        extra={
          <>
            {series.length > 0 && (
              <Picker
                flotante
                label={laSerie ? laSerie.nombre : 'Sin serie'}
                value={serie}
                groups={[
                  { label: 'Tema libre', options: [{ value: '', label: 'Sin serie' }] },
                  { label: 'Serie: elige sola el tema si no escribes uno', options: series.map((s) => ({ value: s.id, label: s.nombre })) }
                ]}
                onChange={setSerie}
              />
            )}
            {conMarcas && (
              <Picker
                flotante
                label={`Marca: ${laMarca || (marcas.base !== undefined ? 'la de siempre' : 'sin elegir')}`}
                value={laMarca}
                groups={[
                  {
                    label: 'El tono, el nicho y el cierre del canal',
                    options: [
                      { value: '', label: marcas.base === undefined ? 'Sin elegir' : marcas.base ? `La de siempre (${marcas.base})` : 'La de siempre' },
                      ...marcas.otras.map((m) => ({ value: m, label: m }))
                    ]
                  }
                ]}
                onChange={setMarca}
              />
            )}
            {conFormato && (
              <Picker
                flotante
                className="formato-picker"
                label={
                  <span className="formato-trigger">
                    <span className={`formato-ico ${formatoActual.ico}`} />
                    {formatoActual.nombre}
                  </span>
                }
                value={formato}
                disabled={!!formatoEscrito}
                groups={[
                  {
                    label: formatoEscrito ? 'Lo trae la idea' : esImagen ? 'La proporción de cada imagen' : 'Para TikTok o para YouTube',
                    options: formatoOpciones.map((o) => ({
                      value: o.valor,
                      label: (
                        <span className="formato-op">
                          <span className={`formato-ico ${o.ico}`} />
                          <span className="formato-txt">
                            <b>{o.nombre}</b>
                            <small>{o.detalle}</small>
                          </span>
                        </span>
                      )
                    }))
                  }
                ]}
                onChange={(f) => setFormatos({ ...formatos, [card.id]: f })}
              />
            )}
            {conVideo && (
              <Picker
                flotante
                label={duracion ? `Duración: ${duracion}` : 'Duración: la que pida el mensaje'}
                value={duracion}
                groups={[
                  { label: 'La que pida el mensaje', options: [{ value: '', label: 'La que pida el mensaje' }] },
                  {
                    label: 'Video',
                    options: [
                      { value: '10 s', label: '10 segundos' },
                      { value: '15 s', label: '15 segundos' },
                      { value: '30 s', label: '30 segundos' },
                      { value: '45 s', label: '45 segundos' },
                      { value: '1 min', label: '1 minuto' },
                      { value: '2 min', label: '2 minutos' },
                      { value: '3 min', label: '3 minutos' }
                    ]
                  }
                ]}
                onChange={(d) => setDuraciones({ ...duraciones, [card.id]: d })}
              />
            )}
            {conVideo && <SelectorVoz card={card} voz={voz} valor={vozElegida} musica={{ encendida: musica, onCambio: (m) => setMusicas({ ...musicas, [card.id]: m }) }} onCambio={(v) => setVoces({ ...voces, [card.id]: v })} />}
            {conImagenes && <SelectorImagenes valor={imagenElegida} hayChatGPT={hayChatGPT} voz={voz} flow={flow} onCambio={setImagenes} />}
            {conClips && <SelectorClips valor={clipsElegidos} onCambio={(c) => setClips({ ...clips, [card.id]: c })} />}
            {card.lote && enlaces.length > 1 && (
              <Segmento
                label="Lote"
                valor={lote ? 'varios' : 'uno'}
                opciones={[
                  { id: 'uno', texto: '1 video', title: 'Un solo hilo: los enlaces son las fuentes de un mismo video' },
                  {
                    id: 'varios',
                    texto: `${enlaces.length} videos`,
                    title: `Se crean ${enlaces.length} hilos, uno por enlace, cada uno con su carpeta. Arrancan solos, tantos a la vez como aguante la máquina`
                  }
                ]}
                onCambio={(n) => setPorEnlace({ ...porEnlace, [card.id]: n === 'varios' })}
              />
            )}
          </>
        }
        vacio={!!laSerie}
        onSend={async (text, choice, images) => {
          const enlaces = enlacesDe(text)
          const porEnlace = lote && enlaces.length > 1
          localStorage.setItem('card', card.id)
          // Cada video lleva lo que escribiste sin los enlaces: el suyo se lo pone el servidor, con su carpeta.
          if (porEnlace) text = enlaces.reduce((t, e) => t.replaceAll(e, ''), text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
          // La skill lo lee en el mensaje, debajo de lo que escribió el usuario.
          const pide = [
            laSerie && `Serie: ${laSerie.nombre} (${laSerie.archivo}; cómo se usa, en video-base/SERIES.md)${text ? '' : '. Elige tú el tema.'}`,
            laMarca && `Marca: ${laMarca}`,
            conFormato && !formatoEscrito && `Formato: ${formato}`,
            conVideo && duracion && (card.clips
              ? `Duración: ${duracion} (reparte los clips de 8 s y recorta al final; video-base/DURACION.md)`
              : `Duración: ${duracion} (la duración total del video; cómo la usa tu estilo, en video-base/DURACION.md)`),
            conVideo && lineaVoz(card, vozElegida, nombreDeVoz(voz.estado, vozElegida)),
            conVideo && lineaMusica(card, musica),
            conImagenes && lineaImagenes(imagenElegida),
            conClips && clipsElegidos && lineaClips(clipsElegidos),
            // El modelo de cada subagente: lo medido, o lo que elegiste en «Avanzado». La skill lo lee aquí.
            lineaSubagentes(tareas)
          ]
          text = [text, ...pide].filter(Boolean).join('\n\n')
          if (porEnlace) {
            const metas = await api<SessionMeta[]>('/api/lotes', { cardId: card.id, text, enlaces, images, ...choice })
            return props.onCreated(metas[0].id)
          }
          const meta = await api<SessionMeta>('/api/sessions', { cardId: card.id, text, images, ...choice })
          props.onCreated(meta.id)
        }}
      />
  )

  return (
    <div className="new-session" {...soltar.props}>
      {soltar.aviso}
      {/* Arriba las skills (o, con un estilo elegido, sus videos), que hacen scroll solas con la cabecera;
          abajo la skill elegida y el compositor, que no se mueven de su sitio. */}
      <div className="new-top">
        <header className="new-session-head">
          <div>
            <h1>Nuevo chat</h1>
            <p className="muted">Elige un formato para empezar a crear o escribe directamente en el compositor.</p>
          </div>
          <div className="new-session-acciones">
            <AvisoEquipo />
          </div>
        </header>
        {enEstilo && esDeVideo(card) ? (
          <div className="estilo">
            <button className="estilo-volver" onClick={() => setEnEstilo(false)}>
              ← Todos los estilos
            </button>
            {publicar.barra}
            {videos && <YoutubeLote videos={videos} cardId={card.id} />}
            <CalendarioYoutube />
            {!videos ? null : videos.length ? (
              <Rejilla items={videos}>{(v) => <VideoDe key={v.src} video={v} onVer={() => setViendo(v.src)} insignia={publicar.insignia(v.ruta)} />}</Rejilla>
            ) : (
              <p className="estilo-vacio">Aún no hay videos terminados de este estilo.</p>
            )}
            {viendo && (
              <div className="lightbox" onClick={() => setViendo(null)}>
                <video src={viendo} controls autoPlay onClick={(e) => e.stopPropagation()} />
              </div>
            )}
          </div>
        ) : (
          <section className="estante">
            {fallo && <p className="bad small">{fallo}</p>}
            {/* Cada skill es un cartel, agrupado por lo que produce. */}
            <Carteles cards={props.cards} activa={card.id} previas={previas} sessions={props.sessions} acciones={accionesCartel} />
          </section>
        )}
      </div>
      <div className="new-bottom">
        {/* En ventanas bajas (una laptop pequeña) esto hace scroll interno: el compositor nunca se va con él. */}
        <div className="new-antes">
          <div className="new-head">
            <button type="button" className="new-antes-cabeza" onClick={() => setDetalle(!detalle)} aria-expanded={detalle} title={detalle ? 'Ocultar la ficha del estilo' : 'Ver la ficha del estilo'}>
              <span className="new-head-titulo">
                <span className="card-icon big"><Icon icon={card.icon ?? '✦'} /></span>
                <h1>{card.title}</h1>
                <span className="new-antes-flecha">{detalle ? '▾' : '▴'}</span>
              </span>
            </button>
            {detalle && (
              <>
                <p>{card.description}</p>
                {card.clips && <p className="small warn">Se hace con clips de Google Flow: gasta créditos de tus cuentas.</p>}
                <TusCambios card={card} clave={hilos.map((s) => s.id + s.updatedAt).join()} />
                {/* Hasta saber qué cuentas hay no sale: el aviso de Claude no se asoma a quien solo tiene ChatGPT u OpenCode. */}
                {sinClaude !== undefined && <CuentaClaude model={choice?.model} onFalta={setSinCuenta} />}
                {/* Las herramientas de video (FFmpeg, Python, yt-dlp) solo hacen falta en los estilos de video, y de los paquetes, los de su skill. */}
                {esDeVideo(card) && <Requisitos skill={card.skill} />}
              </>
            )}
          </div>
        </div>
        {/* Plegada la ficha, el compositor y las tarjetas de enlaces también se guardan: queda solo el
            estante de estilos y la barra del estilo para reabrirlos. */}
        {detalle && composer}
        {detalle && <TarjetasEnlaces enlaces={enlaces} />}
      </div>
      {borrando && (
        <Confirm
          title={`¿Eliminar «${borrando.title}»?`}
          action="Eliminar"
          danger
          onClose={() => setBorrando(null)}
          onConfirm={() => api(`/api/cards/${borrando.id}/delete`, {})}
        >
          {borrando.tuya ? (
            <>
              Se quitan tu estilo y su skill{borrando.skill && <> <code>/{borrando.skill}</code></>}, que se guarda en una copia por si te arrepientes. Los hilos y los
              videos que hiciste con él se quedan.
            </>
          ) : (
            <>
              Se quita de las cards.{borrando.skill ? <> La skill <code>/{borrando.skill}</code> sigue instalada</> : ' Su carpeta de trabajo sigue ahí'} y los hilos
              que hiciste con ella se quedan.
            </>
          )}
        </Confirm>
      )}
    </div>
  )
}
