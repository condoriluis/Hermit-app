import { Fragment, useState } from 'react'
import { esVertical, idiomaDe, MIN_MUESTRA, redDeReferencia, sinInvestigar, TU_CANAL, TU_INSTAGRAM } from '../../shared/ideas'
import type { Canal, CanalCompleto, Investigacion, SessionMeta } from '../../shared/types'
import { api } from './api'
import type { Choice } from './Composer'
import { Logo } from './Logos'
import { BUSQUEDA_EN, enYoutube, hace, Idioma, Md, MESES, mil, miniatura } from './IdeasBase'

/**
 * El perfil del canal. Cada campo dice por qué importa: es la decisión que manda sobre las demás. Si no sabes qué poner,
 * «Armar el canal con preguntas» (o «No sé, pregúntame» en un campo) guarda lo que lleves y abre la entrevista. El
 * formato (YouTube, o TikTok e Instagram) se elige al crearlo y no cambia; uno vertical puede copiar el perfil de otro.
 */
export function CanalForm({
  canal,
  canales = [],
  primero,
  onCancel,
  onGuardado,
  onEntrevista
}: {
  canal?: Canal
  canales?: Canal[]
  primero?: boolean
  onCancel?(): void
  onGuardado(c: Canal): void
  onEntrevista(canalId: string, campo?: string): Promise<void>
}) {
  const [c, setC] = useState<Partial<Canal>>(canal ?? { semillas: [], vecinos: [], referencias: [] })
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const campo = (k: keyof Canal) => (e: { target: { value: string } }) => setC({ ...c, [k]: e.target.value })
  const vertical = esVertical(c)
  // Lo que se busca no se copia: en TikTok se escribe distinto que en YouTube.
  const copiables = canales.filter((x) => x.publico || x.meta || x.vecinos.length)

  function guardar() {
    setOcupado(true)
    setError('')
    api<Canal>('/api/ideas/canales', c)
      .then(onGuardado)
      .catch((e) => setError(e.message))
      .finally(() => setOcupado(false))
  }

  /** Guarda lo que lleves (sin nombre, «Canal nuevo», que la entrevista cambia) y abre la entrevista. */
  async function preguntar(k?: string) {
    setOcupado(true)
    setError('')
    try {
      const guardado = await api<Canal>('/api/ideas/canales', { ...c, nombre: c.nombre?.trim() || 'Canal nuevo' })
      await onEntrevista(guardado.id, k)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  const noSe = (k: string) => (
    <button type="button" className="no-se" disabled={ocupado} onClick={(e) => (e.preventDefault(), preguntar(k))} title="Claude te hace preguntas para llenar este campo contigo">
      No sé, pregúntame
    </button>
  )

  return (
    <section className="opcion canal-form">
      <div className="skill-name">
        <strong>{canal ? 'Editar el canal' : primero ? 'Empieza por tu canal' : 'Canal nuevo'}</strong>
      </div>
      {primero && (
        <p className="muted small">
          Un canal es a quién le hablas. Es lo primero porque decide todo lo demás: qué se busca, qué evidencia cuenta y qué idea sirve. Si aún no tienes el
          canal, no importa: la investigación funciona igual.
        </p>
      )}
      {!canal && (
        <div className="segmento formato" role="tablist">
          <button role="tab" aria-selected={!vertical} className={vertical ? '' : 'on'} onClick={() => setC({ ...c, formato: undefined, instagram: undefined })}>
            YouTube · videos largos
          </button>
          <button role="tab" aria-selected={vertical} className={vertical ? 'on' : ''} onClick={() => setC({ ...c, formato: 'vertical' })}>
            TikTok e Instagram · verticales
          </button>
        </div>
      )}
      {!canal && vertical && copiables.length > 0 && (
        <div className="campo">
          <span>Copiar el perfil de otro canal</span>
          <div className="copiar">
            {copiables.map((x) => (
              <button key={x.id} type="button" className="ficha boton" onClick={() => setC({ ...c, publico: x.publico, meta: x.meta, vecinos: x.vecinos })}>
                {x.nombre}
              </button>
            ))}
          </div>
          <small className="muted">Trae a quién le hablas, para qué y los nichos vecinos, y los ajustas aquí. Lo que se busca no: en TikTok se escribe distinto.</small>
        </div>
      )}
      <div className="entrevista-invita">
        <div>
          <strong>¿No sabes qué poner?</strong>
          <span className="muted small">
            Hermit te hace preguntas, una a la vez y con ejemplos para elegir, y va llenando el canal contigo. Antes de poner cada frase de búsqueda, mira en
            {vertical ? ' TikTok' : ' YouTube'} cuánta gente la busca.
          </span>
        </div>
        <button className="primary" disabled={ocupado} onClick={() => preguntar()}>
          Armar el canal con preguntas
        </button>
      </div>
      <label className="campo">
        <span>Nombre</span>
        <input value={c.nombre ?? ''} onChange={campo('nombre')} placeholder="luchodev · IA" autoFocus />
      </label>
      <label className="campo">
        <span>{vertical ? 'Tu TikTok' : 'Tu canal en YouTube'}</span>
        <input value={c.handle ?? ''} onChange={campo('handle')} placeholder={vertical ? '@tu.cuenta (opcional)' : '@tu_canal (opcional)'} />
        {!vertical && <small className="muted">Para medir tu propio piso: cuánto saca hoy un video tuyo. Vacío si el canal aún no existe.</small>}
      </label>
      {vertical && (
        <label className="campo">
          <span>Tu Instagram</span>
          <input value={c.instagram ?? ''} onChange={campo('instagram')} placeholder="@tu.instagram (opcional)" />
          <small className="muted">Con tu TikTok, para medir tu propio piso en cada red: cuánto saca hoy un video tuyo. Vacíos si aún no tienes las cuentas.</small>
        </label>
      )}
      <label className="campo">
        <span className="campo-titulo">
          ¿A quién le hablas? {noSe('publico')}
        </span>
        <textarea rows={2} value={c.publico ?? ''} onChange={campo('publico')} placeholder="Gente que quiere hacer videos con IA para su canal, aunque no sepa editar" />
        <small className="muted">Quien quieres que vea y, si vendes algo, que compre. Un millón de vistas del público equivocado vale menos que diez mil del correcto.</small>
      </label>
      <label className="campo">
        <span className="campo-titulo">
          ¿Para qué es el canal? {noSe('meta')}
        </span>
        <input value={c.meta ?? ''} onChange={campo('meta')} placeholder="Vender Hermit, mi app para hacer videos con IA" />
        <small className="muted">Si vendes algo, cada idea trae la llamada a la acción que regala en vez de pedir.</small>
      </label>
      <div className="campo">
        <span className="campo-titulo">
          Lo que tu público busca{vertical && ' en TikTok'} {noSe('semillas')}
        </span>
        <Fichas lista={c.semillas ?? []} onCambio={(semillas) => setC({ ...c, semillas })} placeholder="crear videos con ia ↵" />
        {vertical ? (
          <small className="muted">
            Frases como las escribiría tu público en el buscador de TikTok («crear videos con ia», «editar con capcut»), no palabras sueltas: Hermit busca cada
            una y abre las cuentas que salen. Pon de 5 a 12, en español y en inglés («faceless youtube channel»): lo que funciona en inglés suele llegar después
            al español. TikTok mezcla los resultados por tu país; de una búsqueda en inglés se toman los videos y las cuentas en inglés.
          </small>
        ) : (
          <small className="muted">
            Frases como las escribiría tu público en YouTube («crear videos con ia», «crecer en tiktok»), no palabras sueltas: «Tiktok» solo trae también mashups
            de música. Hermit busca cada una y abre los canales que salen. Pon de 5 a 12.
          </small>
        )}
      </div>
      <div className="campo">
        <span className="campo-titulo">
          {vertical ? 'Cuentas' : 'Canales'} que ya conoces {noSe('referencias')}
        </span>
        <Fichas
          lista={c.referencias ?? []}
          onCambio={(referencias) => setC({ ...c, referencias })}
          placeholder={vertical ? '@cuenta o instagram.com/cuenta ↵' : '@canal o enlace ↵'}
          red={vertical}
        />
        <small className="muted">
          {vertical ? '@cuenta es de TikTok; instagram.com/cuenta, de Instagram. Pueden ser en inglés, y se leen enteras' : 'Se leen enteros'}. Que te gusten no
          prueba que haya demanda; sus outliers sí.
        </small>
      </div>
      <div className="campo">
        <span className="campo-titulo">
          Nichos vecinos {noSe('vecinos')}
        </span>
        <Fichas lista={c.vecinos ?? []} onCambio={(vecinos) => setC({ ...c, vecinos })} placeholder={vertical ? 'crecer en tiktok ↵' : 'crecer en youtube ↵'} />
        <small className="muted">Públicos con la misma intención. De ahí salen las fórmulas de {vertical ? 'gancho' : 'título'} que tu nicho aún no usa.</small>
      </div>
      {error && <p className="bad small">{error}</p>}
      <div className="opcion-fila">
        {onCancel && (
          <button className="ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <span className="spacer" />
        <button className="primary" disabled={ocupado || !c.nombre?.trim()} onClick={guardar}>
          {ocupado ? 'Guardando…' : canal ? 'Guardar' : 'Crear el canal'}
        </button>
      </div>
    </section>
  )
}

/** Fichas que se añaden con Enter o coma. A diferencia de los hashtags, llevan espacios. Con `red`, el logo de la suya. */
function Fichas({ lista, onCambio, placeholder, red }: { lista: string[]; onCambio(l: string[]): void; placeholder: string; red?: boolean }) {
  const [nueva, setNueva] = useState('')
  const agregar = () => {
    const t = nueva.trim()
    if (t && !lista.some((x) => x.toLowerCase() === t.toLowerCase())) onCambio([...lista, t])
    setNueva('')
  }
  return (
    <span className="tags fichas">
      {lista.map((t) => (
        <span className="tag" key={t}>
          {red && <Logo de={redDeReferencia(t)} chico />}
          {t}
          <button type="button" title="Quitar" onClick={() => onCambio(lista.filter((x) => x !== t))}>
            ✕
          </button>
        </span>
      ))}
      <input
        value={nueva}
        placeholder={placeholder}
        onChange={(e) => setNueva(e.target.value)}
        onBlur={agregar}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') (e.preventDefault(), agregar())
          else if (e.key === 'Backspace' && !nueva && lista.length) onCambio(lista.slice(0, -1))
        }}
      />
    </span>
  )
}

export function Perfil({
  d,
  vista,
  filtro,
  onFiltro,
  onEditar,
  onBorrar,
  onPreguntar
}: {
  d: CanalCompleto
  vista: Investigacion | null
  filtro: string | null
  onFiltro(t: string | null): void
  onEditar(): void
  onBorrar(): void
  onPreguntar(campo?: string): void
}) {
  // Un campo vacío ofrece la entrevista en vez de un hueco.
  const pregunta = (campo: string) => (
    <button className="no-se" onClick={() => onPreguntar(campo)}>
      No sé, pregúntame
    </button>
  )
  const c = d.canal
  const vertical = esVertical(c)
  // Tu piso: lo que saca hoy un video tuyo. En vertical, uno por red.
  const pisos = vertical
    ? ([
        ['Tu piso en TikTok', vista?.canales.find((x) => x.de === TU_CANAL)],
        ['Tu piso en Instagram', vista?.canales.find((x) => x.de === TU_INSTAGRAM)]
      ] as const)
    : ([['Tu piso', vista?.canales.find((x) => x.propio)]] as const)
  const buscada = new Set(vista?.terminos.map((t) => t.termino))
  const sinLeer = new Set(sinInvestigar(d.investigacion, c))
  // Una ficha que ya se investigó lleva a lo que trajo; una nueva aún no tiene nada que enseñar. En vertical, una frase en
  // inglés lo dice.
  const ficha = (s: string) =>
    buscada.has(s) ? (
      <button key={s} className={`ficha boton ${filtro === s ? 'on' : ''}`} title="Ver los outliers que trajo esta búsqueda" onClick={() => onFiltro(filtro === s ? null : s)}>
        {s}
        {vertical && <Idioma de={idiomaDe(s)} title={BUSQUEDA_EN} />}
      </button>
    ) : (
      <span key={s} className="ficha" title="Aún sin investigar">
        {s}
        {vertical && <Idioma de={idiomaDe(s)} title={BUSQUEDA_EN} />}
      </span>
    )
  return (
    <section className="opcion perfil">
      <div className="skill-name">
        <strong>
          {c.nombre}
          {c.handle && (
            <span className="muted small">
              {' '}
              · {vertical && <Logo de="tiktok" chico />}
              {c.handle}
            </span>
          )}
          {vertical && c.instagram && (
            <span className="muted small">
              {' '}
              · <Logo de="instagram" chico />
              {c.instagram}
            </span>
          )}
        </strong>
        <span className="perfil-acciones">
          <button className="ghost small" onClick={() => onPreguntar()} title="Claude te hace preguntas para afinar el canal">
            Preguntarme
          </button>
          <button className="ghost small" onClick={onEditar}>
            Editar
          </button>
          <button className="ghost small peligro" onClick={onBorrar}>
            Borrar
          </button>
        </span>
      </div>
      <dl>
        <dt>Le habla a</dt>
        <dd>
          {c.publico || (
            <>
              <span className="muted">Sin decir, y es lo que más pesa.</span> {pregunta('publico')}
            </>
          )}
        </dd>
        <dt>Para</dt>
        <dd>{c.meta || pregunta('meta')}</dd>
        <dt>Busca</dt>
        <dd>
          {c.semillas.length ? (
            c.semillas.map(ficha)
          ) : (
            <>
              <span className="muted">Sin términos todavía.</span> {pregunta('semillas')}
            </>
          )}
        </dd>
        {c.referencias.length > 0 && (
          <>
            <dt>Conoce</dt>
            <dd>
              {c.referencias.map((s) => (
                <span key={s} className="ficha" title={sinLeer.has(s) ? 'Aún sin leer' : undefined}>
                  {vertical && <Logo de={redDeReferencia(s)} chico />}
                  {s}
                </span>
              ))}
            </dd>
          </>
        )}
        <dt>Vecinos</dt>
        <dd>{c.vecinos.length ? c.vecinos.map(ficha) : pregunta('vecinos')}</dd>
        {pisos.map(
          ([nombre, x]) =>
            x && (
              <Fragment key={nombre}>
                <dt>{nombre}</dt>
                <dd>
                  Un video{vertical ? '' : ' largo'} tuyo saca hoy <strong>{mil(x.mediana)}</strong> {x.mediana === 1 ? 'vista' : 'vistas'} (mediana de tus
                  últimos {x.videos} videos{vertical ? '' : ' largos'}
                  {x.videos < MIN_MUESTRA ? ': aún son pocos para fiarse' : ''}).
                </dd>
              </Fragment>
            )
        )}
      </dl>
      <p className="muted small mono carpeta">{d.carpeta}</p>
    </section>
  )
}

/** De dónde llegó la gente, como lo dice Studio. `SUBSCRIBER` es «Funciones de exploración»: el inicio y las suscripciones. */
const FUENTE: Record<string, string> = {
  YT_SEARCH: 'Búsqueda',
  SUBSCRIBER: 'Inicio',
  RELATED_VIDEO: 'Sugeridos',
  YT_CHANNEL: 'Tu canal',
  EXT_URL: 'Fuera de YouTube',
  NO_LINK_OTHER: 'Directo',
  YT_OTHER_PAGE: 'Otras páginas',
  PLAYLIST: 'Listas',
  SHORTS: 'Shorts',
  NOTIFICATION: 'Notificaciones',
  END_SCREEN: 'Pantalla final',
  HASHTAGS: 'Hashtags',
  ADVERTISING: 'Anuncios'
}
const APARATO: Record<string, string> = { MOBILE: 'teléfono', DESKTOP: 'computadora', TV: 'tele', TABLET: 'tableta', GAME_CONSOLE: 'consola' }
const pais = new Intl.DisplayNames('es', { type: 'region' })
const fechaCorta = (f: string) => `${Number(f.slice(8, 10))} ${MESES[Number(f.slice(5, 7)) - 1]}`
/**
 * Qué tan bien va un número contra lo que se sabe de videos largos: el % de clics de la miniatura (2–10 % es lo normal),
 * qué parte del video ven y cuántos siguen a los 30 s.
 */
const nivel = (n: number | undefined, bien: number, mal: number) => (n === undefined ? '' : n >= bien ? 'bien' : n < mal ? 'mal' : '')
/** Con menos impresiones que esto, el % de clics es azar: 9 clics en 74 dan 12 %. */
const POCAS = 300
const pct = (n?: number) => (n === undefined ? '—' : `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`)

/**
 * Tus videos: cómo le fue a cada video largo del canal que conectaste en YouTube, y lo que Claude concluyó de eso
 * (`diagnostico.md`). Claude lo lee antes de proponer ideas, para que la siguiente tanda corrija lo que no funcionó.
 */
export function TusVideos({ d, elegir, sessions, onHilo, onCambio }: { d: CanalCompleto; elegir?: Choice; sessions: SessionMeta[]; onHilo(id: string): void; onCambio(): void }) {
  const r = d.rendimiento
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  const vivo = sessions.find((s) => s.id === d.diagnosticoHilo?.id)
  const diagnosticando = !!vivo && (vivo.running || !!vivo.background?.length)

  const actualizar = () => (setError(''), setLeyendo(true), api(`/api/ideas/${d.canal.id}/rendimiento`, {}).then(onCambio, (e) => setError(e.message)).finally(() => setLeyendo(false)))
  function diagnosticar() {
    if (!elegir) return setError('No hay ningún modelo de Claude disponible.')
    setError('')
    setLeyendo(true)
    api<SessionMeta>(`/api/ideas/${d.canal.id}/diagnosticar`, elegir)
      .then(onCambio, (e) => setError(e.message))
      .finally(() => setLeyendo(false))
  }
  const a = r?.audiencia
  const edades = a?.edades.filter(([, n]) => n >= 5) ?? []

  return (
    <section className="ideas-bloque tus-videos">
      <div className="ideas-bloque-head">
        <h2>Tus videos</h2>
        <span className="muted small">
          {r ? `${r.videos.length} videos largos de los últimos 90 días · leídos ${hace(r.medido)}` : 'Cómo le fue a cada video largo de tu canal'}
        </span>
        <span className="spacer" />
        {r && (
          <button className="ghost small" disabled={leyendo || diagnosticando} onClick={actualizar} title="Lee otra vez tus números de YouTube. Tarda unos segundos">
            {leyendo && !diagnosticando ? 'Leyendo…' : 'Actualizar'}
          </button>
        )}
        {diagnosticando ? (
          <button className="ghost small" onClick={() => onHilo(vivo!.id)}>
            Abrir el hilo →
          </button>
        ) : (
          <button
            className="primary"
            disabled={leyendo || !elegir}
            onClick={r ? diagnosticar : actualizar}
            title={r ? `Claude suma lo que dice Studio y te dice qué cambiar en la siguiente tanda${elegir ? `, con ${elegir.model}` : ''}` : undefined}
          >
            {r ? 'Diagnosticar' : leyendo ? 'Leyendo…' : 'Leer mis números'}
          </button>
        )}
      </div>
      {error && <p className="bad small">{error}</p>}
      {!r && (
        <p className="muted small">
          Hermit lee de YouTube, con el canal que conectaste para subir, cómo le fue a cada video largo: cuántos lo vieron, qué parte vieron, cuántos seguían a los 30
          segundos y de dónde llegaron. Luego Claude suma lo que solo dice Studio (cuántos vieron la miniatura y cuántos hicieron clic) y te dice qué cambiar.
        </p>
      )}
      {diagnosticando && (
        <div className="trabajo trabajando">
          <div className="trabajo-estado">
            <span className="spinner" />
            <strong>Claude está revisando tus videos</strong>
            <span className="muted small">Lee Studio en su navegador y escribe el diagnóstico aquí abajo.</span>
          </div>
        </div>
      )}
      {r && r.videos.length > 0 && (
        <>
          <table className="tabla tus-videos-tabla">
            <thead>
              <tr>
                <th />
                <th>Video</th>
                <th className="num" title="Las veces que YouTube enseñó la miniatura. De Studio">
                  Mostrado
                </th>
                <th className="num" title="De cada 100 que vieron la miniatura, cuántos entraron. De Studio; lo normal es de 2 a 10 %">
                  Clics
                </th>
                <th className="num">Vistas</th>
                <th className="num" title="Qué parte del video ve cada quien, en promedio">
                  Visto
                </th>
                <th className="num" title="Cuántos de cada 100 siguen viendo a los 30 segundos">
                  A los 30 s
                </th>
                <th>Llegaron por</th>
              </tr>
            </thead>
            <tbody>
              {r.videos.map((v) => {
                const fuentes = v.fuentes ?? []
                const total = fuentes.reduce((s, [, n]) => s + n, 0)
                const [fuente, vistas] = fuentes[0] ?? []
                return (
                  <tr key={v.id} className={v.privado ? 'privado' : ''}>
                    <td className="celda-mini">
                      <a href={enYoutube(v.id)} target="_blank" rel="noreferrer">
                        <img src={miniatura(v.id)} alt="" loading="lazy" />
                      </a>
                    </td>
                    <td>
                      <a className="titulo-video" href={enYoutube(v.id)} target="_blank" rel="noreferrer">
                        {v.titulo}
                      </a>
                      <div className="muted small">
                        {fechaCorta(v.fecha)} · {Math.round(v.segundos / 60)} min
                        {v.privado && <span className="idea-marca">privado</span>}
                      </div>
                    </td>
                    <td className="num">{mil(v.impresiones)}</td>
                    <td
                      className={`num ${(v.impresiones ?? 0) >= POCAS ? nivel(v.ctr, 3, 2) : ''}`}
                      title={v.impresiones !== undefined && v.impresiones < POCAS ? `Con ${v.impresiones} impresiones, el % todavía no dice mucho` : undefined}
                    >
                      {pct(v.ctr)}
                    </td>
                    <td className="num">{v.vistas.toLocaleString('es-MX')}</td>
                    <td className={`num ${nivel(v.visto, 40, 25)}`} title={v.duracionMedia ? `${Math.floor(v.duracionMedia / 60)}:${String(v.duracionMedia % 60).padStart(2, '0')} en promedio` : undefined}>
                      {pct(v.visto)}
                    </td>
                    <td className={`num ${nivel(v.a30, 65, 50)}`} title={v.a60 !== undefined ? `Al minuto: ${v.a60} %` : undefined}>
                      {pct(v.a30)}
                    </td>
                    <td className="llegaron" title={fuentes.map(([f, n]) => `${FUENTE[f] ?? f}: ${n}`).join('\n')}>
                      {fuente ? (
                        <>
                          {FUENTE[fuente] ?? fuente} <span className="muted">{Math.round((vistas! / Math.max(1, total)) * 100)} %</span>
                          {v.busquedas?.[0] && <div className="muted small">«{v.busquedas[0][0]}»</div>}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="muted small">
            {r.studio ? `Mostrado y clics: de Studio, leídos el ${fechaCorta(r.studio)} al diagnosticar.` : 'Mostrado y clics salen de Studio: los lee Claude al diagnosticar.'} Lo demás
            es de YouTube Analytics, que tarda 2 o 3 días en dar un video nuevo.
          </p>
        </>
      )}
      {a && (
        <dl className="audiencia">
          <dt>Quién te ve</dt>
          <dd>
            {edades.map(([e, n]) => `${e} (${Math.round(n)} %)`).join(', ') || 'Sin datos de edad'}
            {a.paises.length > 0 && ` · ${a.paises.map(([p, n]) => `${pais.of(p) ?? p} ${Math.round(n)} %`).join(', ')}`}
          </dd>
          <dt>En qué</dt>
          <dd>{a.dispositivos.map(([x, n]) => `${APARATO[x] ?? x.toLowerCase()} ${Math.round(n)} %`).join(', ')}</dd>
          {a.deSuscriptores !== undefined && (
            <>
              <dt>Suscriptores</dt>
              <dd>
                {r!.canal.suscriptores} · de ellos sale el {pct(a.deSuscriptores)} de tus vistas
              </dd>
            </>
          )}
        </dl>
      )}
      {d.diagnostico ? (
        <div className="diagnostico">
          <div className="caja-l">Diagnóstico</div>
          <Md texto={d.diagnostico} />
        </div>
      ) : (
        r &&
        !diagnosticando && <p className="muted small">Pulsa «Diagnosticar»: Claude suma lo que dice Studio y te dice qué cambiar en la siguiente tanda.</p>
      )}
    </section>
  )
}

/** Los pasos del canal, de un vistazo: qué está hecho, qué está en marcha y qué sigue. */
export function Pasos({ d, corriendo }: { d: CanalCompleto; corriendo: boolean }) {
  const t = d.trabajo
  const n = d.ideas?.ideas.length ?? 0
  const grabar = Object.keys(d.esquemas).length
  const pasos: { nombre: string; estado: 'ok' | 'on' | 'no'; texto: string }[] = [
    { nombre: 'Canal', estado: d.canal.publico ? 'ok' : 'on', texto: d.canal.publico ? 'Público definido' : 'Falta decir a quién le hablas' },
    {
      nombre: 'Investigación',
      estado: t?.estado === 'trabajando' ? 'on' : d.investigacion?.videos.length ? 'ok' : 'no',
      texto: t?.estado === 'trabajando' ? t.fase : d.investigacion?.hecha ? `Hecha ${hace(d.investigacion.hecha)}` : 'Sin hacer'
    },
    {
      nombre: 'Ideas',
      estado: corriendo ? 'on' : n ? 'ok' : 'no',
      texto: corriendo ? (d.formatos ? 'Escribiendo las ideas' : d.demanda ? 'Buscando fórmulas' : 'Leyendo la demanda') : n ? `${n} ideas` : 'Sin proponer'
    },
    { nombre: 'Para grabar', estado: grabar ? 'ok' : 'no', texto: grabar ? `${grabar} con esquema` : 'Elige una idea' }
  ]
  return (
    <ol className="ideas-pasos">
      {pasos.map((p, i) => (
        <li key={p.nombre} className={p.estado}>
          <span className="ideas-paso-n">{p.estado === 'ok' ? '✓' : i + 1}</span>
          <span>
            <strong>{p.nombre}</strong>
            <small>{p.texto}</small>
          </span>
        </li>
      ))}
    </ol>
  )
}
