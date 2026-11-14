import { useEffect, useRef, useState, type KeyboardEvent as TeclaReact } from 'react'
import { deTipo, type Card, type ImagenHecha, type SessionMeta } from '../../shared/types'
import { api } from './api'
import { Confirm } from './Confirm'
import { Icono } from './Iconos'
import { Galeria, Rejilla, usePiezas } from './Piezas'

/**
 * «Mis imágenes»: las imágenes terminadas de las skills que generan imágenes, del más nuevo al más viejo. Cada tarjeta es
 * su imagen; un clic abre su ficha: la imagen en grande con sus datos y su ruta para copiarla (lo que se le pide al
 * agente). Su ✕ la manda a la Papelera. Se filtran por forma (vertical, horizontal o cuadrada), como en «Mis videos».
 * Las llena la card «Imágenes con IA» (skill `imagenes`); sin ninguna hecha todavía, la galería se ve vacía.
 */
type Forma = 'todas' | 'vertical' | 'horizontal'
/** La orientación de una imagen por su tamaño: vertical, horizontal o cuadrada (queda con las verticales). */
const orientacion = (w: number, h: number): 'vertical' | 'horizontal' | 'cuadrada' => (h > w * 1.02 ? 'vertical' : w > h * 1.02 ? 'horizontal' : 'cuadrada')
const escribiendo = (e: Event) => e.target instanceof HTMLElement && !!e.target.closest('input, textarea, select, [contenteditable="true"]')

export function MisImagenes({ cards, sessions }: { cards: Card[]; sessions: SessionMeta[] }) {
  const { datos, error } = usePiezas(cards, sessions)
  // La ruta de la que está en la ficha: si la galería se recarga y ya no está, la ficha se cierra sola.
  const [viendo, setViendo] = useState<string | null>(null)
  const [forma, setForma] = useState<Forma>('todas')
  // La orientación de cada imagen, cuando su tarjeta la midió al cargarla.
  const [orientadas, setOrientadas] = useState<Record<string, 'vertical' | 'horizontal' | 'cuadrada'>>({})
  const imagenes = datos ? deTipo(datos.piezas, 'imagen') : []
  // La orientación: la que midió la tarjeta al cargar, o la del tamaño que ya mandó el servidor — así el filtro y la
  // clase «ancha» son correctos desde el primer cuadro, sin esperar a que cargue la imagen.
  const orientadaDe = (i: ImagenHecha) => orientadas[i.ruta] ?? (i.ancho && i.alto ? orientacion(i.ancho, i.alto) : undefined)
  // Sin medida (ni del servidor ni de la tarjeta) se enseña en cualquier filtro: al medirla, se coloca sola.
  const enForma = imagenes.filter((i) => {
    const o = orientadaDe(i)
    if (!o || forma === 'todas') return true
    return forma === 'horizontal' ? o === 'horizontal' : o !== 'horizontal'
  })
  const indice = viendo ? enForma.findIndex((i) => i.ruta === viendo) : -1
  const actual = indice >= 0 ? enForma[indice] : null
  const pasar = (paso: number) => {
    const j = (indice + paso + enForma.length) % enForma.length
    if (enForma[j]) setViendo(enForma[j].ruta)
  }

  return (
    <Galeria
      titulo="Mis imágenes"
      cuenta={datos ? `${imagenes.length === 1 ? '1 imagen' : `${imagenes.length} imágenes`}, de la más nueva a la más vieja.` : !error && 'Buscando las imágenes terminadas…'}
      acciones={
        imagenes.length > 0 && (
          <div className="mis-formas" role="group" aria-label="Forma de la imagen">
            <button className={`todas${forma === 'todas' ? ' on' : ''}`} aria-pressed={forma === 'todas'} title="Todas las formas" onClick={() => setForma('todas')}>
              Todas
            </button>
            {(
              [
                ['vertical', 'Verticales', 'vertical', 'De pie, como un TikTok'],
                ['horizontal', 'Horizontales', 'horizontal', 'Apaisadas, como YouTube']
              ] as const
            ).map(([f, nombre, icono, donde]) => (
              <button key={f} className={forma === f ? 'on' : ''} aria-pressed={forma === f} title={`${nombre} · ${donde}`} onClick={() => setForma(f)}>
                <Icono de={icono} />
              </button>
            ))}
          </div>
        )
      }
    >
      {error && <p className="bad small">{error}</p>}
      {!datos ? null : enForma.length ? (
        <Rejilla key={forma} items={enForma}>
          {(i) => (
            <ImagenDe
              key={i.ruta}
              imagen={i}
              orientacion={orientadaDe(i)}
              onMedir={(o) => setOrientadas((t) => (t[i.ruta] === o ? t : { ...t, [i.ruta]: o }))}
              onVer={() => setViendo(i.ruta)}
            />
          )}
        </Rejilla>
      ) : (
        <p className="estilo-vacio">{imagenes.length ? 'Aún no hay imágenes de esa forma.' : 'Aún no hay imágenes. Cada una sale aquí en cuanto su skill la genera.'}</p>
      )}
      {/* Sin `key`: la ficha no se desmonta al pasar de una imagen a otra (como la de un modelo 3D); solo cambia la foto y los datos. */}
      {actual && <FotoDialogo imagen={actual} total={enForma.length} cards={cards} onCerrar={() => setViendo(null)} onPaso={pasar} />}
    </Galeria>
  )
}

