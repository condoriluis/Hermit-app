import { useEffect, useMemo, useRef, useState } from 'react'
import {
  compartidosPorMil,
  esOutlier,
  esVertical,
  guardadosPorMil,
  medible,
  MIN_MUESTRA,
  MIN_VISTAS,
  MIN_VISTAS_VERTICAL,
  OUTLIER,
  porMil,
  sospechoso,
  usuarioDe,
  veces,
  viejo
} from '../../shared/ideas'
import type { Canal, CanalCompleto, CuentaInvestigacion, Investigacion, PasoYT, RedVertical, Temas, TerminoYT, VideoYT } from '../../shared/types'
import { api } from './api'
import { Logo } from './Logos'
import { Segmento } from './Segmento'
import { BUSQUEDA_EN, dura, enlace, enEspanol, fechaDe, hace, Idioma, mil, miniatura, meses, Portada, sinVistas, tuyo, xMil } from './IdeasBase'

/**
 * Las cuentas con que se investiga (buscan y leen comentarios), nunca las que publican: una de TikTok y una de Instagram,
 * en el mismo Edge. Sin sesión, «Iniciar sesión» abre ese Edge en el login de su red; mientras está abierto y falta
 * alguna, se vuelve a mirar cada pocos segundos.
 */
function CuentasInvestigacion({ canal, trabajando }: { canal: Canal; trabajando: boolean }) {
  const [c, setC] = useState<CuentaInvestigacion | null>(null)
  // La red cuyo login se abrió desde aquí: a esa le toca la indicación de la ventana de Edge.
  const [abierta, setAbierta] = useState<RedVertical | null>(null)
  const [error, setError] = useState('')
  const leer = () => api<CuentaInvestigacion>(`/api/ideas/${canal.id}/tiktok`).then((r) => (setC(r), setError('')), (e) => setError(e.message))
  // Al investigar también se abre: al acabar, la sesión pudo cambiar.
  useEffect(() => void leer(), [canal.id, trabajando])
  const falta = !!c && (!c.cuenta || !c.instagram)
  useEffect(() => {
    if (!c?.abierto || !falta) return
    const i = setInterval(leer, 4000)
    return () => clearInterval(i)
  }, [c?.abierto, falta])
  const abrir = (red: RedVertical) => (setError(''), setAbierta(red), api(`/api/ideas/${canal.id}/navegador`, { red }).then(leer, (e) => setError(e.message)))
  if (!c) return error ? <p className="bad small">{error}</p> : null
  // Con su Edge cerrado no se puede preguntar por la sesión: se abre solo al investigar, con las sesiones de su perfil.
  if (!c.abierto)
    return (
      <div className="cuentas-investigacion small">
        <div className="cuenta-red">
          <Logo de="tiktok" chico />
          <Logo de="instagram" chico />
          <span className="muted">Cuentas de investigación: su navegador está cerrado. Se abre solo al investigar, con las sesiones guardadas.</span>
          <button className="ghost small" onClick={() => abrir('tiktok')} title="Abrirlo ahora para ver con quién tiene sesión cada red">
            Abrirlo
          </button>
        </div>
        {error && <span className="bad">{error}</span>}
      </div>
    )
  const tuya = canal.instagram ? `@${usuarioDe(canal.instagram)}` : 'la tuya'
  const redes = [
    {
      red: 'tiktok' as const,
      usuario: c.cuenta,
      pista: c.abierto && abierta !== 'instagram' ? 'Inicia sesión con el QR en la ventana de Edge.' : 'Con ella busca Hermit y lee los comentarios.'
    },
    {
      red: 'instagram' as const,
      usuario: c.instagram ?? null,
      pista: `${c.abierto && abierta === 'instagram' ? 'Inicia sesión en la ventana de Edge. ' : ''}Que sea una cuenta desechable, nunca ${tuya}.`
    }
  ]
  return (
    <div className="cuentas-investigacion small">
      {redes.map(({ red, usuario, pista }) => (
        <div key={red} className="cuenta-red">
          <Logo de={red} chico />
          {usuario ? (
            <span>
              Cuenta de investigación: <strong>@{usuarioDe(usuario)}</strong>
            </span>
          ) : (
            <>
              <span className="muted">Cuenta de investigación: sin sesión. {pista}</span>
              <button className="ghost small" onClick={() => abrir(red)}>
                Iniciar sesión
              </button>
            </>
          )}
        </div>
      ))}
      {error && <span className="bad">{error}</span>}
    </div>
  )
}

/**
 * Lo que lleva la investigación en curso, contando solo: la sección, con sus tablas, no se vuelve a dibujar cada segundo
 * para moverlo.
 */
