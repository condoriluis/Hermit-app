import { useEffect, useMemo, useState } from 'react'
import { esVertical, IDEAS_CARD, sinInvestigar, TU_CANAL, TU_INSTAGRAM, urlVertical, veces } from '../../shared/ideas'
import type { Card, CanalCompleto, EnVivo, Idea, IdeaElegida, SessionMeta, VideoYT } from '../../shared/types'
import { esDeVideo } from '../../shared/types'
import { api } from './api'
import { Icon, type Choice } from './Composer'
import { enlace, hace, Idioma, Md, mil, miniatura, Portada, redesDe, sinVistas, tuyo } from './IdeasBase'
import { VideoFila } from './IdeasInvestigacion'

/** Lo que Claude propone: el estado de su hilo, su razonamiento y cada idea con lo que se puede hacer con ella. */
export function Propuestas(props: {
  d: CanalCompleto
  corriendo: boolean
  investigando: boolean
  elegir?: Choice
  cards: Card[]
  onHilo(id: string): void
  onBorrador(cardId: string, texto: string): void
  onCambio(): void
}) {
  const { d, corriendo } = props
  const [vivo, setVivo] = useState<EnVivo | null>(null)
  const [, tic] = useState(0)
  // Mientras Claude trabaja, qué hace ahora y cuánto lleva: sin abrir el hilo.
  useEffect(() => {
    if (!corriendo) return setVivo(null)
    const leer = () => api<EnVivo | null>(`/api/ideas/${d.canal.id}/hilo`).then(setVivo, () => {})
    leer()
    const i = setInterval(() => (leer(), tic((n) => n + 1)), 3000)
    return () => clearInterval(i)
  }, [corriendo, d.canal.id])
  const [nota, setNota] = useState('')
  const [razon, setRazon] = useState<'demanda' | 'formatos' | null>(null)
  const [error, setError] = useState('')
  const [verDescartadas, setVerDescartadas] = useState(false)
  const [verAnteriores, setVerAnteriores] = useState(false)
  const ideas = d.ideas?.ideas ?? []
  const descartadas = ideas.filter((i) => d.elegidas[i.id]?.estado === 'descartada')
  const vivas = ideas.filter((i) => d.elegidas[i.id]?.estado !== 'descartada')
  const modelo = props.elegir?.model
  // Lo del perfil que la investigación no cubre: «Proponer» lo investiga primero, solo eso.
  const faltan = sinInvestigar(d.investigacion, d.canal)
  const faltanCanales = faltan.filter((f) => f === TU_CANAL || f === TU_INSTAGRAM || d.canal.referencias.includes(f)).length
  const faltanTerminos = faltan.length - faltanCanales

  function proponer() {
    if (!props.elegir) return setError('No hay ningún modelo de Claude disponible.')
    setError('')
    api(`/api/ideas/${d.canal.id}/proponer`, { ...props.elegir, nota }).then(() => (setNota(''), props.onCambio()), (e) => setError(e.message))
  }

  function sumarTermino(t: string) {
    api('/api/ideas/canales', { ...d.canal, semillas: [...d.canal.semillas, t] }).then(props.onCambio, (e) => setError(e.message))
  }

  return (
    <section className="ideas-bloque">
      <div className="ideas-bloque-head">
        <h2>Ideas</h2>
        <span className="muted small">{ideas.length ? `${vivas.length} ideas${d.ideas?.generadas ? ` · ${hace(d.ideas.generadas)}` : ''}` : 'Claude las saca de la investigación'}</span>
        <span className="spacer" />
        {d.hilo && (
          <button className="ghost small" onClick={() => props.onHilo(d.hilo!.id)}>
            Ver cómo lo pensó →
          </button>
        )}
      </div>
      {corriendo ? (
        <div className="trabajo trabajando">
          <div className="trabajo-estado">
            <span className="spinner" />
            <strong>Claude está proponiendo ideas</strong>
            <span className="spacer" />
            <button className="ghost small" onClick={() => props.onHilo(d.hilo!.id)}>
              Abrir el hilo →
            </button>
          </div>
          <ol className="mini-etapas">
            {IDEAS_CARD.etapas!.slice(0, 3).map((e, i) => {
              const hecha = [d.demanda, d.formatos, d.ideas][i]
              const actual = !hecha && (i === 0 || [d.demanda, d.formatos, d.ideas][i - 1])
              return (
                <li key={e.nombre} className={hecha ? 'ok' : actual ? 'on' : ''}>
                  {hecha ? '✓' : actual ? '…' : '·'} {e.nombre}
                </li>
              )
            })}
          </ol>
          {vivo && (
            <div className="idea-vivo small">
              <span className="vivo-ahora">Ahora: {vivo.ahora}</span>
              {vivo.desde && <span className="muted">{Math.max(1, Math.round((Date.now() - vivo.desde) / 60000))} min</span>}
            </div>
          )}
          <p className="muted small">
            Primero el mapa de demanda, luego las fórmulas con su tasa de éxito y al final las ideas. Cada archivo aparece aquí en cuanto lo escribe. Parte del
            resumen de la investigación que Hermit ya contó; con Opus, una vuelta tarda varios minutos.
          </p>
        </div>
      ) : (
        <div className="proponer">
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Algo que Claude deba tener en cuenta (opcional)" />
          <button className="primary" disabled={props.investigando || !props.elegir} onClick={proponer} title={modelo ? `Con ${modelo}, en un hilo que puedes abrir` : undefined}>
            {faltan.length ? 'Investigar lo que falta y proponer' : ideas.length ? 'Proponer otra vez' : 'Proponer ideas'}
          </button>
        </div>
      )}
      {faltan.length > 0 && !props.investigando && !corriendo && (
        <p className="muted small" title={faltan.map((f) => `«${f}»`).join(', ')}>
          La investigación aún no cubre todo tu perfil:{' '}
          {[
            faltanTerminos && `${faltanTerminos} ${faltanTerminos === 1 ? 'búsqueda' : 'búsquedas'}`,
            faltanCanales && `${faltanCanales} ${esVertical(d.canal) ? (faltanCanales === 1 ? 'cuenta' : 'cuentas') : faltanCanales === 1 ? 'canal' : 'canales'} sin leer`
          ]
            .filter(Boolean)
            .join(' y ')}
          . Antes de proponer, Hermit investiga solo eso (unos minutos, sin gastar) y luego Claude propone con todo.
        </p>
      )}
      {props.investigando && !corriendo && (
        <p className="muted small">
          {d.trabajo?.proponer
            ? 'Hermit investiga lo que faltaba de tu perfil; al terminar, Claude propone las ideas.'
            : 'Espera a que termine la investigación: las ideas salen de ella.'}
        </p>
      )}
      {!corriendo && ideas.length > 0 && (
        <p className="muted small">
          Otra vuelta no borra nada: las ideas de ahora se guardan en «Vueltas anteriores», de donde puedes recuperar cualquiera, y las que elegiste se quedan.
        </p>
      )}
      {error && <p className="bad small">{error}</p>}

      {(d.demanda || d.formatos) && (
        <div className="razon">
          <span className="muted small">El razonamiento:</span>
          {d.demanda && (
            <button className={`ficha boton ${razon === 'demanda' ? 'on' : ''}`} onClick={() => setRazon(razon === 'demanda' ? null : 'demanda')}>
              Mapa de demanda
            </button>
          )}
          {d.formatos && (
            <button className={`ficha boton ${razon === 'formatos' ? 'on' : ''}`} onClick={() => setRazon(razon === 'formatos' ? null : 'formatos')}>
              Fórmulas y su tasa de éxito
            </button>
          )}
        </div>
      )}
      {razon && <div className="razon-texto">{<Md texto={(razon === 'demanda' ? d.demanda : d.formatos) ?? ''} />}</div>}

      {vivas.map((idea, i) => (
        <IdeaVista key={idea.id} n={i + 1} idea={idea} {...props} />
      ))}
      {!!d.ideas?.terminosNuevos?.length && (
        <div className="razon">
          <span className="muted small">Claude sugiere investigar también:</span>
          {d.ideas.terminosNuevos
            .filter((t) => !d.canal.semillas.some((s) => s.toLowerCase() === t.toLowerCase()))
            .map((t) => (
              <button key={t} className="ficha boton" title="Añadirlo a lo que se busca, para la próxima investigación" onClick={() => sumarTermino(t)}>
                + {t}
              </button>
            ))}
        </div>
      )}
      {descartadas.length > 0 && (
        <>
          <button className="ghost small" onClick={() => setVerDescartadas(!verDescartadas)}>
            {verDescartadas ? '▾' : '▸'} Descartadas ({descartadas.length})
          </button>
          {verDescartadas && descartadas.map((idea) => <IdeaVista key={idea.id} idea={idea} {...props} />)}
        </>
      )}
      {d.anteriores.length > 0 && (
        <>
          <button className="ghost small" onClick={() => setVerAnteriores(!verAnteriores)}>
            {verAnteriores ? '▾' : '▸'} Vueltas anteriores ({d.anteriores.length})
          </button>
          {verAnteriores && <Anteriores d={d} corriendo={corriendo} onCambio={props.onCambio} />}
        </>
      )}
    </section>
  )
}

