import { useEffect, useState } from 'react'
import './Comunidad.css'

const MOTIVOS = ['Es spam o publicidad', 'Es ofensivo o agresivo', 'No tiene que ver con Hermit', 'Otro']

/** Reportar una publicación o un comentario: por qué, y le llega al creador. Con 3 reportes deja de verse hasta que lo revise. */
export function Reportar({ que, onListo, onCerrar }: { que: 'publicación' | 'comentario'; onListo(motivo: string): Promise<void>; onCerrar(): void }) {
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopImmediatePropagation(), onCerrar())
    addEventListener('keydown', tecla, true)
    return () => removeEventListener('keydown', tecla, true)
  })
  const falta = !motivo || (motivo === 'Otro' && !detalle.trim())

  async function mandar() {
    if (falta || ocupado) return
    setOcupado(true)
    setError('')
    try {
      await onListo(motivo === 'Otro' ? detalle.trim() : `${motivo}${detalle.trim() ? `: ${detalle.trim()}` : ''}`)
      setListo(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="com-velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="com-caja" role="dialog" aria-modal="true" aria-labelledby="com-reportar-titulo">
        {listo ? (
          <>
            <h2 id="com-reportar-titulo">Gracias</h2>
            <p>El creador de Hermit lo va a revisar. Si más personas lo reportan, deja de verse mientras tanto.</p>
            <div className="com-caja-pie">
              <button className="esc-listo" autoFocus onClick={onCerrar}>
                Listo
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="com-reportar-titulo">Reportar {que === 'publicación' ? 'esta publicación' : 'este comentario'}</h2>
            <p>¿Qué tiene? Solo lo ve el creador de Hermit.</p>
            <div className="com-motivos" role="radiogroup">
              {MOTIVOS.map((m) => (
                <button key={m} role="radio" aria-checked={motivo === m} className={motivo === m ? 'on' : ''} onClick={() => setMotivo(m)}>
                  <span className="com-motivo-marca" />
                  {m}
                </button>
              ))}
            </div>
            <textarea
              className="com-perfil-nombre com-detalle"
              rows={2}
              maxLength={250}
              value={detalle}
              placeholder={motivo === 'Otro' ? 'Cuéntanos qué pasa' : 'Algo más (si quieres)'}
              onChange={(e) => setDetalle(e.target.value)}
            />
            {error && <p className="bad small">{error}</p>}
            <div className="com-caja-pie">
              <button className="esc-cancelar" onClick={onCerrar}>
                Cancelar
              </button>
              <button className="esc-listo" disabled={falta || ocupado} onClick={() => void mandar()}>
                Reportar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
