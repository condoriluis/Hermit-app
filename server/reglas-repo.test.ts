import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, matchesGlob } from 'node:path'
import test from 'node:test'
import type { Card } from '../shared/types.ts'

/** Reglas del repo que se cumplen solas: escritas solo en AGENTS.md, los hilos las pasaban por alto. */
const REPO = join(import.meta.dirname, '..')

test('AGENTS.md no pasa de 1.000 palabras: entra en cada hilo que programa Hermit', () => {
  const palabras = readFileSync(join(REPO, 'AGENTS.md'), 'utf8').split(/\s+/).filter(Boolean).length
  assert.ok(palabras <= 1000, `AGENTS.md tiene ${palabras} palabras. Lo que entra, saca otra cosa (a docs/ con un puntero).`)
})

/**
 * Los iconos son de trazo (`web/src/Iconos.tsx`), nunca emojis. Las flechas (↗) son texto y valen. Lo que ya había es
 * deuda: no crece, y al quitarlo se quita también de aquí.
 */
const DEUDA: Record<string, string> = { 'Ideas.tsx': '💬', 'IdeasInvestigacion.tsx': '⚙🔎📺📅💬🎙🧭⏸⚠', 'IdeasPropuestas.tsx': '🎙🎬⚠', 'Redes.tsx': '⚙', 'Timeline.tsx': '⚙' }

test('la interfaz no suma emojis', () => {
  const web = join(REPO, 'web', 'src')
  for (const f of readdirSync(web).filter((f) => /\.tsx?$/.test(f))) {
    const nuevos = [...readFileSync(join(web, f), 'utf8').matchAll(/\p{Extended_Pictographic}/gu)]
      .map((m) => m[0])
      .filter((c) => !(c.codePointAt(0)! >= 0x2190 && c.codePointAt(0)! <= 0x21ff) && !(DEUDA[f] ?? '').includes(c))
    assert.deepEqual([...new Set(nuevos)], [], `web/src/${f} usa emojis: un icono de Iconos.tsx en su lugar`)
  }
})

test('solo las cards que se arman con clips de Flow declaran `clips`: las demás no reparten la duración en clips de 8 s', () => {
  const cards: Card[] = JSON.parse(readFileSync(join(REPO, 'cards.json'), 'utf8'))
  const conClips = cards.filter((c) => c.clips).map((c) => c.id).sort()
  // Las cuatro que generan su video con `generar_video` (sus voces son las de los clips: `voz: false`).
  assert.deepEqual(conClips, ['animalnovela', 'devnovela', 'frutinovela', 'minidrama'])
  for (const card of cards.filter((c) => c.clips)) {
    assert.equal(card.produce, 'video', `${card.id}: clips sin produce video`)
    assert.ok(card.etapas?.length, `${card.id}: clips sin etapas`)
    assert.equal(card.voz, false, `${card.id}: con clips la voz la ponen los clips, no el compositor`)
  }
})

test('la etapa «Video» de cada card cuenta solo el video final, no los borradores ni las partes', () => {
  const cards: Card[] = JSON.parse(readFileSync(join(REPO, 'cards.json'), 'utf8'))
  const intermedios = ['out/borrador-a.mp4', 'out/render-1.mp4', 'out/_parte.mp4', 'out/partes/p1.mp4', 'out/borrador.mp4']
  for (const card of cards)
    for (const e of (card.etapas ?? []).filter((e) => e.nombre === 'Video'))
      for (const ruta of intermedios) assert.equal(matchesGlob(ruta, e.listo), false, `${card.id}: «${e.listo}» cuenta ${ruta} como terminado`)
})
