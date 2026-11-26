#!/usr/bin/env python3
"""batidos.py — los tiempos de los golpes de la música, para que los cortes caigan en ellos.

    python -I -B -X utf8 <skill>/scripts/batidos.py <musica> <segundos> <salida.json>

Escribe `{"batidos": [t0, t1, …], "bpm": 92.0}` con los tiempos en segundos, o `{"batidos": []}`
si la música no tiene un pulso claro (una cama ambiental sin ritmo no obliga a cortar a ritmo:
se devuelve vacío y el montaje queda como siempre).

Cómo: decodifica el audio a mono 22 kHz con ffmpeg (en bucle si la canción es más corta que el
video), calcula el flujo espectral cuadro a cuadro con numpy, estima el tempo por
autocorrelación en el rango 60–200 BPM y elige la fase (offset) que mejor cae sobre los golpes.
Si la autocorrelación no destaca sobre el ruido de la propia envolvente, no hay batido confiable.

Necesita numpy y ffmpeg; cualquier fallo devuelve la lista vacía — el video sale igual que antes.
"""
import json
import subprocess
import sys

import numpy as np

SR = 22050
N = 2048          # ventana del análisis (~93 ms)
HOP = 512         # salto (~23 ms por muestra de envolvente)
RANGO_BPM = (60.0, 200.0)
# La autocorrelación normalada (pico / energía total) tiene que destacar: en música con pulso
# queda sobre 0,5 y en ruido blanco ~0,06 — la media de la envolvente no sirve de referencia
# porque la autocorrelación oscila en negativo y el cociente salía negativo siempre.
CONFIANZA_MIN = 0.30


def decodificar(musica: str, dur: float) -> np.ndarray:
    """La música a mono f32le a SR, en bucle si hace falta, del largo del video (+1 s de cola)."""
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-stream_loop", "-1", "-i", musica,
           "-t", f"{dur + 1:.2f}", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode or not r.stdout:
        return np.zeros(0, dtype=np.float32)
    return np.frombuffer(r.stdout, dtype="<f4").astype(np.float64)


def envolvente(x: np.ndarray) -> np.ndarray:
    """Flujo espectral: cuánto sube la energía por bandas en cada salto — el pulso del ritmo."""
    if len(x) < N + HOP:
        return np.zeros(0)
    ventanas = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP]
    ventanas = ventanas * np.hanning(N)
    mag = np.abs(np.fft.rfft(ventanas, axis=1))
    logm = np.log(mag + 1e-8)
    flujo = np.maximum(0.0, np.diff(logm, axis=0)).sum(axis=1)
    if flujo.max() <= 0:
        return np.zeros(0)
    return flujo / flujo.max()


def batidos(flux: np.ndarray, dur: float) -> tuple[list[float], float]:
    """Tempo por autocorrelación + fase por máxima energía en la retícula → tiempos en segundos."""
    fps_env = SR / HOP
    e = flux - flux.mean()
    ac = np.correlate(e, e, "full")[len(e) - 1:]
    if len(ac) < 4 or ac[0] <= 0:
        return [], 0.0
    lo = int(round(fps_env * 60 / RANGO_BPM[1]))
    hi = int(round(fps_env * 60 / RANGO_BPM[0]))
    hi = min(hi, len(ac) - 1)
    if hi <= lo:
        return [], 0.0
    tramo = ac[lo:hi + 1]
    lag = lo + int(np.argmax(tramo))
    # Confianza: el pico del tempo normalizado por la energía total (ac[0]) — si no destaca,
    # no hay pulso (una cama sin ritmo ni siquiera llega a 0,1; el ruido blanco ~0,06).
    if ac[lag] / (ac[0] + 1e-12) < CONFIANZA_MIN:
        return [], 0.0
    bpm = fps_env * 60 / lag
    # La fase: el offset dentro del período que junta más golpes.
    mejor, mejor_suma = 0, -1.0
    for o in range(lag):
        s = flux[o::lag].sum()
        if s > mejor_suma:
            mejor, mejor_suma = o, s
    periodo = lag / fps_env
    tiempos = []
    t = mejor / fps_env
    while t <= dur:
        tiempos.append(round(t, 3))
        t += periodo
    return tiempos, round(bpm, 1)


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    musica, dur_txt, salida = sys.argv[1], sys.argv[2], sys.argv[3]
    dur = float(dur_txt)
    salida_json = {"batidos": [], "bpm": 0.0}
    try:
        x = decodificar(musica, dur)
        flux = envolvente(x)
        if len(flux):
            tiempos, bpm = batidos(flux, dur)
            salida_json = {"batidos": tiempos, "bpm": bpm}
    except Exception:
        pass  # sin ritmo confiable o sin audio: el montaje queda como siempre
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(salida_json, f)


if __name__ == "__main__":
    main()