/**
 * Una imagen terminada: la imagen, su título y su archivo, con su forma (vertical, horizontal o cuadrada) dibujada y
 * escrita encima. Un clic abre su ficha (`onVer`); su ✕ la manda a la Papelera. `onMedir` le dice a la galería su
 * orientación.
 */
function ImagenDe({ imagen, orientacion: orientada, onMedir, onVer }: { imagen: ImagenHecha; orientacion?: 'vertical' | 'horizontal' | 'cuadrada'; onMedir(o: 'vertical' | 'horizontal' | 'cuadrada'): void; onVer(): void }) {
  const [borrar, setBorrar] = useState(false)
  // La proporción real, si el servidor ya la midió: el marco nace del tamaño justo, sin el salto de medirla al cargar.
  const [tam, setTam] = useState<{ w: number; h: number } | undefined>(
    imagen.ancho && imagen.alto ? { w: imagen.ancho, h: imagen.alto } : undefined
  )
  const src = `/api/piezas/archivo?ruta=${encodeURIComponent(imagen.ruta)}&t=${Math.round(imagen.t)}`
  return (
    <div className="pieza-card">
      <button className="pieza-borrar" title="Borrar esta imagen" onClick={() => setBorrar(true)}>
        ✕
      </button>
      {borrar && (
        <Confirm
          title={`¿Borrar «${imagen.titulo}»?`}
          action="Borrar"
          danger
          onClose={() => setBorrar(false)}
          onConfirm={async () => {
            await api('/api/piezas/borrar', { ruta: imagen.ruta })
            dispatchEvent(new Event('hermit-videos'))
          }}
        >
          La imagen va a la Papelera de reciclaje, de donde puedes recuperarla. Lo demás de su carpeta se queda.
        </Confirm>
      )}
      <button className={`imagen-tile${orientada === 'horizontal' ? ' ancha' : ''}`} style={tam ? ({ '--img-ratio': tam.w / tam.h } as React.CSSProperties) : undefined} title="Verla" onClick={onVer}>
        <span className="imagen-marco">
          <img
            src={src}
            alt=""
            loading="lazy"
            onLoad={(e) => {
              const i = e.currentTarget
              if (!i.naturalWidth || !i.naturalHeight) return
              setTam({ w: i.naturalWidth, h: i.naturalHeight })
              onMedir(orientacion(i.naturalWidth, i.naturalHeight))
            }}
          />
          {orientada && <span className="video-forma">{orientada === 'cuadrada' ? 'Cuadrada' : orientada === 'vertical' ? 'Vertical' : 'Horizontal'}</span>}
        </span>
        <span className="pieza-titulo">{imagen.titulo}</span>
        <span className="pieza-dato">{imagen.archivo.split('/').pop()}</span>
      </button>
    </div>
  )
}

/**
 * La ficha de una imagen, como la de un modelo 3D: la imagen en grande a la izquierda y sus datos a la derecha — el
 * estilo que la hizo, su archivo, su tamaño, su fecha y su ruta completa, que es lo que se copia para pedírsela al
 * agente. Esc y el fondo la cierran, ← y → pasan a la de al lado y Tab no sale de ella. «Abrir su hilo» lleva a su
 * sesión cuando la tiene.
 */
