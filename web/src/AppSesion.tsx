import { memo, type ReactNode, useCallback, useMemo, useState } from 'react'
import { CANAL_CARD, IDEAS_CARD } from '../../shared/ideas' // ideas
import type { Card, Model, SessionMeta } from '../../shared/types'
import { NOMBRE_AGENTE, proveedorDe } from '../../shared/providers'
import { api } from './api'
import { useFallo, useResumen } from './eventos'
import { esDeEstudio, Estudio } from './Estudio' // panel de etapas
import { BotonNavegador, PanelNavegador, useNavegadorAbierto } from './Navegador' // navegador de cada hilo
import { conReferencia, ReferenciaVideo } from './Referencia'
import { Composer, Icon } from './Composer'
import { pedirMejora } from './etiquetas'
import { NombreDelHilo } from './Renombrar'
import { MarcaAgente } from './Logos'
import { Timeline } from './Timeline'
import { compact, duration } from './items'
import { Pedir } from './AppBarra'
import { elegidoAMano, go, guardarRespuesta, leerRespuesta } from './AppBase'

const SIN_TAREAS: string[] = []

/**
 * Un hilo abierto. No lee sus eventos: los lee el chat (y el estudio), que es lo único que cambia con cada trozo del
 * agente. Aquí solo llega su resumen (`useResumen`), que cambia al acabar un turno o al medir el contexto.
 */
