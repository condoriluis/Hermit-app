#!/usr/bin/env python3
"""synth-sfx.py — el kit de sonido de «Video con tu material», sintetizado. Sin muestras.

    python -I -B -X utf8 <skill>/scripts/synth-sfx.py   ->  sfx/*.wav

Reemplaza a samples: todo es síntesis determinista con los helpers de
`synth-sfx.py` del documental (mismo mecanismo que `synth-golpe.py` del top), así que es
royalty-free y bit-idéntico en cada corrida.

La identidad del recap familiar no es la del documental: nada de impactos secos ni
drones oscuros. Son sonidos *cálidos y domésticos* — el barrido suave de un paneo, el
top de una polaroid al caer, y un cierre de caja de música que dice «fin» sin gritar.

Los cuatro archivos (48 kHz estéreo 16-bit, pico −1 dBFS como el resto de kits):

- `deslize_1.wav` / `deslize_2.wav` (~450 ms): el whoosh del empuje de escena. Ruido en
  tres bandas escalonadas (grave→medio→agudo) para que se *sienta* el barrido, con
  ataque suave y cola corta. La variante 2 es un poco más oscura y corta: alternar evita
  que el oído reconozca el mismo sample en cada corte.
- `pop_1.wav` (~200 ms): el pop del collage — un cuerpo grave corto (180→90 Hz) con un
  transitorio diminuto, como una foto que aterriza en la mesa.
- `cierre_1.wav` (~1,1 s): el cierre cálido — tres notas de kalimba (do5, mi5, sol5) muy
  juntas y un soplo de aire grave debajo; dice «terminó» con sonrisa, no con golpe.
"""
import importlib.util
import os
import sys

import numpy as np

_sfx_py = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..', 'video-documental', 'scripts', 'synth-sfx.py'))
_spec = importlib.util.spec_from_file_location('synth_sfx', _sfx_py)
S = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(S)  # noqa: E402  (SR, N, rng, osc, glide, burst, eq, env_db, fade, stereo, norm, sat, write…)

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sfx'))


def deslize(seed: int, oscuro: bool):
    """Whoosh de paneo: tres soplos de ruido en bandas que suben, fundidos suaves."""
    ms = 460 if not oscuro else 400
    n = S.N(ms)
    r = S.rng(seed)
    partes = [
        (0,   280, 1100),
        (70,  700, 2600),
        (150, 1600, 4200 if not oscuro else 3200),
    ]
    x = np.zeros(n)
    for at, lo, hi in partes:
        b = S.burst(n, at, r, core=28.0, tail=60.0, tail_db=-14, attack=18.0)
        b = S.eq(b, hp=lo, lp=hi, order=2)
        x += b
    # El barrido se siente más si el agudo entra después y se va primero.
    t = np.arange(n) / S.SR * 1000
    env = 10 ** (np.interp(t, [0, 55, 220, ms], [-60, -5, -8, -60]) / 20)
    x *= env
    x = S.eq(x, hp=180, lp=7500 if not oscuro else 6000, order=2)
    side = S.burst(n, 3, S.rng(seed + 1), core=30.0, tail=55.0, tail_db=-20, attack=20.0)
    side = S.eq(side, hp=500, lp=5000)
    side *= env * 0.5
    return S.norm(S.stereo(S.sat(x, 1.05), side, 0.35))


def pop():
    """El top de la polaroid: cuerpo grave corto con barrido descendente + click mínimo."""
    n = S.N(210)
    r = S.rng(20261125)
    t = np.arange(n) / S.SR * 1000
    f = S.glide(n, [(0, 190), (60, 96), (210, 70)])
    cuerpo = S.osc(n, f, 'sine') * np.exp(-t / 38.0)
    aire = S.burst(n, 0, r, core=1.2, tail=5.0, tail_db=-26, attack=0.3) * np.exp(-t / 45.0) * 0.5
    x = cuerpo + aire
    x = S.eq(x, hp=60, lp=4000)
    x *= np.where(t < 8, t / 8, 1.0) * np.exp(-np.maximum(0, t - 8) / 60.0)
    side = S.burst(n, 1, S.rng(99), core=2.0, tail=8.0, tail_db=-34, attack=0.2) * 0.15
    return S.norm(S.stereo(x, side, 0.3))


def cierre():
    """Kalimba suave: tres notas casi juntas, decaimiento cálido, soplo grave debajo."""
    n = S.N(1150)
    notas = [(0.0, 523.25), (70, 659.25), (150, 783.99)]   # do5, mi5, sol5 — acordes mayor, sonriente
    x = np.zeros(n)
    t = np.arange(n) / S.SR
    for at_ms, hz in notas:
        a = S.N(at_ms)
        m = n - a
        tt = np.arange(m) / S.SR
        env = np.minimum(1, tt / 0.008) * np.exp(-tt / 0.55)
        tono = (np.sin(2 * np.pi * hz * tt)
                + 0.35 * np.sin(2 * np.pi * hz * 2 * tt) * np.exp(-tt / 0.3)
                + 0.12 * np.sin(2 * np.pi * hz * 3 * tt) * np.exp(-tt / 0.18))
        x[a:] += tono * env * 0.34
    # Soplido grave: la "exhalación" que redondea el cierre.
    soplo = S.burst(n, 0, S.rng(31), core=220.0, tail=500.0, tail_db=-18, attack=120.0)
    soplo = S.eq(soplo, hp=90, lp=900)
    soplo *= np.minimum(1, np.arange(n) / S.SR / 0.25) * np.exp(-np.arange(n) / S.SR / 0.5)
    x += soplo * 0.5
    side = S.burst(n, 5, S.rng(32), core=300.0, tail=600.0, tail_db=-26, attack=150.0)
    side = S.eq(side, hp=200, lp=2400) * 0.4
    return S.norm(S.stereo(x, side, 0.3))


def main():
    S.write(os.path.join(OUT, 'deslize_1.wav'), deslize(20261125, False))
    S.write(os.path.join(OUT, 'deslize_2.wav'), deslize(20261126, True))
    S.write(os.path.join(OUT, 'pop_1.wav'), pop())
    S.write(os.path.join(OUT, 'cierre_1.wav'), cierre())
    print('kit propio listo en', OUT)


if __name__ == '__main__':
    sys.exit(main())
