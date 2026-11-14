import React from 'react'
import {
  Video,
  FileText,
  Share2,
  FolderPlus,
  Cpu,
  Image as ImageIcon,
  Presentation,
  Box
} from 'lucide-react'
import { Animar } from './Animar'

const herramientas = [
  {
    icon: Video,
    tag: 'Videos Cortos y Largos',
    title: '13 estilos de video',
    desc: 'TikTok, Reels, Shorts y YouTube: la IA investiga, escribe el guion y exporta el MP4.',
    pasos: ['Idea y guion', 'Voz y escenas', 'Video final'],
    badge: 'Popular',
  },
  {
    icon: FileText,
    tag: 'Textos y Web',
    title: 'Artículos para tu blog',
    desc: 'Investigación a fondo, texto completo y portada generada, listos para copiar.',
    pasos: ['Tema investigado', 'Texto completo', 'Portada'],
    badge: 'Para Leer',
  },
  {
    icon: ImageIcon,
    tag: 'Imágenes con IA',
    title: 'Imágenes con un clic',
    desc: 'Describe lo que quieres y queda en tu galería, lista para descargar.',
    pasos: ['Describe', 'Generación IA', 'Tu galería'],
    badge: 'Creativo',
  },
  {
    icon: Presentation,
    tag: 'Para Trabajo y Clases',
    title: 'Presentaciones listas',
    desc: 'PowerPoint y PDF completos, del tema al archivo final.',
    pasos: ['Diapositivas', 'Diseño', 'PPTX y PDF'],
    badge: 'Trabajo',
  },
  {
    icon: Share2,
    tag: 'Ahorra Tiempo',
    title: 'Publicación automática',
    desc: 'Tus videos se publican solos en TikTok, Instagram y YouTube, en tus horarios.',
    pasos: ['Videos en cola', 'Horario elegido', 'Envío solo'],
    badge: 'Práctico',
  },
  {
    icon: Box,
    tag: 'Biblioteca 3D',
    title: 'Modelos 3D con visor',
    desc: 'Tus modelos se guardan, se giran en el visor y se reusan en los videos.',
    pasos: ['Biblioteca', 'Visor 3D', 'Reúso en videos'],
    badge: 'Nuevo',
  },
  {
    icon: FolderPlus,
    tag: 'A tu Medida',
    title: 'Crea tu estilo de video',
    desc: 'Descríbele el video que quieres y Hermit arma su card, lista para usar.',
    pasos: ['Describe el estilo', 'Hermit lo arma', 'Úsalo igual'],
    badge: 'Tuyo',
  },
  {
    icon: Cpu,
    tag: 'Tú Eliges',
    title: 'Tu agente de IA favorito',
    desc: 'Claude, ChatGPT, Gemini, Devin y más — con tu propia cuenta, sin ataduras.',
    pasos: ['Claude', 'ChatGPT / Codex', 'Devin y más'],
    badge: 'Sin Ataduras',
  },
]

export default function SkillsShowcase() {
  return (
    <section id="herramientas" className="py-24 relative bg-panel/30 border-y border-line/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Animar className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase font-mono tracking-widest text-accent font-bold">
            Lo que puedes hacer
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-text font-heading tracking-tight mt-2">
            Todo lo que Hermit crea por ti
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted">
            Eliges la tarjeta y la IA hace el trabajo a la vista, en tu computadora.
          </p>
        </Animar>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {herramientas.map((h, idx) => {
            const Icon = h.icon
            return (
              <Animar key={idx} delay={(idx % 4) * 80}>
              <div
                key={idx}
                className="h-full rounded-2xl bg-panel border border-line p-6 flex flex-col justify-between hover:border-accent/40 hover:bg-panel-2 transition-all duration-300 shadow-card group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-panel-2 border border-line flex items-center justify-center text-accent group-hover:scale-110 group-hover:border-accent/50 transition-all">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent uppercase">
                      {h.badge}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-muted uppercase tracking-wider font-semibold">
                    {h.tag}
                  </span>
                  <h3 className="text-lg font-bold text-text font-heading mt-1 group-hover:text-accent transition-colors">
                    {h.title}
                  </h3>
                  <p className="text-sm text-muted mt-2 leading-relaxed">
                    {h.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-line/60">
                  <div className="flex flex-wrap gap-1.5">
                    {h.pasos.map((p, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-panel-2 text-[10px] font-mono text-text-2 border border-line"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              </Animar>
            )
          })}
        </div>
      </div>
    </section>
  )
}
