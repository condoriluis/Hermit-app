import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { dispDe, refDe, soDe } from './estadisticas.ts'

test('reconoce el sistema y el tipo de aparato por el User-Agent', () => {
  assert.equal(soDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'), 'Windows')
  assert.equal(soDe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605'), 'Mac')
  assert.equal(soDe('Mozilla/5.0 (X11; Linux x86_64) Firefox/131'), 'Linux')
  assert.equal(soDe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'iOS')
  assert.equal(soDe('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'Android')
  assert.equal(soDe('curl/8.0'), 'Otro')
  assert.equal(dispDe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'móvil')
  assert.equal(dispDe('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'móvil')
  assert.equal(dispDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'escritorio')
})

test('de dónde se vino: el host del referer, con nombre para los conocidos', () => {
  assert.equal(refDe(null), null)
  assert.equal(refDe(''), null)
  assert.equal(refDe('no-es-una-url'), null)
  assert.equal(refDe('http://localhost:3100/'), null)
  assert.equal(refDe('https://myhermit.vercel.app/precios'), 'la página')
  assert.equal(refDe('https://www.google.com/search?q=hermit'), 'Google')
  assert.equal(refDe('https://google.com.mx/search?q=x'), 'Google')
  assert.equal(refDe('https://www.tiktok.com/@alguien/video/1'), 'TikTok')
  assert.equal(refDe('https://m.youtube.com/watch?v=1'), 'YouTube')
  assert.equal(refDe('https://t.me/canal'), 'Telegram')
  assert.equal(refDe('https://blog.ejemplo.com/post/1'), 'blog.ejemplo.com')
  // El host se recorta: nada de la ruta ni de parámetros.
  assert.equal(refDe(`https://sitio-muy-largo-${'x'.repeat(80)}.com/ruta?secreto=1`), `sitio-muy-largo-${'x'.repeat(80)}.com`.slice(0, 60))
})

test('la migración de visitas crea su tabla y acepta una fila de cada tipo', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/0013_visitas.sql', import.meta.url), 'utf8'))
  db.prepare("INSERT INTO visitas (ts, sesion, tipo, ruta, ref, pais, ciudad, so, disp) VALUES (?, ?, 'pagina', ?, ?, ?, ?, ?, ?)")
    .run('2026-11-21T12:00:00.000Z', 'abc123', '/', 'Google', 'BO', 'La Paz', null, 'escritorio')
  db.prepare("INSERT INTO visitas (ts, sesion, tipo, ruta, ref, pais, ciudad, so, disp) VALUES (?, ?, 'descarga', NULL, NULL, 'MX', 'CDMX', 'windows', 'escritorio')")
    .run('2026-11-21T12:05:00.000Z', 'abc123')
  const filas = db.prepare('SELECT tipo, so, pais FROM visitas ORDER BY id').all().map((f) => ({ ...f }))
  assert.deepEqual(filas, [
    { tipo: 'pagina', so: null, pais: 'BO' },
    { tipo: 'descarga', so: 'windows', pais: 'MX' }
  ])
})
