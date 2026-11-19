import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AdjuntoComunidad, ComentarioComunidad } from '../../shared/types'
import { api } from './api'
import { Confirm } from './Confirm'
import { subirImagen } from './Escribir'
import { Cara, fechaLarga, hace, Icono, Nombre, Texto, type Yo } from './ComunidadBase'
import './Comunidad.css'

/**
 * Un comentario o una respuesta: quién y cuándo, el texto y sus imágenes en su globo y abajo me gusta y «Responder». Quien
 * lo escribió (o el creador) lo borra; los demás lo reportan. El creador ve cuántos lo reportaron y, si se queda, «Está
 * bien».
 */
export function Comentario(props: {
  c: ComentarioComunidad
  yo: Yo
  conNombre(accion: () => void): void
  onResponder(): void
  onAmpliar(url: string): void
  onCambio(c: ComentarioComunidad): void
  onBorrar(): Promise<void>
  onReportar(): void
}) {
  const { c, yo } = props
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState('')
  const suyo = c.autor.id === yo.id

  async function megusta() {
    const antes = c
    props.onCambio({ ...c, megusta: !c.megusta, likes: c.likes + (c.megusta ? -1 : 1) })
    try {
      props.onCambio({ ...c, ...(await api<{ likes: number; megusta: boolean }>(`/api/comunidad/c/${c.id}/megusta`, {})) })
    } catch (e) {
      props.onCambio(antes)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={`com-comentario${c.responde ? ' respuesta' : ''}`}>
      <Cara autor={c.autor} />
      <div className="com-comentario-columna">
        <div className="com-comentario-cuerpo">
          <div className="com-comentario-cabeza">
            <Nombre autor={c.autor} />
            <time dateTime={c.creada} title={fechaLarga(c.creada)}>
              {hace(c.creada)}
            </time>
            {!!c.reportes && <span className="com-reportada">Reportado · {c.reportes}</span>}
            <span className="com-comentario-iconos">
              {!suyo && !yo.creador && (
                <button className="com-icono" title="Reportar el comentario" onClick={props.onReportar}>
                  <Icono de="bandera" />
                </button>
              )}
              {(suyo || yo.creador) && (
                <button className="com-icono peligro" title="Borrar el comentario" onClick={() => setBorrando(true)}>
                  <Icono de="basura" />
                </button>
              )}
            </span>
          </div>
          {c.texto && <Texto texto={c.texto} className="com-comentario-texto" />}
          {!!c.adjuntos?.length && (
            <div className={`com-comentario-fotos n${c.adjuntos.length}`}>
              {c.adjuntos.map((a) => (
                <button key={a.llave} title="Ampliar" onClick={() => props.onAmpliar(a.url)}>
                  <img src={a.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="com-comentario-pie">
          <button className={`com-gusta chico${c.megusta ? ' on' : ''}`} title={c.megusta ? 'Ya no me gusta' : 'Me gusta'} onClick={() => props.conNombre(() => void megusta())}>
            <Icono de="pulgar" /> {c.likes || ''}
          </button>
          <button className="com-responder" onClick={() => props.conNombre(props.onResponder)}>
            <Icono de="responder" /> Responder
          </button>
          {!!c.reportes && (
            <button
              className="com-responder"
              title="Lo revisaste y se queda: se le quitan los reportes"
              onClick={() => void api(`/api/comunidad/c/${c.id}/revisada`, {}).then(() => props.onCambio({ ...c, reportes: undefined }), (e: Error) => setError(e.message))}
            >
              <Icono de="palomita" /> Está bien
            </button>
          )}
          {error && <span className="com-comentar-error">{error}</span>}
        </div>
      </div>
      {borrando && (
        <Confirm title="¿Borrar este comentario?" action="Borrar" danger onConfirm={props.onBorrar} onClose={() => setBorrando(false)}>
          <p className="com-confirmar">{c.texto ? `«${c.texto.slice(0, 140)}${c.texto.length > 140 ? '…' : ''}»` : c.adjuntos?.length === 1 ? 'Una imagen' : 'Unas imágenes'}</p>
          {!c.responde && <p className="muted small">Se borran también sus respuestas.</p>}
        </Confirm>
      )}
    </div>
  )
}

/** Las imágenes que lleva un comentario, como en el Worker (`FOTOS_COMENTARIO`). */
const FOTOS_COMENTARIO = 4

/**
 * Donde se comenta o se responde: crece con el texto; Enter lo manda y Escape cancela una respuesta. Las imágenes se
 * pegan, se sueltan encima o se eligen con su botón, como en el chat, y suben en cuanto llegan.
 */
export function Comentar(props: {
  yo: Yo
  placeholder: string
  autoFocus?: boolean
  conNombre(accion: () => void): void
  onListo(texto: string, adjuntos: AdjuntoComunidad[]): Promise<void>
  onCancelar?(): void
}) {
  const [texto, setTexto] = useState('')
  const [fotos, setFotos] = useState<AdjuntoComunidad[]>([])
  const [subiendo, setSubiendo] = useState(0)
  const [encima, setEncima] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const elegir = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [texto])
  useEffect(() => {
    if (props.autoFocus) ref.current?.focus()
  }, [])

  async function subir(archivos: File[]) {
    const imagenes = archivos.filter((f) => f.type.startsWith('image/'))
    if (!imagenes.length) return setError(archivos.length ? 'En un comentario solo van imágenes.' : '')
    const caben = FOTOS_COMENTARIO - fotos.length - subiendo
    setError(imagenes.length > caben ? `Un comentario lleva hasta ${FOTOS_COMENTARIO} imágenes.` : '')
    const van = imagenes.slice(0, Math.max(0, caben))
    setSubiendo((n) => n + van.length)
    await Promise.all(
      van.map((f) =>
        subirImagen(f)
          .then((a) => setFotos((l) => [...l, a]))
          .catch((e: Error) => setError(e.message))
          .finally(() => setSubiendo((n) => n - 1))
      )
    )
  }

  const vacio = !texto.trim() && !fotos.length
  const mandar = () =>
    props.conNombre(async () => {
      if (vacio || subiendo || ocupado) return
      setOcupado(true)
      setError('')
      try {
        await props.onListo(texto.trim(), fotos)
        setTexto('')
        setFotos([])
        props.onCancelar?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setOcupado(false)
      }
    })

  return (
    <div className="com-comentar">
      <Cara autor={props.yo} />
      <div
        className={`com-comentar-caja${encima ? ' soltando' : ''}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          e.stopPropagation()
          setEncima(true)
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setEncima(false)}
        onDrop={(e) => {
          setEncima(false)
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          e.stopPropagation()
          void subir([...e.dataTransfer.files])
        }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={texto}
          placeholder={props.placeholder}
          maxLength={5000}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) (e.preventDefault(), mandar())
            if (e.key === 'Escape' && props.onCancelar) (e.stopPropagation(), props.onCancelar())
          }}
          onPaste={(e) => {
            const archivos = [...e.clipboardData.files]
            if (!archivos.some((f) => f.type.startsWith('image/'))) return
            e.preventDefault()
            void subir(archivos)
          }}
        />
        <button
          className="com-adjuntar"
          title={`Agregar imágenes (también puedes pegarlas o soltarlas), hasta ${FOTOS_COMENTARIO}`}
          disabled={fotos.length + subiendo >= FOTOS_COMENTARIO}
          onClick={() => elegir.current?.click()}
        >
          <Icono de="imagen" />
        </button>
        <input
          ref={elegir}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void subir([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <button className="com-enviar" disabled={vacio || subiendo > 0 || ocupado} title={subiendo ? 'Espera a que termine de subir' : 'Comentar (Enter)'} onClick={mandar}>
          <Icono de="flechaArriba" />
        </button>
      </div>
      {(fotos.length > 0 || subiendo > 0) && (
        <div className="esc-fotos com-comentar-fotos">
          {fotos.map((a) => (
            <div key={a.llave} className="esc-miniatura">
              <img src={a.url} alt="" />
              <button title="Quitar" onClick={() => setFotos((l) => l.filter((x) => x !== a))}>
                ×
              </button>
            </div>
          ))}
          {Array.from({ length: subiendo }, (_, i) => (
            <div key={`subiendo-${i}`} className="esc-miniatura subiendo" title="Subiendo…" />
          ))}
        </div>
      )}
      {error && <div className="com-comentar-error">{error}</div>}
    </div>
  )
}