export const SessionView = memo(function SessionView({ id, session, card, models }: { id: string; session?: SessionMeta; card?: Card; models: Model[] }) {
  // El subagente abierto en el chat, del hilo donde lo abriste. Mientras se ve, su barra va en el sitio del compositor.
  const [abierto, setAbierto] = useState<{ sesion: string; id: string } | null>(null)
  const onSubagente = useCallback((sub: string | null) => setAbierto(sub ? { sesion: id, id: sub } : null), [id])
  const fallo = useFallo(id)
  // El tiempo es lo que el agente pasó trabajando: la suma de cada turno, no lo que lleva abierta la sesión. Un turno sin
  // costo (se cortó antes de saberlo, o fue el primero tras retomar el hilo) no suma: el total es entonces lo
  // menos que costó.
  const totals = useResumen(id)
  // Un video del lote que espera su turno arranca con su propio mensaje: un clic no le manda otro.
  const pendiente = !!session?.pendiente
  const onResponder = useMemo(() => (pendiente ? undefined : (text: string) => api(`/api/sessions/${id}/send`, { text })), [id, pendiente])
  const navegador = useNavegadorAbierto(id)
  if (!session) return <div className="empty">{fallo ? `No se pudo abrir este hilo: ${fallo}` : 'Cargando…'}</div>
  const subagente = abierto?.sesion === session.id ? abierto.id : undefined
  const trabaja = session.running || !!session.background?.length
  const head = (extra?: ReactNode) => (
    <header className="session-head">
      <span className="session-icon"><Icon icon={card?.icon ?? '•'} /></span>
      <NombreDelHilo key={session.id} session={session} />
      <span className="spacer" />
      {totals.ms > 0 && <span className="muted small">{duration(totals.ms)}</span>}
      {(totals.cost > 0 || totals.sinCosto > 0) && (
        <span className="muted small" title={totals.sinCosto ? `Sin contar ${totals.sinCosto === 1 ? 'un turno' : `${totals.sinCosto} turnos`} sin costo: se cortaron antes de saberlo, fueron el primero tras retomar el hilo o su modelo de Codex no tenía precio` : undefined}>
          {totals.sinCosto ? '≥ ' : ''}${totals.cost.toFixed(2)}
        </span>
      )}
      {totals.flowCreditos > 0 && (
        <span className="muted small" title={`${totals.flowVideos} ${totals.flowVideos === 1 ? 'video' : 'videos'} de Google Flow en este chat`}>
          {totals.flowCreditos} créditos de Flow
        </span>
      )}
      {totals.read > 0 && <span className="muted small">{compact(totals.read)} tokens leídos</span>}
      {totals.out > 0 && <span className="muted small">{compact(totals.out)} tokens escritos</span>}
      {/* El símbolo del agente del hilo: pide una mejora sobre él. Solo el símbolo: el encabezado de un video va justo. */}
      <button className="pedir-mejora solo" title={`Pedir una mejora: ¿algo no salió como esperabas? ${NOMBRE_AGENTE[proveedorDe(session.model)]} te ayuda a decirlo`} aria-label="Pedir una mejora" onClick={() => pedirMejora({ hilo: session.id })}>
        <MarcaAgente de={proveedorDe(session.model)} />
      </button>
      {extra}
      <BotonNavegador hilo={session.id} trabajando={trabaja} />
    </header>
  )
  const chat = (bloqueo?: string) => (
    <>
      <Timeline
        key={`timeline:${session.id}`}
        running={session.running}
        background={session.background ?? SIN_TAREAS}
        sessionId={session.id}
        proveedor={proveedorDe(session.model)}
        subagente={subagente}
        onSubagente={onSubagente}
        onResponder={onResponder}
      />
      {/* Oculto y no quitado: guarda lo que escribías, y una cita del subagente le llega. */}
      <div className="session-composer" hidden={!!subagente}>
        {session.pendiente && (
          <div className="queue">
            <div className="queued">
              <span className="muted small">{session.lote?.pausa ? 'Lote en pausa' : 'En espera'}</span>
              <span className="queued-text" title={session.lote?.pausa}>
                {session.lote?.pausa ?? `Video ${session.lote?.n} de ${session.lote?.de}: empieza solo cuando haya sitio en la máquina.`}
              </span>
              {session.lote?.pausa && (
                <Pedir ruta={`/api/lotes/${session.lote.id}/seguir`} title="Los que esperan vuelven a arrancar cuando haya sitio">
                  Seguir con el lote
                </Pedir>
              )}
              <Pedir ruta={`/api/sessions/${session.id}/empezar`} title="Que este empiece ya, sin esperar su turno">
                Empezar ya
              </Pedir>
            </div>
          </div>
        )}
        {bloqueo && (
          <div className="queue">
            <div className="queued">
              <span className="muted small">Falta un archivo</span>
              <span className="queued-text" title={bloqueo}>{bloqueo}</span>
            </div>
          </div>
        )}
        {/* Lo elegido en el video (un elemento, una escena, un tramo): el mensaje lo lleva delante. */}
        {esDeEstudio(card) && <ReferenciaVideo sessionId={session.id} />}
        <Composer
          key={`composer:${session.id}`}
          bloqueo={bloqueo}
          models={models.filter((m) => proveedorDe(m.id) === proveedorDe(session.model))}
          initial={{ model: session.model, effort: session.effort }}
          running={session.running}
          background={!!session.background?.length}
          lockModel={!!session.background?.length}
          context={totals.context}
          flow={{ videos: totals.flowVideos, creditos: totals.flowCreditos }}
          onCompactar={() => api(`/api/sessions/${session.id}/compactar`, {})}
          placeholder="Responde, pide un cambio, pega una imagen o suelta un archivo…"
          draft={leerRespuesta(session.id)}
          onDraft={(d) => guardarRespuesta(session.id, d)}
          onChoice={(c) => api(`/api/sessions/${session.id}/model`, c).then(() => elegidoAMano(c))}
          onStop={() => api(`/api/sessions/${session.id}/stop`, {})}
          onSend={(text, _choice, images) => api(`/api/sessions/${session.id}/send`, { text: conReferencia(session.id, text), images })}
        />
      </div>
    </>
  )
  // Un estilo de video se ve en el estudio, siempre con el mismo marco.
  if (esDeEstudio(card)) return <Estudio key={session.id} session={session} card={card!} head={head} chat={chat} /> // panel de etapas
  // Lo que deja un hilo de Ideas se ve en la sección, en la carpeta de su canal (su `cwd`).
  const canal = card?.id === IDEAS_CARD.id || card?.id === CANAL_CARD.id ? session.cwd.split(/[\\/]/).filter(Boolean).pop() : undefined // ideas
  return (
    <div className="session">
      {head(
        canal && (
          <button className="ghost small" onClick={() => go({ kind: 'ideas', canalId: canal })}>
            Ver en Ideas
          </button>
        )
      )}
      {/* El chat no cambia de sitio al abrir el navegador: no se vuelve a montar. */}
      <div className="session-cuerpo">
        <div className="session-chat">{chat()}</div>
        {navegador && <PanelNavegador hilo={session.id} trabajando={trabaja} />}
      </div>
    </div>
  )
})
