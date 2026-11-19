import { type CSSProperties, useState } from 'react'
import type { RoadmapComunidad } from '../../shared/types'
import { api } from './api'
import './Comunidad.css'

/** Qué sigue en el roadmap de myhermit.vercel.app: un voto por persona, que se puede cambiar; el de un Fundador vale dos. */
export function Votar({ roadmap, fundador, onVoto }: { roadmap: RoadmapComunidad; fundador: boolean; onVoto(r: RoadmapComunidad): void }) {
  const [enviando, setEnviando] = useState('')
  const [error, setError] = useState('')
  const mas = Math.max(1, ...roadmap.metas.map((m) => m.votos))

  async function votar(meta: string) {
    if (enviando || meta === roadmap.mio) return
    setEnviando(meta)
    setError('')
    try {
      onVoto(await api<RoadmapComunidad>('/api/comunidad/roadmap', { meta }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando('')
    }
  }

  return (
    <div className="com-votar">
      <h3>Vota qué sigue</h3>
      <p>{fundador ? 'Eres Fundador: tu voto vale dos.' : 'Un voto por persona; el de un Fundador vale dos.'} Puedes cambiarlo cuando quieras.</p>
      <ul>
        {roadmap.metas.map((m) => (
          <li key={m.id}>
            <button className={m.id === roadmap.mio ? 'on' : ''} disabled={!!enviando} aria-pressed={m.id === roadmap.mio} onClick={() => void votar(m.id)}>
              <span className="com-votar-fila">
                <span>{m.titulo}</span>
                <b>{m.votos}</b>
              </span>
              <span className="com-votar-barra" style={{ '--parte': `${(m.votos / mas) * 100}%` } as CSSProperties} />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="bad small">{error}</p>}
    </div>
  )
}