function FotoDialogo({ imagen, total, cards, onCerrar, onPaso }: { imagen: ImagenHecha; total: number; cards: Card[]; onCerrar(): void; onPaso(paso: number): void }) {
  const [copiado, setCopiado] = useState(false)
  const dialogo = useRef<HTMLDivElement>(null)
  const estilo = cards.find((c) => c.id === imagen.cardId)?.title
  const tamano = imagen.ancho && imagen.alto ? `${imagen.ancho} × ${imagen.alto} px` : '—'
  const fecha = new Date(imagen.t).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const src = `/api/piezas/archivo?ruta=${encodeURIComponent(imagen.ruta)}&t=${Math.round(imagen.t)}`

  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(false), 1600)
    return () => clearTimeout(t)
  }, [copiado])
  // Al abrir, el foco entra a la ficha: lo que se teclea ya no va a la rejilla de atrás.
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => dialogo.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(cuadro)
  }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      else if (!escribiendo(e) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'ArrowRight') onPaso(1)
        else if (e.key === 'ArrowLeft') onPaso(-1)
      }
    }
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
  }, [onPaso])
  /** Lo que toma el foco en la ficha, en orden. */
  const enfocables = () => [...(dialogo.current?.querySelectorAll<HTMLElement>('button, [href], select, input, [tabindex="0"]') ?? [])].filter((x) => x.offsetParent)
  /** Tab da la vuelta dentro de la ficha, sin salir a la rejilla de atrás. */
  function sinSalir(e: TeclaReact<HTMLDivElement>) {
    if (e.key !== 'Tab' || !dialogo.current) return
    const hay = enfocables()
    if (!hay.length) return
    const i = hay.indexOf(document.activeElement as HTMLElement)
    const j = e.shiftKey ? (i <= 0 ? hay.length - 1 : i - 1) : i < 0 || i === hay.length - 1 ? 0 : i + 1
    e.preventDefault()
    hay[j].focus()
  }
  const copiar = () => navigator.clipboard.writeText(imagen.ruta).then(() => setCopiado(true), () => {})
  // Solo cierra un clic que empezó y acabó en el velo: soltar fuera una selección de texto no la cierra.
  const desdeElVelo = useRef(false)

  return (
    <div className="pieza-velo" onPointerDown={(e) => (desdeElVelo.current = e.target === e.currentTarget)} onClick={(e) => desdeElVelo.current && e.target === e.currentTarget && onCerrar()}>
      <div ref={dialogo} className="pieza-dialogo" role="dialog" aria-modal="true" aria-label={imagen.titulo} tabIndex={-1} onKeyDown={sinSalir}>
        <div className="pieza-dialogo-img">
          <img src={src} alt={imagen.titulo} />
          {total > 1 && (
            <>
              <button className="pieza-paso izq" title="La anterior (←)" aria-label="La anterior" onClick={() => onPaso(-1)}>
                <Icono de="anterior" />
              </button>
              <button className="pieza-paso der" title="La siguiente (→)" aria-label="La siguiente" onClick={() => onPaso(1)}>
                <Icono de="siguiente" />
              </button>
            </>
          )}
          <button className="pieza-cerrar" title="Cerrar (Esc)" aria-label="Cerrar" onClick={onCerrar}>
            <Icono de="cerrar" />
          </button>
        </div>
        <div className="pieza-dialogo-texto">
          <h2>{imagen.titulo}</h2>
          <dl className="pieza-datos">
            <dt>Estilo</dt>
            <dd>{estilo ?? '—'}</dd>
            <dt>Archivo</dt>
            <dd>
              <code>{imagen.archivo}</code>
            </dd>
            <dt>Tamaño</dt>
            <dd>{tamano}</dd>
            <dt>Fecha</dt>
            <dd>{fecha}</dd>
            <dt>Ruta</dt>
            <dd>
              <code>{imagen.ruta}</code>
            </dd>
          </dl>
          <div className="pieza-dialogo-acciones">
            <button className="pieza-accion" onClick={copiar}>
              <Icono de={copiado ? 'palomita' : 'copiar'} />
              {copiado ? 'Copiada' : 'Copiar ruta'}
            </button>
            {imagen.sessionId && (
              <button
                className="pieza-accion principal"
                onClick={() => {
                  location.hash = `/s/${imagen.sessionId}/${encodeURIComponent(imagen.archivo)}`
                  onCerrar()
                }}
              >
                <Icono de="hilo" />
                Abrir su hilo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
