'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Download, Play } from 'lucide-react'
import { enlaceDescarga } from '@/lib/descargas'
import Flotantes from '@/components/Flotantes'

type So = 'windows' | 'mac' | 'linux'

/** Los estilos de video, en la cinta bajo el hero (va duplicada para que el ciclo no se note). */
const ESTILOS = [
  'Video El Diff',
  'Explicativo',
  'Documental',
  'Top',
  'Reddit',
  'Crimen',
  'Motivacional',
  'Política',
  'Animalnovela',
  'Devnovela',
  'Frutinovela',
  'Reel Collage',
  'Minidrama',
]

export default function Hero() {
  const [os, setOs] = useState<{ name: string; ext: string; so: So }>({ name: 'Windows', ext: '.exe', so: 'windows' })
  const brillo = useRef<HTMLDivElement>(null)

  // El brillo que sigue al mouse, sin re-renderizar: se escribe el gradiente directo en el nodo.
  const moverBrillo = (e: React.PointerEvent<HTMLElement>) => {
    const el = brillo.current
    if (!el || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    el.style.background = `radial-gradient(560px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(45, 212, 191, 0.10), transparent 55%)`
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase()
      if (ua.includes('mac')) {
        setOs({ name: 'Mac', ext: '.dmg', so: 'mac' })
      } else if (ua.includes('linux')) {
        setOs({ name: 'Linux', ext: '.AppImage', so: 'linux' })
      } else {
        setOs({ name: 'Windows', ext: '.exe', so: 'windows' })
      }
    }
  }, [])

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden" onPointerMove={moverBrillo}>
      {/* Brillo que sigue al mouse */}
      <div ref={brillo} className="absolute inset-0 pointer-events-none -z-10" />
      {/* Background radial gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-accent/15 via-accent/5 to-transparent blur-3xl pointer-events-none -z-10 animate-brillo" />

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#232a3315_1px,transparent_1px),linear-gradient(to_bottom,#232a3315_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Titular corto: la prueba visual la pone la mesa, no las palabras */}
        <h1 className="entrada text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight font-heading text-text max-w-4xl mx-auto leading-[1.05]">
          Tu <span className="bg-gradient-to-r from-accent via-accent-hover to-[#99f6e4] bg-clip-text text-transparent">fábrica de contenido</span> con IA
        </h1>

        <p className="entrada mt-5 text-base sm:text-lg text-muted max-w-xl mx-auto" style={{ animationDelay: '120ms' }}>
          Videos, artículos, imágenes y presentaciones — los hace paso a paso en tu computadora.
        </p>

        {/* Action CTAs */}
        <div className="entrada mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none" style={{ animationDelay: '200ms' }}>
          <a
            href={enlaceDescarga(os.so)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-accent hover:bg-accent-hover text-on-solid font-bold text-base font-heading transition-all shadow-glow hover:scale-[1.02] active:scale-95"
          >
            <Download className="w-5 h-5" />
            <span>Descargar Gratis ({os.name})</span>
          </a>

          <a
            href="#demostracion"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-panel hover:bg-panel-2 border border-line hover:border-line-strong text-text font-semibold text-base transition-all"
          >
            <Play className="w-4 h-4 text-accent fill-accent" />
            <span>Ver Cómo Funciona</span>
          </a>
        </div>

        <p className="entrada mt-4 text-xs font-mono text-muted/80" style={{ animationDelay: '280ms' }}>
          Gratis · Windows · Mac · Linux
        </p>

        {/* La mesa de trabajo: las salidas reales de Hermit, protagonistas del hero */}
        <Flotantes />
      </div>

      {/* La cinta de estilos: lo que se puede crear, en movimiento lento */}
      <div className="mt-16 border-t border-line/60 overflow-hidden" aria-hidden="true">
        <div className="cinta flex w-max items-center gap-8 py-4">
          {[...ESTILOS, ...ESTILOS].map((e, i) => (
            <span key={i} className="flex items-center gap-8 text-xs font-mono text-muted/70 whitespace-nowrap">
              {e}
              <span className="w-1 h-1 rounded-full bg-accent/50" />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
