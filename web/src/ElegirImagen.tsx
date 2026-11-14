import { useEffect, useState } from 'react'
import { deTipo, type ImagenHecha, type PiezasDeTodos } from '../../shared/types'
import { api } from './api'
import { Icono } from './Iconos'

/**
 * «De Mis imágenes»: el selector del compositor para adjuntar una imagen que ya está en la galería. Al elegirla, el
 * servidor la copia a `data/attachments` (`POST /api/piezas/adjuntar`) y el compositor la trata como una subida más:
 * viaja como `Imagen adjunta:` y se ve en miniatura. Solo imágenes — el servidor vuelve a comprobar que la ruta es una
 * pieza terminada, así que ninguna otra del disco entra.
 */
export function ElegirImagen({ onCerrar, onAdjuntar }: { onCerrar(): void; onAdjuntar(p: { path: string; nombre: string; bytes: number }): void }) {
  const [imagenes, setImagenes] = useState<ImagenHecha[] | null>(null)
  const [error, setError] = useState('')
  const [yendo, setYendo] = useState('')

  useEffect(() => {
    api<PiezasDeTodos>('/api/piezas')
      .then((d) => setImagenes(deTipo(d.piezas, 'imagen')))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
  }, [])

  async function elegir(i: ImagenHecha) {
    if (yendo) return
    setYendo(i.ruta)
    setError('')
    try {
      const r = await api<{ path: string; size: number }>('/api/piezas/adjuntar', { ruta: i.ruta })
      onAdjuntar({ path: r.path, nombre: i.titulo, bytes: r.size })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setYendo('')
    }
  }

  const src = (i: ImagenHecha) => `/api/piezas/archivo?ruta=${encodeURIComponent(i.ruta)}&t=${Math.round(i.t)}`

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="elegir-img" role="dialog" aria-modal="true" aria-label="De Mis imágenes">
        <header className="elegir-img-head">
          <div>
            <h2>De Mis imágenes</h2>
            <p className="muted small">La que elijas viaja como imagen adjunta.</p>
          </div>
          <button className="elegir-cerrar" title="Cerrar (Esc)" aria-label="Cerrar" onClick={onCerrar}>
            <Icono de="cerrar" />
          </button>
        </header>
        {error && <p className="bad small elegir-img-error">{error}</p>}
        {!imagenes ? (
          !error && (
            <div className="elegir-img-rejilla">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="elegir-img-tile esqueleto" />
              ))}
            </div>
          )
        ) : !imagenes.length ? (
          <p className="elegir-img-vacio">Aún no hay imágenes en «Mis imágenes»: las llena la card «Imágenes con IA».</p>
        ) : (
          <div className="elegir-img-rejilla">
            {imagenes.map((i) => (
              <button key={i.ruta} className={`elegir-img-tile${yendo === i.ruta ? ' yendo' : ''}`} disabled={!!yendo} title={i.titulo} onClick={() => elegir(i)}>
                <span className="elegir-img-marco">
                  <img src={src(i)} alt="" loading="lazy" />
                </span>
                <span className="elegir-img-nombre">{i.titulo}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
