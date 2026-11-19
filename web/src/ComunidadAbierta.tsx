import { useEffect, useState } from 'react'
import type { AdjuntoComunidad, CategoriaComunidad, ComentarioComunidad, PublicacionComunidad } from '../../shared/types'
import { api } from './api'
import { Confirm } from './Confirm'
import { Escribir } from './Escribir'
import { Comentario, Comentar } from './ComunidadComentarios'
import { Reportar } from './ComunidadReportar'
import { Cara, fechaLarga, hace, Icono, Nombre, seccionDe, Texto, type Yo } from './ComunidadBase'
import { ElegirSeccion, EstadoMejora } from './ComunidadTarjetas'
import './Comunidad.css'

/**
 * Una publicación abierta, sobre un velo: entera, con su video y sus imágenes, sus comentarios y donde se comenta. Quien
 * la escribió la edita o la borra; el creador, además, la fija y dice cómo va una mejora.
 */
export function Abierta(props: {
  id: string
  previa?: PublicacionComunidad
  yo: Yo
  onCambio(p: PublicacionComunidad): void
  onMegusta(p: PublicacionComunidad): Promise<PublicacionComunidad>
  onComento(): void
  onBorrada(): void
  conNombre(accion: () => void): void
  onCerrar(): void
}) {
  const { yo } = props
  const [p, setP] = useState(props.previa)
  const [comentarios, setComentarios] = useState<ComentarioComunidad[] | null>(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  const [seccion, setSeccion] = useState<CategoriaComunidad>(props.previa?.categoria ?? 'general')
  const [borrando, setBorrando] = useState(false)
  const [ampliada, setAmpliada] = useState<string | null>(null)
  // El comentario de primer nivel al que respondes, y lo que reportas.
  const [respondiendo, setRespondiendo] = useState<string | null>(null)
  const [reportando, setReportando] = useState<{ que: 'publicación' | 'comentario'; id: string } | null>(null)
  const [reportada, setReportada] = useState(false)

  useEffect(() => {
    api<{ publicacion: PublicacionComunidad; comentarios: ComentarioComunidad[] }>(`/api/comunidad/p/${props.id}`).then(
      (r) => {
        setP(r.publicacion)
        setSeccion(r.publicacion.categoria)
        setComentarios(r.comentarios)
        props.onCambio(r.publicacion)
      },
      (e: Error) => setError(e.message)
    )
  }, [props.id])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || borrando || reportando) return
      if (ampliada) setAmpliada(null)
      else if (!editando) props.onCerrar()
    }
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
  })

  const cambiar = (nueva: PublicacionComunidad) => (setP(nueva), props.onCambio(nueva))
  /** Lo que solo hace el creador (fijar, cómo va una mejora). */
  async function delCreador(c: { fijada?: boolean; estado?: 'haciendo' | 'hecha' | null }) {
    if (!p) return
    setError('')
    try {
      cambiar(await api<PublicacionComunidad>(`/api/comunidad/p/${p.id}`, c))
      if (c.fijada !== undefined) dispatchEvent(new Event('hermit-comunidad'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  /** Un comentario, o la respuesta a uno de primer nivel, con sus imágenes. */
  async function comentar(texto: string, adjuntos: AdjuntoComunidad[], responde?: string) {
    if (!p) return
    const c = await api<ComentarioComunidad>(`/api/comunidad/p/${p.id}/comentar`, { texto, adjuntos, ...(responde ? { responde } : {}) })
    setComentarios((l) => [...(l ?? []), c])
    props.onComento()
    const comentaron = [c.autor, ...p.comentaron.filter((a) => a.id !== c.autor.id)].slice(0, 5)
    cambiar({ ...p, comentarios: p.comentarios + 1, ultimoComentario: c.creada, actividad: c.creada, comentaron })
  }

  const suya = !!p && p.autor.id === yo.id
  const video = p?.adjuntos.find((a) => a.tipo === 'video')
  const imagenes = p?.adjuntos.filter((a) => a.tipo === 'imagen') ?? []

  return (
    <div className="com-velo" onMouseDown={(e) => e.target === e.currentTarget && !editando && props.onCerrar()}>
      <div className="com-abierta" role="dialog" aria-modal="true" aria-label={p?.titulo || 'Publicación'}>
        <button className="com-icono com-cerrar" title="Cerrar (Esc)" onClick={props.onCerrar}>
          <Icono de="cerrar" />
        </button>
        {!p && !error && <div className="com-cargando">Cargando…</div>}
        {!p && error && <div className="com-error">{error}</div>}
        {p && (
          <>
            <header className="com-post-cabeza">
              <Cara autor={p.autor} tam="grande" />
              <div className="com-post-quien">
                <Nombre autor={p.autor} />
                <span className="com-meta">
                  <time dateTime={p.creada} title={fechaLarga(p.creada)}>
                    {hace(p.creada)}
                  </time>
                  <span>·</span>
                  <span>{seccionDe(p.categoria).nombre}</span>
                  {p.editada && <span title={fechaLarga(p.editada)}>· editada</span>}
                </span>
              </div>
              <EstadoMejora p={p} />
              {!!p.reportes && <span className="com-reportada">Reportada · {p.reportes}</span>}
              {!editando && (
                <div className="com-acciones">
                  {!suya && !yo.creador && (
                    <button
                      className="com-icono"
                      disabled={reportada}
                      title={reportada ? 'Ya la reportaste' : 'Reportar la publicación'}
                      onClick={() => setReportando({ que: 'publicación', id: p.id })}
                    >
                      <Icono de="bandera" />
                    </button>
                  )}
                  {yo.creador && (
                    <button className={`com-icono${p.fijada ? ' on' : ''}`} title={p.fijada ? 'Desfijar' : 'Fijar arriba, para todos'} onClick={() => void delCreador({ fijada: !p.fijada })}>
                      <Icono de="pin" />
                    </button>
                  )}
                  {(suya || yo.creador) && (
                    <>
                      <button className="com-icono" title="Editar" onClick={() => setEditando(true)}>
                        <Icono de="lapiz" />
                      </button>
                      <button className="com-icono peligro" title="Borrar" onClick={() => setBorrando(true)}>
                        <Icono de="basura" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </header>

            {editando ? (
              <Escribir
                editando
                compacto
                conTitulo
                conVideo
                inicial={p}
                placeholder={seccionDe(seccion).escribe}
                accion="Guardar"
                autoFocus
                extra={<ElegirSeccion valor={seccion} creador={!!yo.creador} onCambio={setSeccion} />}
                onListo={async (e) => {
                  cambiar(await api<PublicacionComunidad>(`/api/comunidad/p/${p.id}`, { ...e, categoria: seccion }))
                  setEditando(false)
                }}
                onCancelar={() => (setEditando(false), setSeccion(p.categoria))}
              />
            ) : (
              <>
                {p.titulo && <h2 className="com-abierta-titulo">{p.titulo}</h2>}
                {p.texto && <Texto texto={p.texto} className="com-abierta-texto" />}
                {video && (
                  <video className={`com-video${video.vertical ? ' vertical' : ''}`} src={video.url} poster={video.posterUrl} controls loop playsInline preload="metadata" />
                )}
                {imagenes.length > 0 && (
                  <div className={`com-fotos n${Math.min(imagenes.length, 3)}`}>
                    {imagenes.map((a) => (
                      <button key={a.llave} title="Ampliar" onClick={() => setAmpliada(a.url)}>
                        <img src={a.url} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Del creador, en Mejoras: cómo va. */}
            {yo.creador && (p.categoria === 'mejoras' || !!p.reportes) && !editando && (
              <div className="com-creador-barra">
                {!!p.reportes && (
                  <button
                    className="com-boton ok"
                    title="La revisaste y se queda: se le quitan los reportes y todos la vuelven a ver"
                    onClick={() => void api(`/api/comunidad/p/${p.id}/revisada`, {}).then(() => cambiar({ ...p, reportes: undefined }), (e: Error) => setError(e.message))}
                  >
                    <Icono de="palomita" /> Está bien, se queda
                  </button>
                )}
                {p.categoria === 'mejoras' && !p.estado && (
                  <button className="com-boton" title="Todos ven que ya se está haciendo" onClick={() => void delCreador({ estado: 'haciendo' })}>
                    Se está haciendo
                  </button>
                )}
                {p.categoria === 'mejoras' &&
                  (p.estado !== 'hecha' ? (
                    <button className="com-boton ok" onClick={() => void delCreador({ estado: 'hecha' })}>
                      <Icono de="palomita" /> Marcar hecha
                    </button>
                  ) : (
                    <button className="com-boton" title="Vuelve a ser una idea" onClick={() => void delCreador({ estado: null })}>
                      <Icono de="reabrir" /> Reabrir
                    </button>
                  ))}
              </div>
            )}

            {error && p && <div className="com-error">{error}</div>}

            <div className="com-abierta-pie">
              <button className={`com-gusta grande${p.megusta ? ' on' : ''}`} onClick={() => props.conNombre(() => void props.onMegusta(p).then(setP))}>
                <Icono de="pulgar" /> {p.likes ? `${p.likes} me gusta` : 'Me gusta'}
              </button>
              <span className="com-cuenta">
                <Icono de="hilo" /> {p.comentarios} {p.comentarios === 1 ? 'comentario' : 'comentarios'}
              </span>
            </div>

            <div className="com-comentarios">
              {comentarios === null && !error && <div className="com-cargando chico">Cargando comentarios…</div>}
              {comentarios
                ?.filter((c) => !c.responde)
                .map((c) => {
                  const respuestas = comentarios.filter((r) => r.responde === c.id)
                  const fila = (x: ComentarioComunidad) => (
                    <Comentario
                      key={x.id}
                      c={x}
                      yo={yo}
                      conNombre={props.conNombre}
                      onResponder={() => setRespondiendo(c.id)}
                      onAmpliar={setAmpliada}
                      onCambio={(nuevo) => setComentarios((l) => l?.map((y) => (y.id === nuevo.id ? nuevo : y)) ?? l)}
                      onBorrar={async () => {
                        await api(`/api/comunidad/c/${x.id}/borrar`, {})
                        // Uno de primer nivel se lleva sus respuestas.
                        const idos = new Set([x.id, ...(x.responde ? [] : respuestas.map((r) => r.id))])
                        setComentarios((l) => l?.filter((y) => !idos.has(y.id)) ?? l)
                        cambiar({ ...p, comentarios: Math.max(0, p.comentarios - idos.size) })
                      }}
                      onReportar={() => setReportando({ que: 'comentario', id: x.id })}
                    />
                  )
                  return (
                    <div key={c.id} className="com-conversacion">
                      {fila(c)}
                      {(respuestas.length > 0 || respondiendo === c.id) && (
                        <div className="com-respuestas">
                          {respuestas.map(fila)}
                          {respondiendo === c.id && (
                            <Comentar
                              yo={yo}
                              placeholder={`Responde a ${c.autor.nombre || 'este comentario'}`}
                              autoFocus
                              conNombre={props.conNombre}
                              onListo={(texto, adjuntos) => comentar(texto, adjuntos, c.id)}
                              onCancelar={() => setRespondiendo(null)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              <Comentar yo={yo} placeholder="Escribe un comentario" conNombre={props.conNombre} onListo={(texto, adjuntos) => comentar(texto, adjuntos)} />
            </div>
          </>
        )}
      </div>

      {ampliada && (
        <div className="lightbox" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="" />
        </div>
      )}
      {reportando && p && (
        <Reportar
          que={reportando.que}
          onListo={async (motivo) => {
            await api(`/api/comunidad/${reportando.que === 'publicación' ? 'p' : 'c'}/${reportando.id}/reportar`, { motivo })
            if (reportando.que === 'publicación') setReportada(true)
          }}
          onCerrar={() => setReportando(null)}
        />
      )}
      {borrando && p && (
        <Confirm
          title="¿Borrar esta publicación?"
          action="Borrar"
          danger
          onConfirm={async () => {
            await api(`/api/comunidad/p/${p.id}/borrar`, {})
            props.onBorrada()
          }}
          onClose={() => setBorrando(false)}
        >
          <p className="com-confirmar">«{(p.titulo || p.texto || 'Una imagen').slice(0, 140)}»</p>
          <p className="muted small">Se borran también sus comentarios, sus imágenes y su video. {suya ? '' : 'No es tuya: la escribió ' + (p.autor.nombre || 'alguien') + '.'}</p>
        </Confirm>
      )}
    </div>
  )
}
