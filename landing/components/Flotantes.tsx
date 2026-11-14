'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Play } from 'lucide-react'

/**
 * La «mesa de trabajo» del hero: solo contenido real —los pósters de los videos de ejemplo— como
 * tarjetas flotando en perspectiva, en un abanico simétrico: el principal al centro y dos pares
 * espejo a los lados (misma distancia, tamaños y giros opuestos), como las paredes de producto de
 * las landings profesionales. Cada una sube y baja a su ritmo (`flotar` de globals.css) y todas
 * siguen al mouse con distinta profundidad (`data-flota`). Los pósters son los mismos de
 * `Ejemplos` (Cloudinary, del video real). Con `prefers-reduced-motion` quedan quietas.
 */
const CLOUDINARY = 'https://res.cloudinary.com/dpxtci7sn/video/upload'
const portada = (id: string) => `${CLOUDINARY}/so_0,q_auto/${id}.jpg`

const ANIMALNOVELA = 'v1794276410/files/animalnovela-formato-vertical'
const DEVNOVELA = 'v1794277465/files/devnovela-git-vs-github'
const EL_DIFF = 'v1794420660/files/el-diff-final%20%281%29'
const FRUTINOVELA = 'v1794276221/files/frutinovela-todos-santos-2-noviembre'
const CRIMEN = 'v1794273538/files/crimen-muneco-chuky'

/** Una tarjeta de la mesa: posición en %, giro, profundidad del parallax y ritmo de flotación. */
function Tarjeta({
  x,
  y,
  z,
  giro,
  fondo,
  ritmo = 7,
  clase = '',
  children,
}: {
  x: string
  y: string
  z: number
  giro: number
  fondo: number
  ritmo?: number
  clase?: string
  children: ReactNode
}) {
  return (
    <div className={`absolute ${clase}`} style={{ left: x, top: y, zIndex: z }} data-flota={fondo}>
      <div className="flotar" style={{ rotate: `${giro}deg`, animationDuration: `${ritmo}s`, animationDelay: `-${ritmo / 3}s` }}>
        <div className="rounded-2xl border border-line bg-panel shadow-card overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

/** Un póster de video real con su chip de estilo, como en la galería. */
function PortadaVideo({ id, estilo, pie }: { id: string; estilo: string; pie: string }) {
  return (
    <div className="relative">
      <img src={portada(id)} alt={`${estilo}: ${pie}`} loading="lazy" className="kenburns block w-full aspect-[9/16] object-cover" />
      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-[9px] font-mono font-bold text-white uppercase tracking-wide">
        {estilo}
      </span>
      <span className="absolute inset-0 grid place-items-center">
        <span className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm border border-white/25 grid place-items-center">
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </span>
      </span>
    </div>
  )
}

export default function Flotantes() {
  const ref = useRef<HTMLDivElement>(null)

  // Parallax: cada tarjeta se mueve según su `data-flota` (la de adelante, más). El mouse se sigue
  // en toda la sección del hero, con interpolación para que no salte; se apaga solo al salir.
  useEffect(() => {
    const mesa = ref.current
    const seccion = mesa?.closest('section')
    if (!mesa || !seccion) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const piezas = Array.from(mesa.querySelectorAll<HTMLElement>('[data-flota]'))
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    let raf = 0
    let vivo = false
    const tick = () => {
      x += (tx - x) * 0.07
      y += (ty - y) * 0.07
      for (const el of piezas) {
        const d = Number(el.dataset.flota || 0)
        el.style.transform = `translate3d(${(x * d).toFixed(2)}px, ${(y * d).toFixed(2)}px, 0)`
      }
      if (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) {
        raf = requestAnimationFrame(tick)
      } else {
        vivo = false
      }
    }
    const mover = (e: PointerEvent) => {
      const r = seccion.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width) * 2 - 1
      ty = ((e.clientY - r.top) / r.height) * 2 - 1
      if (!vivo) {
        vivo = true
        raf = requestAnimationFrame(tick)
      }
    }
    const salir = () => {
      tx = 0
      ty = 0
      if (!vivo) {
        vivo = true
        raf = requestAnimationFrame(tick)
      }
    }
    seccion.addEventListener('pointermove', mover)
    seccion.addEventListener('pointerleave', salir)
    return () => {
      seccion.removeEventListener('pointermove', mover)
      seccion.removeEventListener('pointerleave', salir)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={ref} className="relative h-[390px] sm:h-[490px] mt-12 sm:mt-16 [perspective:1400px]">
      {/* El video principal, de frente y el más grande */}
      <Tarjeta x="50%" y="0%" z={30} giro={0} fondo={12} ritmo={7} clase="w-[158px] sm:w-[185px] -ml-[79px] sm:-ml-[92px]">
        <PortadaVideo id={ANIMALNOVELA} estilo="Animalnovela" pie="La inspección del bosque" />
      </Tarjeta>

      {/* Par de atrás: Devnovela a la izquierda, El Diff a la derecha — espejo */}
      <Tarjeta x="10%" y="8%" z={20} giro={-7} fondo={26} ritmo={8.5} clase="hidden lg:block w-[150px]">
        <PortadaVideo id={DEVNOVELA} estilo="Devnovela" pie="Git vs GitHub" />
      </Tarjeta>

      <Tarjeta x="77%" y="8%" z={20} giro={7} fondo={22} ritmo={8} clase="hidden lg:block w-[150px]">
        <PortadaVideo id={EL_DIFF} estilo="El Diff" pie="Qué es Hermit y para quién" />
      </Tarjeta>

      {/* Par de adelante: Frutinovela a la izquierda, Crimen a la derecha — espejo */}
      <Tarjeta x="25%" y="48%" z={10} giro={-5} fondo={34} ritmo={8} clase="hidden lg:block w-[128px]">
        <PortadaVideo id={FRUTINOVELA} estilo="Frutinovela" pie="Todos Santos" />
      </Tarjeta>

      <Tarjeta x="64%" y="50%" z={10} giro={6} fondo={38} ritmo={9.5} clase="hidden lg:block w-[128px]">
        <PortadaVideo id={CRIMEN} estilo="Crimen" pie="El muñeco Chucky" />
      </Tarjeta>
    </div>
  )
}
