import { useEffect, useState } from 'react'
import { type Requisito } from '../../shared/types'
import { api } from './api'
import { Grupo } from './OpcionesBase'
import { Logo } from './Logos'

/**
 * Lo que las skills necesitan fuera de Hermit (FFmpeg, Python…), y el botón que baja lo que falta. Con `skill`, solo lo
 * que pide esa skill; sin ella (Opciones), todo.
 */
export function useRequisitos(fresco = false, skill?: string) {
  const [lista, setLista] = useState<Requisito[] | null>(null)
  const [error, setError] = useState('')

  // Con todo listo, el servidor no vuelve a mirar; `fresco` (Opciones) se lo pide.
  function leer(fresco = false) {
    const q = new URLSearchParams()
    if (skill) q.set('skill', skill)
    if (fresco) q.set('fresco', '')
    return api<Requisito[]>(`/api/requisitos?${q}`).then(setLista, (e) => setError(e.message))
  }
  useEffect(() => void leer(fresco), [skill])

  // Mientras se instala, se mira cada tres segundos cómo va.
  const trabajando = !!lista?.some((r) => r.estado)
  useEffect(() => {
    if (!trabajando) return
    const id = setInterval(() => leer(), 3000)
    return () => clearInterval(id)
  }, [trabajando])

  function bajar(ids?: string[]) {
    setError('')
    api<Requisito[]>('/api/requisitos/instalar', { ids, skill }).then(setLista, (e) => setError(e.message))
  }

  return { lista, error, trabajando, bajar }
}

type UsoRequisitos = ReturnType<typeof useRequisitos>

/**
 * Lo que ve quien abre la app si falta algo que Hermit puede bajar: encima del compositor, solo lo que falta para la skill
 * de la card, con un botón que lo baja todo. En Opciones está la lista entera, cada uno con su botón.
 */
export function Requisitos({ skill, onListo }: { skill?: string; onListo?(listo?: boolean): void }) {
  const { lista, error, trabajando, bajar } = useRequisitos(false, skill)
  const bajables = lista?.filter((r) => !r.listo && r.instalable && !r.estado) ?? []
  // Si ya está todo (la bienvenida lo marca); `undefined` mientras no se sabe. Lo opcional (ChatGPT) no cuenta.
  const listo = lista ? !lista.some((r) => !r.listo && !r.opcional) : undefined
  useEffect(() => onListo?.(listo), [listo])
  if (!trabajando && !bajables.length && !lista?.some((r) => r.error)) return null
  return (
    <section className="panel requisitos-aviso">
      <div className="item">
        <div className="fila">
          <div className="fila-nombre">
            <strong>Falta descargar algunas cosas</strong>
            <span>Los estilos de video las usan para armar, transcribir y revisar. Puede tardar unos minutos.</span>
          </div>
          {bajables.length > 0 && (
            <button className="primary" onClick={() => bajar()}>
              Descargar todo lo que falta
            </button>
          )}
        </div>
        {error && <p className="bad small fila-extra">{error}</p>}
      </div>
      {lista
        ?.filter((r) => (!r.listo && !r.opcional) || r.estado || r.error)
        .map((r) => (
          <RequisitoFila key={r.id} r={r} />
        ))}
    </section>
  )
}

/**
 * Las herramientas de los estilos de video. Con todo listo se pliegan en una fila con sus logos y sus versiones; se abren
 * con un clic, y solas en cuanto falta algo.
 */
export function Herramientas({ req }: { req: UsoRequisitos }) {
  const [abierta, setAbierta] = useState(true)
  const lista = req.lista ?? []
  const bajables = lista.filter((r) => !r.listo && r.instalable && !r.estado)
  const todoListo = !!req.lista && lista.every((r) => (r.listo || r.opcional) && !r.error)
  const plegada = todoListo && !abierta
  return (
    <Grupo
      titulo="Herramientas de video"
      extra={
        bajables.length > 1 ? (
          <button className="boton" onClick={() => req.bajar()}>
            Descargar todo lo que falta
          </button>
        ) : (
          todoListo &&
          abierta && (
            <button className="resumen on" onClick={() => setAbierta(false)}>
              Cerrar
            </button>
          )
        )
      }
    >
      {!req.lista ? (
        <div className="item fila muted small">{req.error || 'Mirando…'}</div>
      ) : plegada ? (
        <div className="item">
          <button className="fila fila-boton" onClick={() => setAbierta(true)}>
            <span className="logos">
              {lista.map((r) => (
                <Logo key={r.id} de={r.id} nombre={r.nombre} chico />
              ))}
            </span>
            <span className="fila-nombre">
              <strong>Todo listo</strong>
              <span className="una-linea">{lista.map((r) => (r.detalle ? `${r.nombre} ${r.detalle}` : r.nombre)).join(' · ')}</span>
            </span>
            <span className="resumen">Ver</span>
          </button>
        </div>
      ) : (
        lista.map((r) => <RequisitoFila key={r.id} r={r} onBajar={() => req.bajar([r.id])} />)
      )}
      {req.lista && req.error && <p className="bad small fila-extra">{req.error}</p>}
    </Grupo>
  )
}

/** Una herramienta: para qué sirve, su versión si está, y si no, cómo conseguirla. Sin `onBajar` no lleva botón. */
function RequisitoFila({ r, onBajar }: { r: Requisito; onBajar?(): void }) {
  return (
    <div className="item">
      <div className="fila">
        <Logo de={r.id} nombre={r.nombre} />
        <div className="fila-nombre" title={r.para}>
          <strong>{r.nombre}</strong>
          <span className={r.listo ? 'una-linea' : undefined}>{r.para}</span>
          {!r.listo && r.aMano && <span>{r.aMano}</span>}
        </div>
        <EstadoRequisito r={r} />
        {onBajar && r.instalable && !r.listo && !r.estado && (
          <button className="primary" onClick={onBajar}>
            Descargar
          </button>
        )}
      </div>
      {r.error && <p className="bad small fila-extra requisito-error">{r.error}</p>}
    </div>
  )
}

function EstadoRequisito({ r }: { r: Requisito }) {
  if (r.listo) return <span className="estado">{r.detalle ?? 'Listo'}</span>
  if (r.opcional) return <span className="estado apagado">Opcional</span>
  if (r.estado) return <span className="estado moviendo" title={r.detalle}>{r.estado === 'instalando' ? (r.detalle ? `${r.detalle}…` : 'Descargando…') : 'En espera'}</span>
  return <span className="estado falta">{r.detalle ?? 'Falta'}</span>
}
