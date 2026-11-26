import { type ReactNode, useEffect, useState } from 'react'
import { NAVEGADOR_REDES, type Opciones as Datos } from '../../shared/types'
import { api } from './api'
import { abrirBienvenida } from './Bienvenida'
import { abrirNovedades } from './Novedades'
import { Picker } from './Composer'
import { EspacioDisco } from './Espacio' // espacio en disco
import { TuEquipo } from './Equipo' // tu equipo
import { Icono, type NombreIcono } from './Iconos'
import { SuscripcionOpciones } from './Licencia' // apoyo
import { BotonNavegador } from './Navegador'
import { Logo } from './Logos'
import { RadarOpciones } from './RadarOpciones' // radar
import { ConNavegadorRedes, RedesOpciones } from './Redes' // redes
import { YoutubeOpciones } from './Youtube'
import { ArticulosOpciones } from './Articulos' // el blog de los artículos
import { FlowOpciones } from './Flow' // Google Flow
import { useVoz, VozOpciones } from './Voz' // voz
import { VENTA } from '../../shared/venta'
import { Grupo } from './OpcionesBase'
import { Agentes, CuentaAgente, CuentaCodex, CuentaOpenCode, OTROS_AGENTES } from './OpcionesCuentas'
import { useRequisitos, Herramientas } from './OpcionesRequisitos'
import { Avisos } from './OpcionesAvisos'
import './Opciones.css'

export { CuentaClaude, CuentaChatGPT, CuentaOpenCode, CuentaAgente, OTROS_AGENTES, useCuentasConectadas, useSinClaude } from './OpcionesCuentas'
export { Requisitos } from './OpcionesRequisitos'

/**
 * Opciones: una lista de ajustes por grupos. Cada fila es una cosa: su logo, su nombre y debajo lo que es o cómo está
 * puesta (a veces se abre para cambiarla); a la derecha su estado, verde si está bien, menta si te toca hacer algo, y
 * lo que se puede hacer con ella, en un botón o en un desplegable.
 */
export function Opciones({ creador, onDone, seccion: inicial }: { creador: boolean; onDone(): void; seccion?: string }) {
  const [iniciando, setIniciando] = useState(false)
  // A la derecha, como en los hilos, el navegador de las redes mientras inicias sesión en él: se abre solo al conectar
  // TikTok, y el globo del título lo enseña o lo esconde.
  return (
    <ConNavegadorRedes puede={iniciando}>
      <Ajustes creador={creador} seccion={inicial} onDone={onDone} iniciando={iniciando} onIniciando={setIniciando} />
    </ConNavegadorRedes>
  )
}

type Seccion = 'redes' | 'agentes' | 'voz' | 'flow' | 'articulos' | 'llaves' | 'radar' | 'avisos' | 'equipo' | 'herramientas' | 'apoyo' | 'ayuda'

