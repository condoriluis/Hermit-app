import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esCreador, llaveDePublicar, permite } from './permisos.ts'

// En las pruebas `VENTA` vale `false` (no está definida `__VENTA__`): todo está abierto, como en desarrollo.

test('permite: en desarrollo todo está abierto', () => {
  assert.equal(permite('ideas'), true)
  assert.equal(permite('clips'), true)
  assert.equal(permite('privadas'), true)
})

test('la llave de publicar viene de PUBLICAR o de publicar.txt', () => {
  const antes = process.env.PUBLICAR
  try {
    process.env.PUBLICAR = '  llave-de-prueba  '
    assert.equal(llaveDePublicar(), 'llave-de-prueba')
    assert.equal(esCreador(), true)
    delete process.env.PUBLICAR
    // Sin PUBLICAR queda lo que haya en %APPDATA%: en esta máquina puede o no haber archivo, así que solo
    // se comprueba que no truena y que la respuesta es consistente con esCreador.
    assert.equal(esCreador(), !!llaveDePublicar())
  } finally {
    if (antes === undefined) delete process.env.PUBLICAR
    else process.env.PUBLICAR = antes
  }
})