/**
 * Las vueltas anteriores de «Proponer ideas», que Hermit guarda antes de cada vuelta nueva. Una idea que ya no está entre
 * las de ahora se puede recuperar: vuelve a la lista con todo lo suyo.
 */
function Anteriores({ d, corriendo, onCambio }: { d: CanalCompleto; corriendo: boolean; onCambio(): void }) {
  const [error, setError] = useState('')
  const ahora = new Set(d.ideas?.ideas.map((i) => i.titulo))
  const fecha = (t: number) => new Date(t).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const recuperar = (vuelta: string, ideaId: string) => (setError(''), api(`/api/ideas/${d.canal.id}/recuperar`, { vuelta, ideaId }).then(onCambio, (e) => setError(e.message)))
  return (
    <div className="anteriores">
      {error && <p className="bad small">{error}</p>}
      {d.anteriores.map((v) => (
        <div key={v.vuelta} className="vuelta">
          <div className="muted small">
            Vuelta del {fecha(v.en)} · {v.ideas.length} ideas
          </div>
          {v.ideas.map((i) => {
            const esta = ahora.has(i.titulo)
            return (
              <div key={i.id} className="vuelta-idea">
                <span>
                  <strong>{i.titulo}</strong>
                  <small className="muted">
                    {i.tema} · piso {mil(i.piso)} · techo {mil(i.techo)}
                  </small>
                </span>
                {esta ? (
                  <span className="muted small">Sigue entre las de ahora</span>
                ) : (
                  <button className="ghost small" disabled={corriendo} onClick={() => recuperar(v.vuelta, i.id)} title="Vuelve a ponerla entre las ideas de ahora">
                    Recuperar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Las cards con que se puede hacer una idea: las de video (`produce: 'video'`), que hacen los dos formatos (`Formato:` del brief). */
const estilos = (cards: Card[]) => cards.filter(esDeVideo)

/**
 * Lo que recibe la card al hacer una idea. Sin enlaces: con dos o más, El Diff ofrecería un video por enlace. Por eso la
 * evidencia vertical lleva su dirección sin `https://`. Un video en inglés lo dice: es empaque para traer, no la demanda
 * de tu público.
 */
function brief(d: CanalCompleto, idea: Idea): string {
  const videos = new Map(d.investigacion?.videos.map((v) => [v.id, v]))
  const evidencia = idea.evidencia.map((id) => videos.get(id)).filter((v): v is VideoYT => !!v)
  const vertical = esVertical(d.canal)
  const x = (v: VideoYT) => (v.x !== undefined ? veces(v.x) : sinVistas(v) ? 'sin vistas (cuenta no medible)' : 'sin medir')
  return [
    vertical
      ? `Un video vertical (9:16) para ${redesDe(idea.red)}, del canal «${d.canal.nombre}». Sale de la sección Ideas de Hermit.`
      : `Un video largo para YouTube (horizontal), del canal «${d.canal.nombre}». Sale de la sección Ideas de Hermit.`,
    `${vertical ? 'Texto del primer cuadro' : 'Título'}: ${idea.titulo}`,
    `Tema: ${idea.tema}`,
    `Por qué: ${idea.porque}`,
    `Gancho (las 4 P${vertical ? ', en los primeros 3 segundos' : ''}):\n- Promesa: ${idea.gancho.promesa}\n- Prueba: ${idea.gancho.prueba}\n- Plan: ${idea.gancho.plan}\n- Persona: ${idea.gancho.persona}`,
    `${vertical ? 'Primer cuadro' : 'Miniatura'}: ${idea.miniatura}`,
    `Cómo se hace: ${idea.ejecucion}`,
    idea.cta && `Llamada a la acción: ${idea.cta}`,
    evidencia.length &&
      (vertical
        ? `Evidencia:\n${evidencia.map((v) => `- «${v.titulo.replace(/\s+/g, ' ').slice(0, 120)}»${v.idioma === 'en' ? ' (en inglés)' : ''}${v.pagado ? ' (colaboración pagada)' : ''}, ${x(v)} en ${v.canal} (${urlVertical(v).replace(/^https?:\/\//, '')})`).join('\n')}`
        : `Evidencia (ids de YouTube):\n${evidencia.map((v) => `- «${v.titulo}», ${x(v)} en ${v.canal} (${v.id})`).join('\n')}`),
    `Riesgo: ${idea.riesgo}`,
    // El estilo que hace los dos formatos (El Diff) hace solo el que dice esta línea.
    `Formato: ${vertical ? 'vertical' : 'horizontal'}`,
    `Idea: ${d.canal.id}/${idea.id}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

function IdeaVista(props: {
  n?: number
  idea: Idea
  d: CanalCompleto
  elegir?: Choice
  cards: Card[]
  onHilo(id: string): void
  onBorrador(cardId: string, texto: string): void
  onCambio(): void
}) {
  const { idea, d } = props
  const el: IdeaElegida | undefined = d.elegidas[idea.id]
  const [feed, setFeed] = useState(false)
  const [esquema, setEsquema] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [error, setError] = useState('')
  const videos = useMemo(() => new Map(d.investigacion?.videos.map((v) => [v.id, v])), [d.investigacion])
  const propios = new Set(d.investigacion?.canales.filter(tuyo).map((c) => c.id))
  const cardDe = (id?: string) => props.cards.find((c) => c.id === id)
  const vertical = esVertical(d.canal)
  // El estilo que Claude sugiere va primero.
  const conQue = estilos(props.cards).sort((a, b) => Number(b.id === idea.estilo) - Number(a.id === idea.estilo))

  const elegir = (estado: IdeaElegida['estado'] | null, cardId?: string) => api(`/api/ideas/${d.canal.id}/elegir`, { ideaId: idea.id, estado, cardId })
  async function hacerCon(card: Card) {
    try {
      await elegir('elegida', card.id)
      props.onBorrador(card.id, brief(d, idea))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  /** Bloqueado mientras responde: un doble clic no abre dos hilos (y el servidor devuelve el que ya prepara). */
  function grabar() {
    if (!props.elegir) return setError('No hay ningún modelo de Claude disponible.')
    if (preparando) return
    setPreparando(true)
    setError('')
    api<SessionMeta>(`/api/ideas/${d.canal.id}/preparar`, { ideaId: idea.id, ...props.elegir })
      .then((m) => props.onHilo(m.id), (e) => setError(e.message))
      .finally(() => setPreparando(false))
  }

  const descartada = el?.estado === 'descartada'
  const texto = d.esquemas[idea.id]
  return (
    <article className={`idea ${el?.estado ?? ''}`}>
      <div className="idea-top">
        <div>
          <div className="muted small">
            {props.n && <span className="idea-n">{props.n}</span>}
            {idea.tema}
            {vertical && ` · para ${redesDe(idea.red)}`}
          </div>
          <h3>{idea.titulo}</h3>
        </div>
        <div
          className="idea-rango"
          title="Una estimación de Claude, no un pronóstico: nadie la ha calibrado todavía contra tus resultados. Piso: lo realista para tu canal si sale bien. Techo: lo que sacaron los comparables."
        >
          estimado: piso <strong>{mil(idea.piso)}</strong> · techo <strong>{mil(idea.techo)}</strong>
        </div>
      </div>
      {/* Todos los hilos que salieron de la idea, del primero al último: grabarla y hacerla con un estilo no se pisan. */}
      {!!el?.hilos.length && (
        <div className="idea-hilos">
          {[...el.hilos]
            .sort((a, b) => a.en - b.en)
            .map((h) => (
              <div key={h.id ?? `${h.cardId}-${h.en}`} className="idea-estado">
                {h.cardId === 'grabar' ? (
                  '🎙 Para grabar tú'
                ) : (
                  <span>
                    <Icon icon={cardDe(h.cardId)?.icon ?? '🎬'} /> Con {cardDe(h.cardId)?.title ?? h.cardId}
                  </span>
                )}
                {h.id ? (
                  <button className="ghost small" onClick={() => props.onHilo(h.id!)}>
                    Abrir el hilo →
                  </button>
                ) : (
                  <span className="muted small">· el hilo aparece aquí cuando lo mandes</span>
                )}
              </div>
            ))}
        </div>
      )}
      <div className="idea-cols">
        <div className="idea-caja">
          <div className="caja-l">Evidencia</div>
          {idea.evidencia.map((id) => {
            const v = videos.get(id)
            if (!v)
              return (
                <div key={id} className="evidencia falta" title="Claude citó un video que no está en la investigación">
                  ⚠ {id}: no está en la investigación
                </div>
              )
            return <VideoFila key={id} v={v} canalId={d.canal.id} propio={propios.has(v.canalId)} />
          })}
        </div>
        <div className="idea-caja">
          <div className="caja-l">{vertical ? 'Gancho en pantalla' : 'Títulos para el A/B'}</div>
          <ol className="titulos">
            {idea.titulos.map((t) => (
              <li key={t.texto}>
                {t.texto}
                <small>
                  <em>{t.formato}</em> · {t.porque}
                </small>
              </li>
            ))}
          </ol>
        </div>
        <div className="idea-caja">
          <div className="caja-l">{vertical ? 'Gancho (3 s) · las 4 P' : 'Gancho · las 4 P'}</div>
          <dl className="cuatro-p">
            <dt>Promesa</dt>
            <dd>{idea.gancho.promesa}</dd>
            <dt>Prueba</dt>
            <dd>{idea.gancho.prueba}</dd>
            <dt>Plan</dt>
            <dd>{idea.gancho.plan}</dd>
            <dt>Persona</dt>
            <dd>{idea.gancho.persona}</dd>
          </dl>
        </div>
        <div className="idea-caja">
          <div className="caja-l">{vertical ? 'Primer cuadro' : 'Miniatura'}</div>
          <p>{idea.miniatura}</p>
          <div className="caja-l">Cómo se hace</div>
          <p>{idea.ejecucion}</p>
        </div>
      </div>
      <div className="idea-porque">
        <p>
          <strong>Por qué:</strong> {idea.porque}
        </p>
        <p>
          <strong className="riesgo">Riesgo:</strong> {idea.riesgo}
        </p>
        {idea.cta && (
          <p>
            <strong>Lo que regala:</strong> {idea.cta}
          </p>
        )}
      </div>
      {texto && (
        <div className="idea-esquema">
          <button className="ghost small" onClick={() => setEsquema(!esquema)}>
            {esquema ? '▾' : '▸'} Esquema para grabar
          </button>
          {esquema && <Md texto={texto} />}
        </div>
      )}
      {error && <p className="bad small">{error}</p>}
      <div className="idea-acciones">
        {descartada ? (
          <button className="ghost small" onClick={() => elegir(null).then(props.onCambio)}>
            Recuperarla
          </button>
        ) : (
          <>
            <span className="muted small">Hacer con:</span>
            <button
              className="primary chico"
              disabled={preparando}
              onClick={grabar}
              title="Claude prepara el esquema, el gancho escrito, los títulos y la miniatura para que lo grabes tú"
            >
              {preparando ? 'Abriendo…' : '🎙 Lo grabo yo'}
            </button>
            {conQue.map((c) => (
              <button
                key={c.id}
                className={c.id === idea.estilo ? 'btn-card sugerido' : 'btn-card'}
                onClick={() => hacerCon(c)}
                title={`${c.id === idea.estilo ? 'El estilo que sugiere Claude para esta idea. ' : ''}Abre un hilo nuevo de ${c.title} con la idea ya escrita, para revisarla antes de mandarla`}
              >
                <Icon icon={c.icon ?? '✦'} /> {c.title}
              </button>
            ))}
            <span className="idea-acciones-fin">
              {idea.termino && (
                <button className="ghost small" onClick={() => setFeed(true)}>
                  Ver en el feed
                </button>
              )}
              <button className="ghost small" onClick={() => elegir('descartada').then(props.onCambio)} title="No la vuelve a proponer">
                Descartar
              </button>
            </span>
          </>
        )}
      </div>
      {feed && <Feed idea={idea} d={d} onClose={() => setFeed(false)} />}
    </article>
  )
}

/**
 * Tu idea entre lo que YouTube ya enseña en esa búsqueda. La miniatura se juega en un instante y solo se pulsa
 * una de veinte. Si tú no la elegirías, cámbiala antes de grabar. En vertical, tu primer cuadro entre las portadas que
 * da esa búsqueda en TikTok, o en Instagram si la idea es para Instagram.
 */
function Feed({ idea, d, onClose }: { idea: Idea; d: CanalCompleto; onClose(): void }) {
  const vertical = esVertical(d.canal)
  // En vertical, la frase se buscó en las dos redes: el feed de Instagram si la idea es para Instagram; si no, el de TikTok.
  const deLaFrase = d.investigacion?.terminos.filter((x) => x.termino === idea.termino) ?? []
  const t = deLaFrase.find((x) => x.red === (idea.red === 'instagram' ? 'instagram' : 'tiktok')) ?? deLaFrase[0]
  const red = t?.red === 'instagram' ? 'Instagram' : 'TikTok'
  const videos = new Map(d.investigacion?.videos.map((v) => [v.id, v]))
  // En vertical van cinco por fila: con nueve y el tuyo, dos filas llenas.
  const otros = (t?.ids ?? []).map((id) => videos.get(id)).filter((v): v is VideoYT => !!v).slice(0, vertical ? 9 : 8)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal feed" onClick={(e) => e.stopPropagation()}>
        <h2>En el feed de «{idea.termino}»</h2>
        <p className="modal-body">
          {vertical
            ? `Así se ve tu primer cuadro entre lo que ${red} enseña hoy en esa búsqueda. ¿Te pararías en el tuyo? Pregúntale también a alguien de tu público.`
            : 'Así compite tu idea con lo que YouTube enseña hoy en esa búsqueda. ¿La elegirías tú? Pregúntale también a alguien de tu público.'}
        </p>
        <div className={vertical ? 'feed-grid vertical' : 'feed-grid'}>
          <div className="feed-tile tuyo">
            <div className="feed-thumb concepto">{idea.miniatura}</div>
            <strong>{idea.titulo}</strong>
            <span className="muted small">{d.canal.handle ?? d.canal.nombre}</span>
          </div>
          {otros.map((v) => (
            <a className="feed-tile" key={v.id} href={enlace(v)} target="_blank" rel="noreferrer">
              {v.red ? <Portada canalId={d.canal.id} v={v} className="feed-thumb" /> : <img className="feed-thumb" src={miniatura(v.id)} alt="" />}
              <strong>{v.titulo}</strong>
              <span className="muted small">
                {v.canal} · {sinVistas(v) ? 'sin vistas' : `${mil(v.vistas)} vistas`} <Idioma de={v.idioma} />
              </span>
            </a>
          ))}
        </div>
        {!otros.length && <p className="muted small">No hay videos guardados de esa búsqueda: investiga otra vez.</p>}
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