function Ajustes({ creador, onDone, iniciando, onIniciando, seccion: inicial }: { creador: boolean; onDone(): void; iniciando: boolean; onIniciando(si: boolean): void; seccion?: string }) {
  const req = useRequisitos(true)
  // Uno para Voz y Google Flow: la cuenta de la voz también genera en Flow, y quitarla en uno la quita en el otro.
  const voz = useVoz()
  const secciones: { id: Seccion; nombre: string; icono: NombreIcono }[] = [
    { id: 'redes', nombre: 'Redes', icono: 'compartir' },
    { id: 'agentes', nombre: 'Agentes', icono: 'usuario' },
    { id: 'voz', nombre: 'Voz', icono: 'microfono' },
    { id: 'flow', nombre: 'Google Flow', icono: 'play' },
    ...(!VENTA || creador ? [{ id: 'articulos' as const, nombre: 'Artículos', icono: 'documento' as const }] : []),
    ...(!VENTA || creador ? [{ id: 'llaves' as const, nombre: 'Llaves de API', icono: 'codigo' as const }] : []),
    { id: 'radar', nombre: 'Radar', icono: 'radar' },
    { id: 'avisos', nombre: 'Avisos', icono: 'campana' },
    { id: 'equipo', nombre: 'Equipo', icono: 'personas' },
    { id: 'herramientas', nombre: 'Herramientas', icono: 'ajustes' },
    ...(VENTA ? [{ id: 'apoyo' as const, nombre: 'Apoyo', icono: 'estrella' as const }] : []),
    { id: 'ayuda', nombre: 'Ayuda', icono: 'pregunta' }
  ]
  // La sección inicial puede venir del enlace (`#/opciones/flow`); si no existe para este usuario, cae en Redes.
  const [seccion, setSeccion] = useState<Seccion>(secciones.some((s) => s.id === inicial) ? (inicial as Seccion) : 'redes')
  return (
    <div className="opciones">
      {/* La página scrollea a todo lo ancho (la barra en el borde); el contenido va centrado con tope. */}
      <div className="opciones-dentro">
        <button className="ghost" onClick={onDone}>
          ← Volver
        </button>
        <div className="opciones-titulo">
          <h1>Opciones</h1>
          {iniciando && <BotonNavegador hilo={NAVEGADOR_REDES} trabajando={false} />}
        </div>
        <div className="opciones-cuerpo">
          <nav className="opciones-nav" aria-label="Secciones">
            {secciones.map((s) => (
              <button key={s.id} className={`opciones-nav-item${seccion === s.id ? ' on' : ''}`} onClick={() => setSeccion(s.id)}>
                <Icono de={s.icono} />
                <span>{s.nombre}</span>
              </button>
            ))}
          </nav>
          <div className="opciones-pantalla">
            {seccion === 'redes' && (
              <>
                {/* Las redes, lo primero: es por donde salen los videos. Cada quien las conecta con sus propias credenciales. */}
                <section className="grupo redes-grupo">
                  <div className="redes-cabeza">
                    <div>
                      <h2>Redes</h2>
                      <p>Por donde salen tus videos. Hermit los programa en cada red y te avisa si algo falla.</p>
                    </div>
                    <a className="boton" href="#/mis-videos" title="Revisa y programa los que faltan, de todos los estilos">
                      Programar videos
                    </a>
                  </div>
                  <div className="panel">
                    <RedesOpciones onIniciando={onIniciando} />
                    <YoutubeOpciones />
                  </div>
                  <p className="grupo-nota">Los verticales salen en TikTok e Instagram; los largos, en YouTube. Hermit tiene que estar abierto mientras sube a TikTok y a YouTube; Instagram publica aunque la computadora esté apagada.</p>
                </section>
              </>
            )}
            {seccion === 'agentes' && (
              <Grupo titulo="Agentes" nota="Cada agente se descarga la primera vez que lo eliges. Claude necesita plan de pago o llave de API; ChatGPT y OpenCode tienen nivel gratis con límites. Los demás, la cuenta o la llave de cada uno.">
                <Agentes />
                <CuentaCodex />
                <CuentaOpenCode />
                {OTROS_AGENTES.map((p) => (
                  <CuentaAgente key={p} p={p} />
                ))}
              </Grupo>
            )}
            {seccion === 'voz' && (
              <Grupo titulo="Voz" nota="Al pedir un video eliges en «Voz» si la mandas tú o si el agente la genera con una de estas. La sesión de Google vive en un perfil aparte del navegador de Hermit, que ningún agente usa; las llaves, en tu usuario de esta computadora.">
                <VozOpciones voz={voz} />
              </Grupo>
            )}
            {seccion === 'flow' && (
              <Grupo
                titulo="Google Flow"
                nota="Los agentes generan imágenes y videos con tus cuentas de Google: la de la Voz y las que agregues aquí, hasta 50. Las imágenes son gratis; los videos gastan créditos de Flow, y si una cuenta se queda sin ellos, Hermit sigue con otra. Agrega solo cuentas tuyas: Google puede limitar o bloquear las que usa de más."
              >
                <FlowOpciones voz={voz} />
              </Grupo>
            )}
            {seccion === 'articulos' && (!VENTA || creador) && (
              <Grupo titulo="Artículos" nota="La card «Artículo para tu blog» escribe y publica en el blog que conectes aquí: solo pide la dirección y la llave. Las llaves se quedan en tu usuario de esta computadora, no en la app.">
                <ArticulosOpciones />
              </Grupo>
            )}
            {/* Solo sirven a Ideas: sin la de YouTube, las recomendaciones van con el canal conectado. */}
            {seccion === 'llaves' && (!VENTA || creador) && (
              <Grupo titulo="Llaves de API">
                <Llave id="youtube" />
                <Llave id="meta" />
              </Grupo>
            )}
            {seccion === 'radar' && (
              <Grupo titulo="Radar" nota="El Diff investiga aquí primero: el radar lee estas fuentes cada 5 minutos y guarda sus noticias, así cada noticiero sale con lo último.">
                <RadarOpciones />
              </Grupo>
            )}
            {seccion === 'avisos' && (
              <Grupo titulo="Avisos">
                <Avisos />
              </Grupo>
            )}
            {seccion === 'equipo' && (
              <>
                <TuEquipo />
                <EspacioDisco />
              </>
            )}
            {seccion === 'herramientas' && <Herramientas req={req} />}
            {seccion === 'apoyo' && VENTA && (
              <Grupo titulo="Apoyo" nota="Hermit es gratis. El apoyo es opcional y se cobra con PayPal; cancelado, lo ya pagado sigue valiendo hasta su fecha.">
                <SuscripcionOpciones />
              </Grupo>
            )}
            {seccion === 'ayuda' && (
              <Grupo titulo="Ayuda">
                <div className="item">
                  <div className="fila">
                    <span className="logo">
                      <Icono de="pregunta" />
                    </span>
                    <div className="fila-nombre">
                      <strong>La bienvenida</strong>
                      <span>Qué hace Hermit, qué hace falta en tu computadora y cómo va un video, paso a paso.</span>
                    </div>
                    <button className="boton" onClick={abrirBienvenida}>
                      Ver la bienvenida
                    </button>
                  </div>
                </div>
                <div className="item">
                  <div className="fila">
                    <span className="logo">
                      <Icono de="video" />
                    </span>
                    <div className="fila-nombre">
                      <strong>Las novedades</strong>
                      <span>Lo que trajo la última versión, paso a paso y con movimiento.</span>
                    </div>
                    <button className="boton" onClick={abrirNovedades}>
                      Ver novedades
                    </button>
                  </div>
                </div>
              </Grupo>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Las llaves de API que usa Hermit: para qué es cada una y dónde se saca. `logo`, si no es el de su id. */
const LLAVES: Record<'youtube' | 'meta', { nombre: string; para: string; url: string; logo?: string; ayuda: ReactNode }> = {
  youtube: {
    nombre: 'YouTube',
    para: 'Opcional. En Ideas, la fecha y los comentarios de todos los outliers, en segundos',
    url: 'https://console.cloud.google.com/apis/credentials',
    ayuda: (
      <>
        Es gratis: en{' '}
        <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
          Google Cloud
        </a>{' '}
        activa «YouTube Data API v3» y crea una llave en Credenciales. Sin ella, Ideas saca las fechas solo de los 30 mejores outliers, uno por uno.
        Para subir videos, conecta tu canal en Redes → YouTube; esta llave solo consulta.
      </>
    )
  },
  // No es el token de la nube, que publica: este lee, con inicio de sesión con Facebook.
  meta: {
    nombre: 'Instagram (Meta)',
    para: 'Opcional. En Ideas, los Reels de otras cuentas y los tuyos, con sus vistas',
    url: 'https://developers.facebook.com/tools/debug/accesstoken/',
    logo: 'instagram',
    ayuda: (
      <>
        Es un token de la API de Meta, distinto del que publica:
        <br />
        1. Vincula una Página de Facebook a tu cuenta de Instagram, que tiene que ser profesional (en Instagram: Editar perfil → Página).
        <br />
        2. En{' '}
        <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">
          developers.facebook.com
        </a>
        , en tu app de Meta, añade «Inicio de sesión con Facebook».
        <br />
        3. En el{' '}
        <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
          Graph API Explorer
        </a>
        , elige tu app, marca instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement y business_management, y pulsa «Generate Access Token».
        <br />
        4. Alárgalo a 60 días en el{' '}
        <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noreferrer">
          depurador de tokens
        </a>{' '}
        («Extend Access Token») y pégalo aquí.
        <br />
      </>
    )
  }
}

/** Una llave de API. La app no trae ninguna: cada computadora pone la suya, y se prueba antes de guardarla. */
function Llave({ id }: { id: keyof typeof LLAVES }) {
  const l = LLAVES[id]
  const [datos, setDatos] = useState<Datos | null>(null)
  const [llave, setLlave] = useState('')
  const [pegando, setPegando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Datos>('/api/opciones').then(setDatos, (e) => setError(e.message))
  }, [])

  function guardar(valor: string | null) {
    setOcupado(true)
    setError('')
    api<Datos>(`/api/opciones/${id}`, { llave: valor })
      .then((d) => (setDatos(d), setLlave(''), setPegando(false)))
      .catch((e) => setError(e.message))
      .finally(() => setOcupado(false))
  }

  function elegir(que: string) {
    if (que === 'cambiar') setPegando(true)
    if (que === 'ver') window.open(l.url, '_blank', 'noreferrer')
    if (que === 'quitar') guardar(null)
  }

  // Con el servidor sin reiniciar, aún no sabe de la llave de YouTube: se ve como sin poner.
  const g = datos?.[id]
  // El token de Meta caduca: se avisa una semana antes, como el de la nube en las Redes.
  const caduca = id === 'meta' ? datos?.meta?.caduca : undefined
  const vence =
    caduca && caduca - Date.now() < 7 * 864e5
      ? `El token ${caduca < Date.now() ? 'caducó' : 'caduca'} el ${new Date(caduca).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}. Genera otro y pégalo con «Cambiar de llave».`
      : ''
  return (
    <div className="item">
      <div className="fila">
        <Logo de={l.logo ?? id} nombre={l.nombre} />
        <div className="fila-nombre">
          <strong>{l.nombre}</strong>
          <span>{l.para}</span>
        </div>
        {!datos ? (
          <span className="muted small">{error ? '' : 'Mirando…'}</span>
        ) : g ? (
          <Picker
            className="acciones"
            label={<span className="estado mono">…{g.final}</span>}
            value=""
            disabled={ocupado}
            groups={[
              {
                label: 'Llave',
                options: [
                  { value: 'cambiar', label: 'Cambiar de llave' },
                  { value: 'ver', label: 'Ver tus llaves ↗' },
                  { value: 'quitar', label: 'Quitar' },
                ],
              },
            ]}
            onChange={elegir}
          />
        ) : (
          !pegando && (
            <button className="primary" onClick={() => setPegando(true)}>
              Añadir llave
            </button>
          )
        )}
      </div>
      {pegando && (
        <form className="fila-extra" onSubmit={(e) => (e.preventDefault(), llave.trim() && guardar(llave))}>
          <div className="opcion-fila">
            <input type="password" autoFocus placeholder="Pega tu llave" value={llave} onChange={(e) => setLlave(e.target.value)} autoComplete="off" />
            <button className="primary" disabled={ocupado || !llave.trim()}>
              {ocupado ? 'Probando…' : 'Guardar'}
            </button>
            <button type="button" className="ghost" onClick={() => (setPegando(false), setLlave(''))}>
              Cancelar
            </button>
          </div>
          <p className="muted small">{l.ayuda} Se guarda en tu usuario de esta computadora, no en la app.</p>
        </form>
      )}
      {vence && !pegando && <p className="bad small fila-extra">{vence}</p>}
      {error && <p className="bad small fila-extra">{error}</p>}
    </div>
  )
}
