/**
 * El bucle MCP por stdio que repiten los MCP de Hermit (voz, flow): un JSON-RPC por renglón — initialize, ping,
 * tools/list y tools/call— y cada herramienta envuelta en `content`/`isError`. Habla MCP sin paquetes, como los
 * scripts que lo usan, para que el Node de Hermit lo corra igual en el repo y en la app compilada
 * (`scripts/compilar.mjs` lo copia tal cual). El de Playwright (`navegador-mcp.mjs`) es un tubo distinto: no usa esto.
 */
import { createInterface } from 'node:readline'

const URL_HERMIT = process.env.HERMIT_URL ?? 'http://127.0.0.1:4848'

/** La API del servidor de Hermit. Los MCP no tocan el disco ni las sesiones de Google: todo pasa por aquí. */
export async function pedir(ruta, datos) {
  const r = await fetch(`${URL_HERMIT}${ruta}`, datos ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos) } : {})
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.error ?? `Hermit respondió ${r.status}`)
  return json
}

/**
 * Atiende MCP por stdio hasta que el proceso muera. `nombre` es el del servidor en initialize; `herramientas` el
 * JSON Schema de tools/list; `llamadas` mapea cada nombre de herramienta a su función async.
 */
export function servirMcp(nombre, herramientas, llamadas) {
  const responder = (id, cosa) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, ...cosa })}\n`)
  createInterface({ input: process.stdin }).on('line', async (renglon) => {
    let m
    try {
      m = JSON.parse(renglon)
    } catch {
      return
    }
    if (m.id === undefined) return // las notificaciones no se contestan
    if (m.method === 'initialize')
      return responder(m.id, { result: { protocolVersion: m.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: nombre, version: '1.0.0' } } })
    if (m.method === 'ping') return responder(m.id, { result: {} })
    if (m.method === 'tools/list') return responder(m.id, { result: { tools: herramientas } })
    if (m.method === 'tools/call') {
      const llamada = llamadas[m.params?.name]
      if (!llamada) return responder(m.id, { error: { code: -32602, message: `No hay herramienta ${m.params?.name}` } })
      try {
        responder(m.id, { result: { content: [{ type: 'text', text: await llamada(m.params.arguments ?? {}) }] } })
      } catch (e) {
        responder(m.id, { result: { content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true } })
      }
      return
    }
    responder(m.id, { error: { code: -32601, message: `No sé hacer ${m.method}` } })
  })
}
