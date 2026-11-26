#!/usr/bin/env python3
"""synth-golpe.py — el golpe seco de la cuenta regresiva del top, sintetizado. Sin muestras.

    python3 scripts/synth-golpe.py   ->  assets/sfx/golpe.wav

Reemplaza al sample que había (una voz diciendo «Yeah», filtrada por Whisper el
23-nov-2026): ahora es un impacto seco sintetizado con los helpers de
`synth-sfx.py` del documental — royalty-free y bit-idéntico en cada corrida.

Diseño (~0,3 s, 48 kHz estéreo 16-bit, pico -1 dBFS como el kit EV1):
- transitorio: click de ruido de ~3 ms al inicio,
- cuerpo: tono fijo de 95 Hz con decaimiento de ~110 ms y un parcial de 190 Hz
  más corto — pegada grave y seca, sin barrido de tono (un glide largo sonaba
  a vocal, «mm-hmm», en la primera versión),
- cola: ráfaga de ruido oscura que se apaga en ~120 ms,
- saturación suave y estéreo con una señal lateral decorrelacionada.
"""
import importlib.util
import os
import sys
import wave

import numpy as np

_sfx_py = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..', 'video-documental', 'scripts', 'synth-sfx.py'))
_spec = importlib.util.spec_from_file_location('synth_sfx', _sfx_py)
S = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(S)  # noqa: E402  (SR, N, rng, osc, glide, burst, fade, stereo, norm, sat, write…)

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sfx', 'golpe.wav'))
MS = 300


def golpe():
    n = S.N(MS)
    r = S.rng(20261123)
    t = np.arange(n) / S.SR

    # Cuerpo: tono grave muy corto — menos de 80 ms de cuerpo tonal para que no
    # se lea como vocal; la pegada la da el transitorio y la estocada grave.
    cuerpo = S.osc(n, 105.0, 'sine') * np.exp(-t / 0.055)
    parcial = S.osc(n, 210.0, 'sine') * np.exp(-t / 0.03) * 0.3

    # Transitorio: ruido muy corto y brillante al inicio.
    click = S.burst(n, 0, r, core=0.55, tail=1.6, tail_db=-32, attack=0.04) * 1.0

    # Cola oscura: ruido grave que se apaga rápido (la «pegada» del seco).
    cola = S.burst(n, 2, r, core=7.0, tail=28.0, tail_db=-36, attack=0.25)
    k = S.N(4)
    cola = np.convolve(cola, np.ones(k) / k, 'same') * 0.4

    x = cuerpo + parcial + click + cola
    x = S.sat(x, 1.5)
    x = S.fade(x, 0.0, 25.0)
    # Estéreo: mono + lateral decorrelacionada baja (pegada centrada, algo de aire).
    side = S.burst(n, 1, S.rng(7), core=2.0, tail=7.0, tail_db=-38, attack=0.1) * 0.12
    return S.norm(S.stereo(x, side, 0.5))


if __name__ == '__main__':
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    S.write(OUT, golpe())
    print('wrote', OUT)
