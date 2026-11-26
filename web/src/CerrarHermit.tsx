import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * El diálogo de cierre de Hermit: el proceso principal lo pide al pulsar la X del header o la del sistema
 * (`ventana:preguntar`, en `electron/main.ts`). Responde por `ventana:responder`; si la página no contesta en 4 s,
 * el principal enseña el suyo. En un navegador no hay puente: no se abre nunca.
 */
export function CerrarHermit() {
  const [pregunta, setPregunta] = useState(false)
  const [sinAviso, setSinAviso] = useState(false)

  const responder = (si: boolean) => {
    if (!pregunta) return
    setPregunta(false)
    window.hermit?.ventana?.responderCierre?.(si, si && sinAviso)
  }

  useEffect(() => window.hermit?.ventana?.oirCierre?.(() => {
    setSinAviso(false)
    setPregunta(true)
  }), [])

  useEffect(() => {
    if (!pregunta) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') responder(false)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  if (!pregunta) return null
  return createPortal(
    <div className="modal-backdrop" onClick={() => responder(false)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="¿Cerrar Hermit?" onClick={(e) => e.stopPropagation()}>
        <h2>¿Cerrar Hermit?</h2>
        <div className="modal-body">
          <p>Se cierra por completo, sin quedarse de fondo: se detiene todo lo que esté haciendo, también los videos a medias.</p>
          <label className="modal-check">
            <input type="checkbox" checked={sinAviso} onChange={(e) => setSinAviso(e.target.checked)} />
            No volver a mostrar
          </label>
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={() => responder(false)} autoFocus>
            Cancelar
          </button>
          <button className="primary" onClick={() => responder(true)}>
            Cerrar Hermit
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
