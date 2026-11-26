"""
La cama de suspenso del estilo, sintetizada aquí mismo: senos, ruido y filtros, sin muestras de nadie ni
licencias que anotar. Es el dron grave del expediente — dos notas desafinadas que laten despacio, un motivo
menor espaciado como notas al margen y un pulso de fondo apenas marcado—, para ir debajo de la voz sin pelear
con ella. Corre desde la raíz del proyecto:

    python -I -B -X utf8 <skill>/scripts/musica.py public/musica.wav [segundos] [--semilla N]

Sin `segundos` toma la duración de la voz más reciente de `fuentes/voz/` (o `public/voz.wav`); sin voz, 60 s.
Escribe un WAV estéreo de 48 kHz y 16 bits, con entrada y salida suaves. `hacer.py` lo repite en bucle, lo baja
a 0,08 con fundidos y lo hunde bajo la voz con ducking — aquí solo se escribe la cama.

Con la misma semilla y el mismo largo sale igual. Necesita numpy y scipy.
"""

import json
import subprocess
import sys
import wave
from pathlib import Path

SR = 48000


def _duracion_wav(ruta: Path) -> float | None:
    """La duración de un WAV por su cabecera, sin ffprobe (el proyecto puede no tener el PATH de Hermit)."""
    try:
        with wave.open(str(ruta), "rb") as w:
            return w.getnframes() / w.getframerate()
    except Exception:
        return None


def _voz_del_proyecto() -> Path | None:
    candidatos = []
    carpeta = Path("fuentes") / "voz"
    if carpeta.is_dir():
        candidatos += [p for p in carpeta.glob("*.wav") if p.is_file()]
    for p in (Path("public") / "voz.wav", Path("voz.wav")):
        if p.exists():
            candidatos.append(p)
    if not candidatos:
        return None
    return max(candidatos, key=lambda p: p.stat().st_mtime)


def sintetizar(duracion: float, salida: Path, semilla: int = 7) -> None:
    """Escribe en `salida` la cama de `duracion` segundos (ver el encabezado)."""
    import numpy as np
    from scipy.io import wavfile
    from scipy.signal import butter, sosfilt

    n = int(round(duracion * SR))
    rng = np.random.default_rng(semilla)
    t = np.arange(n) / SR

    def paso(x, fc, orden=2):
        return sosfilt(butter(orden, fc, btype="low", fs=SR, output="sos"), x)

    def nota(midi: float) -> float:
        return 440.0 * 2 ** ((midi - 69) / 12)

    # 1) El dron: La1 + La1# desafinadas (batido lento de ~0,4 Hz) + subgrave, con una respiración de 4 s.
    dron = np.zeros(n)
    for f, amp in [(55.0, 0.30), (55.4, 0.22), (27.5, 0.35), (110.0, 0.10)]:
        fase = rng.uniform(0, 2 * np.pi)
        dron += amp * np.sin(2 * np.pi * f * t + fase)
    dron *= 0.75 + 0.25 * np.sin(2 * np.pi * t / 4.0)
    dron = paso(dron, 400)

    # 2) El motivo: notas menores espaciadas (A2–E3–C4–G3…) con decaimiento de piano apagado, quinta grave
    # debajo. Pocas y separadas: rellenan las pausas, nunca la narración.
    motivo = np.zeros(n)
    patron = [(0.0, 45), (4.0, 52), (8.0, 48), (13.0, 43), (17.5, 50), (23.0, 45),
              (28.0, 48), (34.0, 40), (39.0, 47), (45.0, 45), (51.0, 43), (56.0, 45),
              (62.0, 45), (68.0, 43), (74.0, 45), (80.0, 40), (86.0, 45), (92.0, 43)]
    dur_nota = 4.5
    nn = int(dur_nota * SR)
    tt = np.arange(nn) / SR
    for ini, m in patron:
        if ini >= duracion - 1:
            break
        f = nota(m)
        env = np.exp(-tt * 1.1) * np.minimum(1.0, tt * 30)
        tono = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2 * tt)
                + 0.15 * np.sin(2 * np.pi * f * 3 * tt))
        i0 = int(ini * SR)
        if i0 >= n:
            break
        hasta = min(nn, n - i0)
        env_n = env[:hasta]
        motivo[i0:i0 + hasta] += 0.16 * env_n * tono[:hasta]
        f2 = nota(m - 12)
        motivo[i0:i0 + hasta] += 0.08 * env_n * np.sin(2 * np.pi * f2 * tt[:hasta])

    # 3) El pulso: un golpe grave cada 2 s, apenas marcado — el corazón lento del expediente.
    pulso = np.zeros(n)
    nn_p = int(0.5 * SR)
    tt_p = np.arange(nn_p) / SR
    golpe = np.sin(2 * np.pi * 60 * tt_p) * np.exp(-tt_p * 7)
    for ini in np.arange(0, duracion, 2.0):
        i0 = int(ini * SR)
        if i0 + nn_p <= n:
            pulso[i0:i0 + nn_p] += golpe
    pulso = paso(pulso, 120) * 0.5

    # 4) Polvo de cinta: chasquidos aislados y muy bajos, como la vejez del archivo.
    polvo = np.zeros(n)
    snaps = rng.random(int(duracion * 0.9)) < 0.02
    idx = np.flatnonzero(snaps)
    for i in idx:
        i0 = int(i * SR)
        nn_c = int(0.004 * SR)
        if i0 + nn_c <= n:
            polvo[i0:i0 + nn_c] += rng.normal(0, 0.06, nn_c)

    mezcla = dron * 0.5 + motivo * 0.9 + pulso + polvo * 0.4
    mezcla = paso(mezcla, 6000)

    # Fundidos de entrada y salida, y un techo suave.
    fund = np.minimum(1.0, np.minimum(t / 3.0, (duracion - t) / 4.0))
    mezcla = np.tanh(mezcla * fund * 1.4) * 0.8

    salida.parent.mkdir(parents=True, exist_ok=True)
    estereo = np.stack([mezcla, mezcla], axis=1)
    wavfile.write(str(salida), SR, (estereo * 32767).astype(np.int16))


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    semilla = 7
    if "--semilla" in sys.argv:
        i = sys.argv.index("--semilla")
        semilla = int(sys.argv[i + 1])
        del sys.argv[i:i + 2]
        args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    salida = Path(args[0])
    if len(args) > 1:
        duracion = float(args[1])
    else:
        voz = _voz_del_proyecto()
        duracion = (_duracion_wav(voz) if voz else None) or 60.0
    sintetizar(duracion, salida, semilla)
    print(f"cama de suspenso: {salida} ({duracion:.1f} s, semilla {semilla})")


if __name__ == "__main__":
    main()
