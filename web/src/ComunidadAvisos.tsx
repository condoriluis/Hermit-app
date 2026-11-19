import { useEffect, useRef, useState } from 'react'
import type { AvisoComunidad } from '../../shared/types'
import { api } from './api'
import { Cara, fechaLarga, hace, Icono } from './ComunidadBase'
import './Comunidad.css'

/** La campana: tus avisos, del más nuevo al más viejo. Al abrirla se marcan leídos; tocar uno abre su publicación. */
export function Avisos({ sinLeer, onAbrir, onLeidos }: { sinLeer: number; onAbrir(id: string): void; onLeidos(): void }) {
  const [abierta, setAbierta] = useState(false)
  const [lista, setLista] = useState<AvisoComunidad[] | null>(null)
  const [error, setError] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierta) return
    let vivo = true
    api<{ avisos: AvisoComunidad[]; sinLeer: number }>('/api/comunidad/avisos').then(
      (r) => {
        if (!vivo) return
        setLista(r.avisos)
        if (r.sinLeer) void api('/api/comunidad/avisos/leidos', {}).then(() => (onLeidos(), dispatchEvent(new Event('hermit-comunidad-avisos'))), () => {})
      },
      (e: Error) => vivo && setError(e.message)
    )
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierta(false)
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(false)
    addEventListener('mousedown', fuera)
    addEventListener('keydown', tecla)
    return () => {
      vivo = false
      removeEventListener('mousedown', fuera)
      removeEventListener('keydown', tecla)
    }
  }, [abierta])

  return (
    <div className="com-avisos" ref={caja}>
      <button className={`com-campana${abierta ? ' on' : ''}`} title="Avisos" onClick={() => setAbierta(!abierta)}>
        <Icono de="campana" />
        {sinLeer > 0 && <span className="com-campana-cuenta">{sinLeer > 99 ? '99+' : sinLeer}</span>}
      </button>
      {abierta && (
        <div className="com-avisos-panel" role="dialog" aria-label="Avisos">
          <div className="com-avisos-titulo">Avisos</div>
          {error && <p className="com-avisos-nada">{error}</p>}
          {lista === null && !error && <p className="com-avisos-nada">Cargando…</p>}
          {lista?.length === 0 && <p className="com-avisos-nada">Aún no tienes avisos. Te avisamos aquí cuando alguien comente, responda o le guste lo tuyo.</p>}
          {!!lista?.length && (
            <div className="com-avisos-lista">
              {lista.map((a) => (
                <button key={a.id} className={a.leido ? '' : 'nuevo'} onClick={() => (setAbierta(false), onAbrir(a.publicacion))}>
                  <Cara autor={a.de} />
                  <span className="com-aviso-texto">
                    <span>{fraseDe(a)}</span>
                    <time dateTime={a.creado} title={fechaLarga(a.creado)}>
                      {hace(a.creado)}
                    </time>
                  </span>
                  {!a.leido && <span className="com-aviso-punto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Lo que dice cada aviso. */
function fraseDe(a: AvisoComunidad) {
  const quien = <strong>{a.de.nombre || 'Alguien'}</strong>
  const sobre = <em>«{a.sobre}»</em>
  if (a.tipo === 'comento') return <>{quien} comentó en {sobre}</>
  if (a.tipo === 'respondio') return <>{quien} respondió a tu comentario en {sobre}</>
  if (a.tipo === 'gusta') return <>A {quien} le gustó {sobre}</>
  if (a.tipo === 'gustaComentario') return <>A {quien} le gustó tu comentario en {sobre}</>
  if (a.tipo === 'estado') return a.texto === 'hecha' ? <>{quien} marcó hecha tu mejora {sobre}</> : <>{quien} está haciendo tu mejora {sobre}</>
  if (a.tipo === 'reporte') return <>{quien} reportó {a.comentario ? 'un comentario en ' : ''}{sobre}: {a.texto}</>
  return <>{quien} publicó un anuncio: {sobre}</>
}
