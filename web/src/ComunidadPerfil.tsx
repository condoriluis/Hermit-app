import { useEffect, useRef, useState } from 'react'
import type { Autor } from '../../shared/types'
import { api } from './api'
import { Cara, Icono, type Yo } from './ComunidadBase'
import './Comunidad.css'

export function Perfil({ yo, onListo, onCerrar }: { yo: Yo; onListo(a: Autor): void; onCerrar(): void }) {
  const [nombre, setNombre] = useState(yo.nombre)
  const [creditos, setCreditos] = useState(!!yo.creditos)
  // `undefined`: la foto que ya tenías; `null`: sin foto; o la nueva.
  const [foto, setFoto] = useState<{ llave: string; url: string } | null | undefined>(undefined)
  const [subiendo, setSubiendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const elegir = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
  })

  async function subir(f?: File) {
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Tu foto debe ser una imagen.')
    setSubiendo(true)
    setError('')
    try {
      const r = await fetch(`/api/comunidad/archivo?tipo=${encodeURIComponent(f.type)}`, { method: 'POST', body: f })
      const j = (await r.json().catch(() => ({}))) as { llave?: string; url?: string; error?: string }
      if (!r.ok || !j.llave || !j.url) throw new Error(j.error ?? 'No se pudo subir tu foto.')
      setFoto({ llave: j.llave, url: j.url })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubiendo(false)
    }
  }

  async function guardar() {
    if (!nombre.trim() || subiendo || ocupado) return
    setOcupado(true)
    setError('')
    try {
      onListo(
        await api<Autor>('/api/comunidad/perfil', {
          nombre: nombre.trim(),
          ...(foto !== undefined ? { foto: foto?.llave ?? null } : {}),
          ...(yo.insignia === 'fundador' ? { creditos } : {})
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setOcupado(false)
    }
  }

  const vista: Autor = { ...yo, nombre: nombre || yo.nombre, foto: foto === undefined ? yo.foto : foto?.url }
  return (
    <div className="com-velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="com-caja" role="dialog" aria-modal="true" aria-labelledby="com-perfil-titulo">
        <h2 id="com-perfil-titulo">{yo.nombre ? 'Tu perfil' : '¿Cómo te llamas?'}</h2>
        <p>Así te ven en la comunidad: tu nombre y, si quieres, tu foto.</p>
        <div className="com-perfil-foto">
          <button className={subiendo ? 'subiendo' : ''} title="Elegir una foto" onClick={() => elegir.current?.click()}>
            <Cara autor={vista} tam="grande" />
          </button>
          <div>
            <button className="com-boton" disabled={subiendo} onClick={() => elegir.current?.click()}>
              <Icono de="imagen" /> {subiendo ? 'Subiendo…' : vista.foto ? 'Cambiar la foto' : 'Poner una foto'}
            </button>
            {vista.foto && (
              <button className="com-boton" onClick={() => setFoto(null)}>
                Quitarla
              </button>
            )}
          </div>
          <input ref={elegir} type="file" accept="image/*" hidden onChange={(e) => (void subir(e.target.files?.[0]), (e.target.value = ''))} />
        </div>
        <input
          className="com-perfil-nombre"
          value={nombre}
          maxLength={40}
          placeholder="Tu nombre"
          autoFocus
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void guardar()}
        />
        {yo.insignia === 'fundador' && (
          <label className="com-creditos">
            <input type="checkbox" checked={creditos} onChange={(e) => setCreditos(e.target.checked)} />
            <span>Salir con este nombre en los créditos de los Fundadores, en myhermit.vercel.app</span>
          </label>
        )}
        {error && <p className="bad small">{error}</p>}
        <div className="com-caja-pie">
          <button className="esc-cancelar" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="esc-listo" disabled={!nombre.trim() || subiendo || ocupado} onClick={() => void guardar()}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
