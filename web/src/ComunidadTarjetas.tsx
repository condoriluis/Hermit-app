import { useState } from 'react'
import type { CategoriaComunidad, PublicacionComunidad } from '../../shared/types'
import { Cara, fechaLarga, hace, Icono, Nombre, SECCIONES, seccionDe, type Yo } from './ComunidadBase'
import './Comunidad.css'

/** La sección donde va una publicación: Anuncios, solo para el creador. */
export function ElegirSeccion({ valor, creador, onCambio }: { valor: CategoriaComunidad; creador: boolean; onCambio(s: CategoriaComunidad): void }) {
  return (
    <label className="com-elegir" title="La sección donde se publica">
      <Icono de={seccionDe(valor).icono} />
      <select value={valor} onChange={(e) => onCambio(e.target.value as CategoriaComunidad)}>
        {SECCIONES.filter((s) => creador || s.id !== 'anuncios').map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Cómo va una mejora: lo que dijo el creador. */
export function EstadoMejora({ p }: { p: PublicacionComunidad }) {
  if (p.categoria !== 'mejoras') return null
  if (p.estado === 'hecha')
    return (
      <span className="com-estado hecha">
        <Icono de="palomita" /> Hecha
      </span>
    )
  if (p.estado === 'haciendo') return <span className="com-estado haciendo">Se está haciendo</span>
  return <span className="com-estado">Idea</span>
}

/** «Comienza aquí»: lo primero que se hace en la comunidad, hasta hacerlo todo. */
export function Bienvenida({ yo, onNombre, onPresentarse, onComentar }: { yo: Yo; onNombre(): void; onPresentarse(): void; onComentar(): void }) {
  const [oculta, setOculta] = useState(() => localStorage.getItem('comunidad:bienvenida') === 'no')
  const pasos = [
    { hecho: !!yo.nombre, texto: 'Ponte tu nombre y tu foto', accion: onNombre },
    { hecho: yo.publicaciones > 0, texto: 'Preséntate: quién eres y qué quieres hacer con Hermit', accion: onPresentarse },
    { hecho: yo.comentarios > 0, texto: 'Comenta un video que hizo alguien', accion: onComentar },
  ]
  const hechos = pasos.filter((p) => p.hecho).length
  if (oculta || hechos === pasos.length) return null
  const r = 9
  const vuelta = 2 * Math.PI * r
  return (
    <section className="com-bienvenida">
      <header>
        <svg viewBox="0 0 24 24" className="com-avance" aria-label={`${hechos} de ${pasos.length}`}>
          <circle cx="12" cy="12" r={r} />
          <circle cx="12" cy="12" r={r} className="hecho" strokeDasharray={`${(vuelta * hechos) / pasos.length} ${vuelta}`} />
        </svg>
        <strong>¡Bienvenido! Comienza aquí</strong>
        <button className="com-icono" title="Ocultar" onClick={() => (localStorage.setItem('comunidad:bienvenida', 'no'), setOculta(true))}>
          <Icono de="cerrar" />
        </button>
      </header>
      {pasos.map((p) => (
        <button key={p.texto} className={`com-paso${p.hecho ? ' hecho' : ''}`} disabled={p.hecho} onClick={p.accion}>
          <span className="com-paso-marca">{p.hecho && <Icono de="palomita" />}</span>
          {p.texto}
        </button>
      ))}
    </section>
  )
}

/** Una publicación en el feed: quién, cuándo y dónde; su título y el principio del texto; su portada; y lo que generó. */
export function Tarjeta({ p, yo, nueva, visto, onAbrir, onMegusta }: { p: PublicacionComunidad; yo?: Yo; nueva: boolean; visto?: string; onAbrir(): void; onMegusta(): void }) {
  const portada = p.adjuntos.find((a) => a.tipo === 'video') ?? p.adjuntos[0]
  const imagen = portada && (portada.tipo === 'imagen' ? portada.url : portada.posterUrl)
  // Nuevo: llegó después de la última vez que la abriste, y no lo escribiste tú.
  const nuevoComentario = !!p.ultimoComentario && (!visto || p.ultimoComentario > visto) && p.comentaron[0]?.id !== yo?.id
  return (
    <article
      className={`com-post${p.fijada ? ' fijada' : ''}${nueva ? ' nueva' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onAbrir())}
    >
      <header className="com-post-cabeza">
        <Cara autor={p.autor} />
        <div className="com-post-quien">
          <Nombre autor={p.autor} />
          <span className="com-meta">
            <time dateTime={p.creada} title={fechaLarga(p.creada)}>
              {hace(p.creada)}
            </time>
            <span>·</span>
            <span>{seccionDe(p.categoria).nombre}</span>
          </span>
        </div>
        <EstadoMejora p={p} />
        {!!p.reportes && <span className="com-reportada">Reportada · {p.reportes}</span>}
        {p.fijada && (
          <span className="com-fijada">
            <Icono de="pin" /> Fijada
          </span>
        )}
      </header>
      <div className="com-post-cuerpo">
        <div className="com-post-textos">
          {p.titulo && <h3>{p.titulo}</h3>}
          {p.texto && <p className={p.titulo ? '' : 'solo'}>{p.texto}</p>}
        </div>
        {portada && (
          <div className={`com-post-portada${portada.tipo === 'video' && portada.vertical ? ' vertical' : ''}`}>
            {imagen ? <img src={imagen} alt="" loading="lazy" /> : <video src={portada.url} muted preload="metadata" />}
            {portada.tipo === 'video' && (
              <span className="com-play">
                <Icono de="play" />
              </span>
            )}
            {p.adjuntos.length > 1 && <span className="com-mas-fotos">+{p.adjuntos.length - 1}</span>}
          </div>
        )}
      </div>
      <footer className="com-post-pie">
        <button className={`com-gusta${p.megusta ? ' on' : ''}`} title={p.megusta ? 'Ya no me gusta' : 'Me gusta'} onClick={(e) => (e.stopPropagation(), onMegusta())}>
          <Icono de="pulgar" /> {p.likes}
        </button>
        <span className="com-cuenta" title="Comentarios">
          <Icono de="hilo" /> {p.comentarios}
        </span>
        {p.comentaron.length > 0 && (
          <span className="com-caras-pie">
            {p.comentaron.map((a) => (
              <Cara key={a.id} autor={a} tam="chica" />
            ))}
          </span>
        )}
        {p.ultimoComentario && (
          <span className={`com-ultimo${nuevoComentario ? ' nuevo' : ''}`} title={fechaLarga(p.ultimoComentario)}>
            {nuevoComentario ? 'Nuevo comentario' : 'Último comentario'} {hace(p.ultimoComentario)}
          </span>
        )}
      </footer>
    </article>
  )
}
