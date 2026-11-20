import { useState } from 'react'
import { encender, encendido, notificar, sonar, usePermiso } from './avisos'
import { Interruptor } from './OpcionesBase'
import { Icono } from './Iconos'

/**
 * Los avisos de cuando un hilo termina o te necesita mientras miras otra cosa (`avisos.ts`). En la ventana de Hermit ya
 * tienen permiso; en Edge, encenderlas se lo pide, y si lo niega se dice dónde dárselo.
 */
export function Avisos() {
  const [permiso, setPermiso] = usePermiso()
  const [quiere, setQuiere] = useState(() => encendido('notificaciones'))
  const [sonido, setSonido] = useState(() => encendido('sonido'))
  // Lo que se enseña debajo: cómo darle el permiso, tras intentarlo sin él; qué mirar en Windows, tras la de prueba.
  const [ayuda, setAyuda] = useState<'permiso' | 'windows' | null>(null)
  const activas = quiere && permiso === 'granted'

  // Encenderlas manda una de prueba, como encender el sonido lo hace sonar: así no hacen falta botones para probar.
  async function cambiar(si: boolean) {
    encender('notificaciones', si)
    setQuiere(si)
    setAyuda(null)
    if (!si || permiso === 'sin-api') return
    const p = permiso === 'default' ? await Notification.requestPermission() : permiso
    setPermiso(p)
    if (p !== 'granted') return setAyuda('permiso')
    void notificar({ titulo: 'Así avisa Hermit', cuerpo: 'Cuando un hilo termine mientras miras otra cosa.', ids: [] })
    setAyuda('windows')
  }

  return (
    <div className="item">
      <div className="fila">
        <span className="logo" aria-hidden>
          <Icono de="campana" />
        </span>
        <div className="fila-nombre">
          <strong>Cuando un hilo termina o hay un anuncio</strong>
          <span>Te avisa si estás en otra cosa; la notificación abre el hilo o el anuncio.</span>
        </div>
        {permiso === 'denied' && <span className="estado falta">Bloqueadas en Edge</span>}
        <Interruptor on={activas} disabled={permiso === 'sin-api'} onCambiar={cambiar} etiqueta="Notificación" />
        <Interruptor on={sonido} onCambiar={(si) => (encender('sonido', si), setSonido(si), si && sonar())} etiqueta="Sonido" />
      </div>
      {ayuda === 'permiso' && (
        <p className="small fila-extra">
          Edge no deja avisar a Hermit. Para permitirlo, escribe <span className="mono">edge://settings/content/notifications</span> en una ventana de Edge,
          añade <span className="mono">{location.origin}</span> en «Permitir» (o quítalo de «No permitir») y vuelve aquí.
        </p>
      )}
      {ayuda === 'windows' && (
        <p className="muted small fila-extra">
          ¿No salió? Mira que Windows deje avisar a {window.hermit ? 'Hermit' : 'Microsoft Edge'} (Configuración → Sistema → Notificaciones) y que «No molestar» esté apagado.
        </p>
      )}
    </div>
  )
}
