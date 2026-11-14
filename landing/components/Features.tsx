import React from 'react'
import {
  HardDrive,
  KeyRound,
  ShieldCheck,
  Zap,
  Users,
  Download
} from 'lucide-react'
import { Animar } from './Animar'

const beneficios = [
  {
    icon: HardDrive,
    title: 'Tus archivos se quedan en tu PC',
    desc: 'Los videos, imágenes y artículos se guardan en tus carpetas, no en servidores externos.',
  },
  {
    icon: KeyRound,
    title: 'Sin cuotas mensuales',
    desc: 'App libre: la descargas gratis y pagas centavos solo por lo que uses en tu cuenta de IA.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacidad total',
    desc: 'Tus ideas y proyectos son completamente tuyos. Nadie más los ve.',
  },
  {
    icon: Zap,
    title: 'Fácil de verdad',
    desc: 'Sin programación ni configuraciones: la interfaz te guía paso a paso.',
  },
  {
    icon: Users,
    title: 'Apoyo directo',
    desc: 'Proyecto de luchodev con comunidad: sugerencias, mejoras y dudas.',
  },
  {
    icon: Download,
    title: 'Descarga en 1 minuto',
    desc: 'Bajas el ejecutable, lo abres y empiezas. Sin registros obligatorios.',
  },
]

export default function Features() {
  return (
    <section id="beneficios" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Animar className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase font-mono tracking-widest text-accent font-bold">
            Por qué te va a gustar
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-text font-heading tracking-tight mt-2">
            La forma más honesta y cómoda de usar IA
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted">
            Para creadores, emprendedores y desarrolladores: calidad sin complicaciones.
          </p>
        </Animar>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {beneficios.map((b, i) => {
            const Icon = b.icon
            return (
              <Animar key={i} delay={(i % 3) * 90}>
                <div className="h-full p-6 rounded-2xl bg-panel border border-line hover:border-line-strong hover:bg-panel-2 hover:-translate-y-1 transition-all duration-200">
                <div className="w-12 h-12 rounded-xl bg-panel-2 border border-line flex items-center justify-center text-accent mb-5">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-text font-heading mb-2">{b.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{b.desc}</p>
                </div>
              </Animar>
            )
          })}
        </div>
      </div>
    </section>
  )
}
