'use client'

import { useEffect, useRef } from 'react'

const INTERACTIVO =
  "a, button, [role='button'], summary, input, textarea, select, label"

export default function SeguidorCursor() {
  const anilloRef = useRef<HTMLDivElement>(null)
  const puntoRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const punteroFino = window.matchMedia('(pointer: fine)')
    const puedeFlotar = window.matchMedia('(hover: hover)')
    const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)')

    if (!punteroFino.matches || !puedeFlotar.matches || menosMovimiento.matches) {
      return
    }

    const anillo = anilloRef.current
    const punto = puntoRef.current
    const halo = haloRef.current
    if (!anillo || !punto || !halo) return

    let objetivoX = 0
    let objetivoY = 0
    let anilloX = 0
    let anilloY = 0
    let haloX = 0
    let haloY = 0
    let cuadro = 0
    let visible = false
    let activo = false
    let presionado = false
    let iniciado = false

    const ponerVisible = (siguiente: boolean) => {
      visible = siguiente
      anillo.style.opacity = siguiente ? '1' : '0'
      punto.style.opacity = siguiente ? '1' : '0'
      halo.style.opacity = siguiente ? '1' : '0'
    }

    const pintar = () => {
      const escalaAnillo = presionado ? 0.72 : activo ? 1.7 : 1
      const escalaPunto = presionado ? 0.6 : activo ? 1.5 : 1

      anillo.style.transform = `translate3d(${anilloX}px, ${anilloY}px, 0) scale(${escalaAnillo})`
      punto.style.transform = `translate3d(${objetivoX}px, ${objetivoY}px, 0) scale(${escalaPunto})`
    }

    const bucle = () => {
      anilloX += (objetivoX - anilloX) * 0.18
      anilloY += (objetivoY - anilloY) * 0.18
      haloX += (objetivoX - haloX) * 0.055
      haloY += (objetivoY - haloY) * 0.055
      pintar()
      halo.style.transform = `translate3d(${haloX}px, ${haloY}px, 0) translate(-50%, -50%)`
      cuadro = requestAnimationFrame(bucle)
    }

    const alMover = (evento: PointerEvent) => {
      if (evento.pointerType === 'touch') return
      objetivoX = evento.clientX
      objetivoY = evento.clientY

      if (!iniciado) {
        anilloX = objetivoX
        anilloY = objetivoY
        haloX = objetivoX
        haloY = objetivoY
        iniciado = true
      }

      if (!visible) ponerVisible(true)
    }

    const alPasar = (evento: PointerEvent) => {
      const destino = evento.target as Element | null
      activo = Boolean(destino?.closest(INTERACTIVO))
    }

    const alBajar = () => {
      presionado = true
    }

    const alSubir = () => {
      presionado = false
    }

    const alSalir = () => ponerVisible(false)
    const alEntrar = (evento: MouseEvent) => {
      objetivoX = evento.clientX
      objetivoY = evento.clientY
      ponerVisible(true)
    }
    const alPerderFoco = () => ponerVisible(false)

    document.addEventListener('pointermove', alMover, { passive: true })
    document.addEventListener('pointerover', alPasar, { passive: true })
    document.addEventListener('pointerdown', alBajar, { passive: true })
    document.addEventListener('pointerup', alSubir, { passive: true })
    document.documentElement.addEventListener('mouseleave', alSalir)
    document.documentElement.addEventListener('mouseenter', alEntrar)
    window.addEventListener('blur', alPerderFoco)

    cuadro = requestAnimationFrame(bucle)

    return () => {
      cancelAnimationFrame(cuadro)
      document.removeEventListener('pointermove', alMover)
      document.removeEventListener('pointerover', alPasar)
      document.removeEventListener('pointerdown', alBajar)
      document.removeEventListener('pointerup', alSubir)
      document.documentElement.removeEventListener('mouseleave', alSalir)
      document.documentElement.removeEventListener('mouseenter', alEntrar)
      window.removeEventListener('blur', alPerderFoco)
    }
  }, [])

  return (
    <>
      <div
        ref={anilloRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-40 -ml-4 -mt-4 hidden h-8 w-8 rounded-full border border-[rgba(45,212,191,0.55)] opacity-0 transition-opacity duration-200 will-change-transform md:block"
        style={{ boxShadow: '0 0 24px rgba(45, 212, 191, 0.28)' }}
      />
      <div
        ref={puntoRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-40 -ml-[3px] -mt-[3px] hidden h-1.5 w-1.5 rounded-full bg-[#2dd4bf] opacity-0 transition-opacity duration-200 will-change-transform md:block"
      />
      <div
        ref={haloRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-0 hidden h-[440px] w-[440px] rounded-full opacity-0 transition-opacity duration-700 will-change-transform md:block"
        style={{
          background:
            'radial-gradient(circle, rgba(45,212,191,0.10) 0%, rgba(45,212,191,0.045) 38%, transparent 68%)',
        }}
      />
    </>
  )
}
