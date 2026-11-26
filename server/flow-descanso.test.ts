import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import { NoArranco, SinEmpezar } from './flow/pagina.ts'
import { flow } from './flow/index.ts'

interface Respuesta {
  status: number
  cuerpo: any
}

function respuesta() {
  const r = {
    status: 0,
    cuerpo: undefined as any,
    writeHead(status: number) {
      r.status = status
    },
    end(cuerpo: string) {
      r.cuerpo = JSON.parse(cuerpo)
    }
  }
  return r as unknown as ServerResponse & Respuesta
}

async function pedir(f: ReturnType<typeof flow>, metodo: string, ruta: string, datos?: unknown) {
  const req = Object.assign(Readable.from(datos === undefined ? [] : [Buffer.from(JSON.stringify(datos))]), { method: metodo, url: ruta }) as unknown as IncomingMessage
  const res = respuesta()
  assert.equal(await f.api(req, res, ruta.split('?')[0]), true)
  return res
}

/** Pide una imagen que siempre falla con `error`, espera a que la cuenta descansa y dice el motivo que quedó. */
async function motivoTrasFallo(app: string, error: Error) {
  const f = flow(app, {
    cuenta: () => 'yo@gmail.com',
    enEdge: async () => {
      throw error
    },
    abrirEnEdge: async () => {}
  })
  const creado = await pedir(f, 'POST', '/api/flow/generar', { tipo: 'imagen', prompt: 'un perezoso', salida: join(app, 'x.jpg') })
  const trabajo = await pedir(f, 'GET', `/api/flow/trabajos/${creado.cuerpo.id}?esperar=45`)
  assert.equal(trabajo.cuerpo.estado, 'esperando')
  const estado = await pedir(f, 'GET', '/api/flow')
  return estado.cuerpo.cuentas[0]?.descansa?.motivo as string
}

test('un fallo antes de enviar el pedido no es una frenada: la cuenta descansa como navegador', async (t) => {
  const app = mkdtempSync(join(tmpdir(), 'hermit-flow-'))
  t.after(() => rmSync(app, { recursive: true, force: true }))
  // Como «Flow no tomó la referencia»: la página falló, no hay evidencia de que Google frene la cuenta.
  const motivo = await motivoTrasFallo(app, new SinEmpezar('Flow no preparó el pedido (Flow no tomó la referencia ref-1.jpg).'))
  assert.equal(motivo, 'navegador')
})

test('el pedido que llegó a Flow y no arrancó sí es una frenada', async (t) => {
  const app = mkdtempSync(join(tmpdir(), 'hermit-flow-'))
  t.after(() => rmSync(app, { recursive: true, force: true }))
  const motivo = await motivoTrasFallo(app, new NoArranco('Flow no empezó a generar.'))
  assert.equal(motivo, 'frenada')
})

test('el aviso de freno de la propia Flow sigue siendo frenada', async (t) => {
  const app = mkdtempSync(join(tmpdir(), 'hermit-flow-'))
  t.after(() => rmSync(app, { recursive: true, force: true }))
  const motivo = await motivoTrasFallo(app, new SinEmpezar('Flow la frenó por actividad inusual'))
  assert.equal(motivo, 'frenada')
})
