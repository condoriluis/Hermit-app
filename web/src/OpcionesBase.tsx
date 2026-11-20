import { type ReactNode } from 'react'

/** El marco de cada sección de Opciones: su título, lo que lleva dentro y, si hace falta, una nota debajo. */
export function Grupo({ titulo, extra, nota, children }: { titulo: string; extra?: ReactNode; nota?: string; children: ReactNode }) {
  return (
    <section className="grupo">
      <div className="grupo-titulo">
        <h2>{titulo}</h2>
        {extra}
      </div>
      <div className="panel">{children}</div>
      {nota && <p className="grupo-nota">{nota}</p>}
    </section>
  )
}

/** Un interruptor de encendido y apagado, con la bolita que se desliza y su nombre a la izquierda, que también lo cambia. */
export function Interruptor({ on, onCambiar, etiqueta, disabled }: { on: boolean; onCambiar(si: boolean): void; etiqueta: string; disabled?: boolean }) {
  return (
    <label className="con-interruptor">
      {etiqueta}
      <button role="switch" aria-checked={on} className={`interruptor${on ? ' on' : ''}`} disabled={disabled} onClick={() => onCambiar(!on)}>
        <span />
      </button>
    </label>
  )
}