function Cronometro({ desde }: { desde: number }) {
  const [ahora, setAhora] = useState(Date.now)
  useEffect(() => {
    const i = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])
  const s = Math.max(0, Math.round((ahora - desde) / 1000))
  return <>{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</>
}

export function Investigacion({
  d,
  vista,
  onCambio,
  filtro,
  onFiltro
}: {
  d: CanalCompleto
  vista: Investigacion | null
  onCambio(): void
  filtro: string | null
  onFiltro(t: string | null): void
}) {
  const t = d.trabajo
  const trabajando = t?.estado === 'trabajando'
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState<'outliers' | 'temas' | 'busquedas' | 'canales'>('outliers')
  const [todo, setTodo] = useState(false)
  const lista = useRef<HTMLOListElement>(null)
  const tablas = useRef<HTMLDivElement>(null)

  // Al elegir una búsqueda, se ven sus outliers.
  useEffect(() => {
    if (!filtro) return
    setPestana('outliers')
    requestAnimationFrame(() => tablas.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [filtro])

  // El registro baja solo mientras se escribe.
  useEffect(() => {
    if (trabajando) lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' })
  }, [t?.pasos.length, trabajando])

  const empezar = () => (setError(''), api(`/api/ideas/${d.canal.id}/investigar`, {}).then(onCambio, (e) => setError(e.message)))
  const pasos = t ? (trabajando || todo ? t.pasos : t.pasos.slice(-6)) : []
  const segundos = t ? Math.round(((t.termino ?? Date.now()) - t.empezo) / 1000) : 0
  const toda = d.investigacion
  const inv = vista
  // Lo que se buscó con términos que ya no están en el perfil: se guarda, pero no cuenta. Una frase vertical son dos
  // búsquedas (TikTok e Instagram): se cuentan las frases.
  const frases = (x: Investigacion) => new Set(x.terminos.map((t) => t.termino)).size
  const fuera = toda && inv ? frases(toda) - frases(inv) : 0
  const vertical = esVertical(d.canal)
  // La pestaña Temas, solo si la investigación ya los agrupó.
  const temas = d.temas?.temas.length ? d.temas : null
  const ver = pestana === 'temas' && !temas ? 'outliers' : pestana

  return (
    <section className="ideas-bloque">
      <div className="ideas-bloque-head">
        <h2>Investigación</h2>
        <span className="muted small">
          {inv?.hecha
            ? `${inv.terminos.length} búsquedas · ${inv.canales.length} ${vertical ? 'cuentas' : 'canales'} · ${inv.videos.filter(esOutlier).length} outliers`
            : vertical
              ? 'Lo que TikTok e Instagram dicen de tu nicho'
              : 'Lo que YouTube dice de tu nicho'}
        </span>
        <span className="spacer" />
        {trabajando ? (
          <button className="ghost" onClick={() => api(`/api/ideas/${d.canal.id}/detener`, {})}>
            Detener
          </button>
        ) : (
          <button
            className="primary"
            disabled={!d.ytdlp}
            onClick={empezar}
            title={
              vertical
                ? 'Busca cada término en TikTok y en Instagram, abre las cuentas que salen y mide cada video contra su cuenta. Lo hecho en los últimos 3 días no se repite'
                : 'Busca cada término, abre los canales que salen y mide cada video contra su canal. Lo hecho en los últimos 3 días no se repite'
            }
          >
            {toda?.videos.length ? 'Investigar otra vez' : 'Investigar'}
          </button>
        )}
      </div>
      {!d.ytdlp && (
        <p className="bad small">
          Falta yt-dlp para leer {vertical ? 'TikTok e Instagram' : 'YouTube'}: instala el Python de Hermit, o corre «python -m pip install yt-dlp».
        </p>
      )}
      {vertical && <CuentasInvestigacion canal={d.canal} trabajando={trabajando} />}
      {vertical && !d.meta && (
        <p className="muted small">
          Sin el token de Meta, las cuentas de Instagram no se miden: sus Reels no tienen vistas ni salen como outliers. Ponlo en ⚙ Opciones → Llaves de API →
          «Instagram (Meta)».
        </p>
      )}
      {fuera > 0 && (
        <p className="muted small">
          {fuera === 1 ? 'Una búsqueda de antes ya no está' : `${fuera} búsquedas de antes ya no están`} en tu perfil: lo que trajeron no cuenta aquí ni en las ideas. Sigue
          guardado, por si las vuelves a poner.
        </p>
      )}
      {!toda && !t && vertical && (
        <p className="muted small">
          Hermit busca cada término en TikTok y en Instagram, cada red con su cuenta de investigación; la de Instagram es una cuenta desechable aparte, nunca{' '}
          {d.canal.instagram ? `@${usuarioDe(d.canal.instagram)}` : 'la tuya'}. Abre las cuentas de los videos más vistos y mide cada video contra la mediana de su
          cuenta: los que sacan {OUTLIER} veces o más, con al menos {mil(MIN_VISTAS_VERTICAL)} vistas, son outliers. De los mejores lee los comentarios con más
          likes, para saber qué pide la gente. También transcribe lo que se dice en cada video y lo agrupa en temas por lo que dicen, aunque estén en otro
          idioma.
        </p>
      )}
      {!toda && !t && !vertical && (
        <p className="muted small">
          Hermit busca cada término en YouTube y se queda con los videos de 4 minutos o más. Abre los canales de los más vistos y mide cada video contra la mediana
          de sus videos largos: los que sacan {OUTLIER} veces o más, con al menos {mil(MIN_VISTAS)} vistas, son outliers, una señal de que ese tema tiene demanda. También transcribe lo que se dice en cada video y lo agrupa en temas por lo que dicen. Tarda unos minutos y no gasta nada.
        </p>
      )}
      {!vertical && !d.api && (toda || t) && (
        <p className="muted small">
          Sin la llave de la API de YouTube, la fecha y los comentarios salen solo de los 30 mejores outliers, uno por uno. Con ella, de todos y en segundos: ⚙
          Opciones → API de YouTube.
        </p>
      )}
      {error && <p className="bad small">{error}</p>}
      {t && (
        <div className={`trabajo ${t.estado}`}>
          <div className="trabajo-estado">
            {trabajando && <span className="spinner" />}
            <strong>{trabajando ? t.fase : t.estado === 'listo' ? 'Última investigación' : t.estado === 'detenido' ? 'Detenida' : 'Falló'}</strong>
            <span className="muted small">
              {trabajando ? <Cronometro desde={t.empezo} /> : `${hace(t.termino ?? t.empezo)} · duró ${Math.max(1, Math.round(segundos / 60))} min`}
            </span>
            <span className="spacer" />
            {!trabajando && t.pasos.length > 6 && (
              <button className="ghost small" onClick={() => setTodo(!todo)}>
                {todo ? 'Ver menos' : `Ver los ${t.pasos.length} pasos`}
              </button>
            )}
          </div>
          {trabajando && (
            <div className="barra" title={`${t.hecho} de unos ${t.total} pasos`}>
              <span style={{ width: `${Math.min(100, (t.hecho / Math.max(1, t.total)) * 100)}%` }} />
            </div>
          )}
          <ol className="registro" ref={lista}>
            {pasos.map((p, i) => (
              <li key={`${p.at}-${i}`} className={p.tipo}>
                <span className="registro-icono">{ICONO[p.tipo]}</span>
                <span className="registro-texto">
                  {p.texto}
                  {p.detalle && <small>{p.detalle}</small>}
                </span>
                <time className="muted small">{new Date(p.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</time>
              </li>
            ))}
          </ol>
          {t.error && <p className="bad small">{t.error}</p>}
        </div>
      )}
      {inv && inv.videos.length > 0 && (
        <>
          <div className="segmento pestanas" role="tablist" ref={tablas}>
            {(
              [
                ['outliers', 'Outliers'],
                ['temas', 'Temas'],
                ['busquedas', 'Búsquedas'],
                ['canales', vertical ? 'Cuentas' : 'Canales']
              ] as const
            )
              .filter(([k]) => k !== 'temas' || temas)
              .map(([k, nombre]) => (
                <button key={k} role="tab" aria-selected={ver === k} className={ver === k ? 'on' : ''} onClick={() => setPestana(k)}>
                  {nombre}
                </button>
              ))}
          </div>
          {ver === 'outliers' && <Outliers inv={inv} canal={d.canal} temas={d.temas} filtro={filtro} onFiltro={onFiltro} />}
          {ver === 'temas' && temas && <TablaTemas temas={temas} inv={inv} canal={d.canal} />}
          {ver === 'busquedas' && <Busquedas inv={inv} vertical={vertical} onFiltro={onFiltro} />}
          {ver === 'canales' && <Canales inv={inv} vertical={vertical} />}
        </>
      )}
    </section>
  )
}

/** Las señales de un video que cambian lo que vale como evidencia. Dicen lo que se ve en los datos, no lo que se supone. */
function Marcas({ v, propio }: { v: VideoYT; propio?: boolean }) {
  return (
    <>
      {propio && <span className="idea-marca">{v.red ? 'tu cuenta' : 'tu canal'}</span>}
      <Idioma de={v.idioma} />
      {v.sinVoz && (
        <span className="idea-marca" title="El gancho está en la imagen, no en lo dicho">
          sin voz
        </span>
      )}
      {v.fijado && (
        <span className="idea-marca" title="Fijado arriba de su perfil: suele ser viejo y no entra en la mediana de su cuenta">
          fijado
        </span>
      )}
      {sospechoso(v) && (
        <span
          className="idea-marca mal"
          title={`${v.comentarios} comentarios en ${mil(v.vistas)} vistas (${porMil(v)!.toFixed(3)} por mil): inusualmente pocos; uno orgánico anda entre 0,4 y 30. Puede ser publicidad pagada o tener los comentarios cerrados. Míralo antes de contarlo como demanda.`}
        >
          pocos comentarios
        </span>
      )}
      {v.pagado && (
        <span className="idea-marca mal" title="Colaboración pagada: sus vistas no son demanda orgánica. Sirve por su empaque, no como prueba de que el tema se pide">
          pagado
        </span>
      )}
      {viejo(v.fecha) && (
        <span className="idea-marca" title="De hace más de un año: en temas que caducan (IA, tecnología) vale poco">
          viejo
        </span>
      )}
    </>
  )
}

/**
 * En vertical, si lo que funciona en otro idioma ya existe en español (`temas.json`): cuántos parecidos tiene, o el hueco,
 * que es lo que está por traerse.
 */
function Parecidos({ de, videos }: { de: [string, number][]; videos: Map<string, VideoYT> }) {
  if (!de.length)
    return (
      <span className="idea-marca hueco" title="Funciona en otro idioma y en español no hay nada que hable de lo mismo: está por traerse">
        nada parecido en español
      </span>
    )
  const lista = de.map(([id, s]) => `${Math.round(s * 100)} % · ${videos.get(id)?.titulo.replace(/\s+/g, ' ').slice(0, 90) ?? id}`)
  return (
    <span className="idea-marca" title={`Lo más parecido en español:\n${lista.join('\n')}`}>
      en español: {de.length} {de.length === 1 ? 'parecido' : 'parecidos'}
    </span>
  )
}

/** Un video en una línea, con su portada o miniatura y su enlace: la evidencia de una idea, o lo mejor de un tema. */
export function VideoFila({ v, canalId, propio }: { v: VideoYT; canalId: string; propio?: boolean }) {
  return (
    <a className="evidencia" href={enlace(v)} target="_blank" rel="noreferrer">
      {v.red ? <Portada canalId={canalId} v={v} /> : <img src={miniatura(v.id)} alt="" loading="lazy" />}
      <span>
        <span className="evidencia-t">{v.titulo}</span>
        <span className="muted small">
          {sinVistas(v) ? (
            <span title="Un Reel de la búsqueda de Instagram: sus vistas llegan al medir la cuenta de su autor, y esta no se pudo medir">
              sin vistas: cuenta no medible
            </span>
          ) : (
            <>
              {v.x !== undefined ? (
                <span className="x">{veces(v.x)}</span>
              ) : (
                <span title="Su canal no se abrió o no se pudo medir: dice que el tema se busca, no que superó a su canal">sin medir</span>
              )}{' '}
              · {mil(v.vistas)} {v.red && guardadosPorMil(v) !== undefined && `· ${xMil(guardadosPorMil(v))} guard./mil `}
            </>
          )}
          · {fechaDe(v)} · {v.canal} <Marcas v={v} propio={propio} />
        </span>
        {v.gancho && (
          <span className="evidencia-dice small" title={v.gancho}>
            <span className="muted">Dice:</span> «{v.gancho}»
          </span>
        )}
      </span>
    </a>
  )
}

const ICONO: Record<PasoYT['tipo'], string> = { buscar: '🔎', canal: '📺', fecha: '📅', comentarios: '💬', transcribir: '🎙', temas: '🧭', pausa: '⏸', error: '⚠', info: '·' }

function Outliers({
  inv,
  canal,
  temas,
  filtro,
  onFiltro
}: {
  inv: Investigacion
  canal: Canal
  temas?: Temas | null
  filtro: string | null
  onFiltro(t: string | null): void
}) {
  const [orden, setOrden] = useState<'x' | 'vistas' | 'fecha'>('x')
  // Pocos comentarios es una señal para mirar, no una prueba: se ven por defecto, con su dato.
  const [ocultarRaros, setOcultarRaros] = useState(false)
  const [recientes, setRecientes] = useState(false)
  const [idioma, setIdioma] = useState<'todos' | 'es' | 'en'>('todos')
  const [cuantos, setCuantos] = useState(40)
  const vertical = esVertical(canal)
  const propios = new Set(inv.canales.filter(tuyo).map((c) => c.id))
  const todos = inv.videos.filter((v) => esOutlier(v) && !propios.has(v.canalId))
  const conFecha = todos.filter((v) => v.fecha).length
  // El español es la demanda de quien compra; el inglés, empaque y modas para traer. Se separan solo si hay de los dos.
  const dosIdiomas = vertical && todos.some((v) => enEspanol(v.idioma)) && todos.some((v) => v.idioma === 'en')
  const enIdioma = dosIdiomas ? idioma : 'todos'
  const filas = useMemo(
    () =>
      todos
        .filter((v) => !filtro || v.de.includes(filtro))
        .filter((v) => enIdioma === 'todos' || (enIdioma === 'en' ? v.idioma === 'en' : enEspanol(v.idioma)))
        .filter((v) => !ocultarRaros || !sospechoso(v))
        .filter((v) => !recientes || (meses(v.fecha) ?? Infinity) <= 12)
        .sort((a, b) => (orden === 'x' ? (b.x ?? 0) - (a.x ?? 0) : orden === 'vistas' ? b.vistas - a.vistas : (b.fecha ?? '').localeCompare(a.fecha ?? ''))),
    [inv, orden, ocultarRaros, recientes, filtro, enIdioma]
  )
  const vecino = inv.terminos.find((t) => t.termino === filtro)?.vecino
  const porId = useMemo(() => new Map(inv.videos.map((v) => [v.id, v])), [inv])
  // En vertical, lo que no es en español dice si ya existe en español: así se ve lo que falta traer. Solo si ya se comparó:
  // un outlier que aún no está en temas.json no es «nada parecido», es que no se sabe.
  const parecidos = (v: VideoYT) => (vertical && temas && !enEspanol(v.idioma) ? (temas.enEspanol[v.id] ?? null) : null)
  return (
    <div className="tabla-wrap">
      {filtro && (
        <div className="filtro-activo small">
          <span>
            Solo {vertical ? 'las cuentas' : 'los canales'} que trajo «{filtro}»{vertical ? ', en TikTok y en Instagram' : ''}
            {vecino ? `, un nicho vecino: mira sus fórmulas de ${vertical ? 'gancho' : 'título'}, no su tema` : ''}
          </span>
          <button className="ficha boton on" onClick={() => onFiltro(null)}>
            Ver todos ✕
          </button>
        </div>
      )}
      <div className="filtros small">
        {dosIdiomas && (
          <Segmento<typeof idioma>
            label="Idioma"
            valor={enIdioma}
            onCambio={setIdioma}
            opciones={[
              { id: 'todos', texto: 'Todos' },
              { id: 'es', texto: 'Español', title: 'La demanda de quien compra. También los que no dicen su idioma (solo hashtags)' },
              { id: 'en', texto: 'Inglés', title: 'Empaque y modas que suelen llegar antes al español, para traerlas' }
            ]}
          />
        )}
        <span className="muted">Ordenar por</span>
        <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
          <option value="x">{vertical ? '× su cuenta' : '× su canal'}</option>
          <option value="vistas">vistas</option>
          <option value="fecha">más recientes</option>
        </select>
        <label title="Muchas vistas y casi ningún comentario (menos de 0,15 por mil). Puede ser publicidad pagada, o no">
          <input type="checkbox" checked={ocultarRaros} onChange={(e) => setOcultarRaros(e.target.checked)} /> Ocultar los de comentarios inusualmente bajos
        </label>
        <label title="Solo los que tienen fecha y son del último año">
          <input type="checkbox" checked={recientes} onChange={(e) => setRecientes(e.target.checked)} /> Solo del último año
        </label>
        <span className="spacer" />
        {vertical ? (
          <span className="muted">{filas.length} outliers</span>
        ) : (
          <span className="muted" title="Sin la llave de la API de YouTube, la fecha y los comentarios se leen solo de los mejores">
            {filas.length} outliers · {conFecha} de {todos.length} con fecha y comentarios
          </span>
        )}
      </div>
      <table className="tabla">
        <thead>
          <tr>
            <th />
            <th>Video</th>
            <th title={`Sus vistas entre la mediana de ${vertical ? 'los videos de su cuenta' : 'los videos largos de su canal'}`}>×</th>
            <th>Vistas</th>
            {vertical && <th title="Guardados por cada mil vistas: «esto lo voy a usar», lo más cercano a querer comprar">Guard./mil</th>}
            {vertical && <th title="Compartidos por cada mil vistas: «esto es para alguien»">Comp./mil</th>}
            {!vertical && <th>Fecha</th>}
            <th title="Comentarios por cada mil vistas. Uno orgánico anda entre 0,4 y 30; con muchas vistas y casi ninguno, míralo antes de contarlo">Com./mil</th>
            {vertical && <th>Fecha</th>}
          </tr>
        </thead>
        <tbody>
          {filas.slice(0, cuantos).map((v) => (
            <tr key={v.id}>
              <td className={v.red ? 'celda-portada' : 'celda-mini'}>
                <a href={enlace(v)} target="_blank" rel="noreferrer">
                  {v.red ? <Portada canalId={canal.id} v={v} /> : <img src={miniatura(v.id)} alt="" loading="lazy" />}
                </a>
              </td>
              <td>
                <a className={v.red ? 'titulo-video texto-vertical' : 'titulo-video'} href={enlace(v)} target="_blank" rel="noreferrer" title={v.red ? v.titulo : undefined}>
                  {v.titulo}
                </a>
                <div className="muted small">
                  {v.canal} · {dura(v)} · de {v.de.map((d) => `«${d}»`).join(', ')} <Marcas v={v} />
                  {parecidos(v) && <Parecidos de={parecidos(v)!} videos={porId} />}
                </div>
                {v.gancho && (
                  <div className="dice small" title={v.gancho}>
                    <span className="muted">Dice:</span> «{v.gancho}»
                  </div>
                )}
                {!!v.destacados?.length && (
                  <details className="destacados small">
                    <summary className="muted">💬 Lo que más se comenta</summary>
                    <ul>
                      {v.destacados.map((c, i) => (
                        <li key={i}>
                          {c.texto} <span className="muted">· {mil(c.likes)} likes</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </td>
              <td className="num x">{veces(v.x!)}</td>
              <td className="num">{mil(v.vistas)}</td>
              {vertical && <td className="num">{xMil(guardadosPorMil(v))}</td>}
              {vertical && <td className="num">{xMil(compartidosPorMil(v))}</td>}
              {!vertical && <td className="num muted">{fechaDe(v)}</td>}
              <td className={`num ${sospechoso(v) ? 'bad' : 'muted'}`}>{xMil(porMil(v))}</td>
              {vertical && <td className="num muted">{fechaDe(v)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {filas.length > cuantos && (
        <button className="ghost small" onClick={() => setCuantos(cuantos + 40)}>
          Ver {Math.min(40, filas.length - cuantos)} más
        </button>
      )}
    </div>
  )
}

/** Dónde se ve una búsqueda vertical por dentro de su red. */
const buscarEn = (t: TerminoYT) =>
  t.red === 'instagram'
    ? `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(t.termino)}`
    : `https://www.tiktok.com/search?q=${encodeURIComponent(t.termino)}`

/**
 * Las búsquedas, por frase. En vertical cada frase se busca en TikTok y en Instagram: la frase va una vez, con una fila por
 * red debajo. La búsqueda de Instagram no da vistas; su mediana es la de los Reels cuya cuenta se pudo medir.
 */
function Busquedas({ inv, vertical, onFiltro }: { inv: Investigacion; vertical: boolean; onFiltro(t: string): void }) {
  const max = Math.max(1, ...inv.terminos.map((t) => t.mediana))
  // Los outliers de una búsqueda son los de su red: los de la otra los cuenta su propia fila.
  const outliersDe = (t: TerminoYT) => inv.videos.filter((v) => v.de.includes(t.termino) && v.red === t.red && esOutlier(v)).length
  const videos = vertical ? 'videos' : 'videos largos'
  const porFrase = new Map<string, TerminoYT[]>()
  for (const t of inv.terminos) porFrase.set(t.termino, [...(porFrase.get(t.termino) ?? []), t])
  const grupos = [...porFrase.values()]
    .map((g) => g.sort((a, b) => Number(a.red === 'instagram') - Number(b.red === 'instagram')))
    .sort((a, b) => Math.max(...b.map((t) => t.mediana)) - Math.max(...a.map((t) => t.mediana)))
  return (
    <div className="tabla-wrap">
      <p className="muted small">
        La mediana de vistas de los {videos} que da cada búsqueda: la medida más tosca de la demanda, y la palabra con que el público lo pide. Mira las parecidas:
        «crear» contra «automatizar» puede cambiar todo.
        {vertical && ' En Instagram la búsqueda no da vistas: su mediana es la de los Reels cuya cuenta se pudo medir.'}
      </p>
      <table className="tabla busquedas">
        <thead>
          <tr>
            <th>Búsqueda</th>
            {vertical && <th>Red</th>}
            <th>Mediana</th>
            <th />
            <th title={`Outliers en ${vertical ? 'las cuentas' : 'los canales'} que trajo esta búsqueda`}>Outliers</th>
          </tr>
        </thead>
        {grupos.map((g) => {
          const { termino, vecino } = g[0]
          return (
            <tbody key={termino} className="frase">
              {g.map((t, i) => {
                const ig = t.red === 'instagram'
                return (
                  <tr key={t.red ?? 'youtube'}>
                    {i === 0 && (
                      <td rowSpan={g.length}>
                        <button className="titulo-video enlace" title="Ver los outliers que trajo, de las dos redes" onClick={() => onFiltro(termino)}>
                          {termino}
                        </button>{' '}
                        {vecino && <span className="idea-marca">nicho vecino</span>}
                        <Idioma de={g.find((x) => x.idioma)?.idioma} title={BUSQUEDA_EN} />
                        {!vertical && (
                          <div className="muted small">
                            {t.largos} {videos} ·{' '}
                            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(termino)}`} target="_blank" rel="noreferrer">
                              buscar en YouTube ↗
                            </a>
                          </div>
                        )}
                      </td>
                    )}
                    {vertical && (
                      <td className="busqueda-red muted small">
                        <Logo de={t.red ?? 'tiktok'} chico />
                        {t.largos} {ig ? 'Reels' : 'videos'} ·{' '}
                        <a href={buscarEn(t)} target="_blank" rel="noreferrer">
                          buscar en {ig ? 'Instagram' : 'TikTok'} ↗
                        </a>
                      </td>
                    )}
                    <td className="num" title={ig ? (t.mediana ? 'De los Reels cuya cuenta se pudo medir' : 'Ningún Reel de esta búsqueda se pudo medir') : undefined}>
                      {ig && !t.mediana ? '—' : mil(t.mediana)}
                    </td>
                    <td className="celda-barra">
                      <span className="barra-h" style={{ width: `${(t.mediana / max) * 100}%` }} />
                    </td>
                    <td className="num">{outliersDe(t) || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

function Canales({ inv, vertical }: { inv: Investigacion; vertical: boolean }) {
  // Contados en una pasada: el orden los pedía por cada par de canales, y recorrer los videos cada vez tardaba 80 ms.
  const cuenta = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const v of inv.videos) if (esOutlier(v)) cuenta.set(v.canalId, (cuenta.get(v.canalId) ?? 0) + 1)
    return cuenta
  }, [inv])
  const outliers = (id: string) => cuenta.get(id) ?? 0
  // Los suscriptores no miden nada aquí: solo dan contexto, y solo los da la API de YouTube.
  const conSubs = inv.canales.some((c) => c.subs !== undefined)
  const videos = vertical ? 'videos' : 'videos largos'
  return (
    <div className="tabla-wrap">
      {vertical ? (
        <p className="muted small">
          Cada video se compara con la <strong>mediana</strong> de los últimos videos de su cuenta, sin los fijados: lo que esa cuenta saca normalmente. Es outlier si
          saca {OUTLIER} veces eso y al menos {mil(MIN_VISTAS_VERTICAL)} vistas. Con menos de {MIN_MUESTRA} videos, la cuenta no se mide. Los seguidores no entran en el
          cálculo: solo dan contexto.
        </p>
      ) : (
        <p className="muted small">
          Cada video largo se compara con la <strong>mediana</strong> de los últimos videos largos de su canal: lo que ese canal saca normalmente. Es outlier si
          saca {OUTLIER} veces eso y al menos {mil(MIN_VISTAS)} vistas. Con menos de {MIN_MUESTRA} videos largos, el canal no se mide. Los suscriptores no entran en la cuenta
          {conSubs ? '.' : ': solo dan contexto, y salen con la llave de la API de YouTube (⚙ Opciones).'}
        </p>
      )}
      <table className="tabla">
        <thead>
          <tr>
            <th>{vertical ? 'Cuenta' : 'Canal'}</th>
            <th title={`Mediana de vistas de sus últimos ${videos}: su normal`}>Mediana</th>
            <th>Outliers</th>
            {conSubs && <th>{vertical ? 'Seguidores' : 'Suscriptores'}</th>}
          </tr>
        </thead>
        <tbody>
          {[...inv.canales]
            .sort((a, b) => Number(tuyo(b)) - Number(tuyo(a)) || outliers(b.id) - outliers(a.id))
            .map((c) => (
              <tr key={c.id}>
                <td>
                  {c.red ? (
                    <>
                      <Logo de={c.red} chico />
                      <a href={c.url} target="_blank" rel="noreferrer" title={c.nombre}>
                        @{usuarioDe(c.usuario ?? c.url)}
                      </a>
                    </>
                  ) : (
                    <a href={c.url} target="_blank" rel="noreferrer">
                      {c.nombre}
                    </a>
                  )}{' '}
                  {tuyo(c) && <span className="idea-marca">{c.red ? 'tu cuenta' : 'tu canal'}</span>}
                  <Idioma de={c.idioma} />
                  {!medible(c) ? (
                    <span className="idea-marca" title={`Su mediana sale de solo ${c.videos} ${videos}: es un azar, y sus videos no se miden`}>
                      muestra chica
                    </span>
                  ) : (
                    c.mediana < 100 && (
                      <span className="idea-marca" title="Con tan pocas vistas de normal, cualquier video parece outlier: no cuenta como demanda">
                        muy pocas vistas para medir
                      </span>
                    )
                  )}
                  <div className="muted small">
                    de «{c.de}» · mediana de {c.videos} {videos}
                  </div>
                </td>
                <td className="num">{mil(c.mediana)}</td>
                <td className="num">{outliers(c.id) || '—'}</td>
                {conSubs && <td className="num muted">{mil(c.subs)}</td>}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Los temas (`temas.json`): los videos agrupados por lo que dicen, aunque usen otras palabras u otro idioma. Se cuenta lo
 * de la investigación de hoy y van primero los de más outliers. Al abrir uno, sus mejores outliers y los videos que mejor
 * lo representan.
 */
function TablaTemas({ temas, inv, canal }: { temas: Temas; inv: Investigacion; canal: Canal }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const vertical = esVertical(canal)
  const propios = new Set(inv.canales.filter(tuyo).map((c) => c.id))
  const videos = new Map(inv.videos.map((v) => [v.id, v]))
  // Cuántos de sus videos medidos sacan más que lo normal de su cuenta. Se lee contra la de toda la investigación.
  const pasan = (vs: VideoYT[]) => {
    const medidos = vs.filter((v) => v.x !== undefined && v.vistas > 0)
    return medidos.length ? medidos.filter((v) => v.x! > 1).length / medidos.length : undefined
  }
  const pct = (p?: number) => (p === undefined ? '—' : `${Math.round(p * 100)} %`)
  const base = pasan(inv.videos)
  const filas = temas.temas
    .map((t) => {
      const vs = t.ids.map((id) => videos.get(id)).filter((v): v is VideoYT => !!v)
      const outliers = vs.filter((v) => esOutlier(v) && !propios.has(v.canalId)).sort((a, b) => (b.x ?? 0) - (a.x ?? 0))
      return { t, vs, outliers, pasa: pasan(vs) }
    })
    .filter((f) => f.vs.length)
    .sort((a, b) => b.outliers.length - a.outliers.length || b.vs.length - a.vs.length)
  // Cuántos hay de cada red o idioma, de más a menos.
  const cuantos = (vs: VideoYT[], de: (v: VideoYT) => string) => {
    const n = new Map<string, number>()
    for (const v of vs) n.set(de(v), (n.get(de(v)) ?? 0) + 1)
    return [...n].sort((a, b) => b[1] - a[1])
  }
  const suya = vertical ? 'su cuenta' : 'su canal'
  return (
    <div className="tabla-wrap">
      <p className="muted small">
        Los videos agrupados por lo que dicen, {vertical ? 'su descripción' : 'su título'} y lo que se dice en ellos, aunque usen otras palabras u otro idioma.
        «Pasan su mediana» es cuántos de sus videos medidos sacan más que lo normal de {suya}: en toda la investigación, el {pct(base)}. Un tema destaca si pasa
        claro de esa base.
      </p>
      <table className="tabla temas">
        <thead>
          <tr>
            <th>Tema</th>
            <th>Videos</th>
            <th title="Outliers entre sus videos, sin los tuyos">Outliers</th>
            <th title={`De sus videos medidos, cuántos sacan más que la mediana de ${suya}. En toda la investigación, el ${pct(base)}`}>Pasan su mediana</th>
            {vertical && <th>Dónde</th>}
          </tr>
        </thead>
        {filas.map(({ t, vs, outliers, pasa }) => {
          const abre = abierto === t.id
          const mejores = outliers.slice(0, 4)
          const ejemplos = t.ejemplos
            .map((id) => videos.get(id))
            .filter((v): v is VideoYT => !!v && !mejores.includes(v))
            .slice(0, 4)
          return (
            <tbody key={t.id} className={abre ? 'tema abierto' : 'tema'}>
              <tr>
                <td>
                  <button className="titulo-video enlace" aria-expanded={abre} onClick={() => setAbierto(abre ? null : t.id)}>
                    <span className="muted">{abre ? '▾' : '▸'}</span> {t.nombre}
                  </button>
                </td>
                <td className="num">{vs.length}</td>
                <td className="num">{outliers.length || '—'}</td>
                <td className="num">{pct(pasa)}</td>
                {vertical && (
                  <td className="tema-donde">
                    {cuantos(vs, (v) => v.red ?? 'tiktok').map(([red, n]) => (
                      <span key={red} title={`${n} en ${red === 'instagram' ? 'Instagram' : 'TikTok'}`}>
                        <Logo de={red} chico />
                      </span>
                    ))}
                    {cuantos(vs, (v) => (enEspanol(v.idioma) ? 'es' : v.idioma!)).map(([idioma, n]) => (
                      <span key={idioma} className="idea-marca" title={idioma === 'es' ? `${n} en español, o sin saberse` : `${n} en ${idioma === 'en' ? 'inglés' : idioma}`}>
                        {idioma.toUpperCase()}
                      </span>
                    ))}
                  </td>
                )}
              </tr>
              {abre && (
                <tr className="tema-videos">
                  <td colSpan={vertical ? 5 : 4}>
                    <div className="tema-cols">
                      <div>
                        <div className="caja-l">Sus mejores outliers</div>
                        {mejores.length ? (
                          mejores.map((v) => <VideoFila key={v.id} v={v} canalId={canal.id} />)
                        ) : (
                          <span className="muted small">Ninguno de sus videos es outlier.</span>
                        )}
                      </div>
                      {ejemplos.length > 0 && (
                        <div>
                          <div className="caja-l">Los que mejor lo representan</div>
                          {ejemplos.map((v) => (
                            <VideoFila key={v.id} v={v} canalId={canal.id} propio={propios.has(v.canalId)} />
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
