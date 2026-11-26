"""
Las pistas de audio de un video dentro de la composición: el motor en vivo las oye y la línea de tiempo las
muestra por separado (música, voz, cada efecto). Cada fuente se pasa a `public/sonido/` del proyecto en WAV
de 48 kHz estéreo — el formato que Remotion y el navegador leen siempre, sea cual sea el original— con nombre
por firma del origen: si no cambió, no se rehace. De cada fuente solo queda la versión vigente.

Lo usan los `hacer.py` de los estilos cuyo render final mezcla el audio por ffmpeg (el `<Audio>` de la
plantilla es para el monitor en vivo; el video entregado no depende de la mezcla de Remotion).
"""

import hashlib
import subprocess
import wave
from pathlib import Path


def firma(*partes) -> str:
    return hashlib.sha1("|".join(str(x) for x in partes).encode()).hexdigest()[:10]


def a_public(src: Path, nombre: str, proyecto: Path) -> str:
    """`src` a `public/sonido/<nombre>-<firma>.wav` (48 kHz estéreo pcm). Devuelve la ruta relativa a public/."""
    carpeta = proyecto / "public" / "sonido"
    carpeta.mkdir(parents=True, exist_ok=True)
    h = firma(src.resolve(), src.stat().st_mtime_ns)
    salida = carpeta / f"{nombre}-{h}.wav"
    if not salida.exists():
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src),
                        "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", str(salida)], check=True)
    for viejo in carpeta.glob(f"{nombre}-*.wav"):
        if viejo != salida:
            viejo.unlink(missing_ok=True)
    return f"sonido/{salida.name}"


def duracion_wav(p: Path) -> float:
    """Los segundos de un WAV pcm (lo que deja `a_public`)."""
    try:
        with wave.open(str(p), "rb") as w:
            return w.getnframes() / w.getframerate()
    except (wave.Error, EOFError, OSError):
        return 0.0


def ganancia_musica(voz, desde: float, dur: float, fundido_in: float = 0.6,
                    fundido_out: float = 1.6) -> list[float]:
    """La ganancia de la música ventana a ventana (cada 50 ms), para el `volume` de Remotion:
    los fundidos (`fundido_in` segundos entrando, `fundido_out` saliendo) y el ducking que hace
    `sidechaincompress` en la mezcla ffmpeg, reproducido desde la envolvente real de la voz —
    mismo umbral (−46 dB), ratio 12, ataque inmediato y cola de 0,8 s. Sin voz, solo los fundidos.
    `voz` es la ruta del audio de la voz (o None) y `desde` el segundo del video donde empieza."""
    import math

    import numpy as np
    n = int(np.ceil(dur / 0.05)) + 1
    rms = np.zeros(n, dtype=np.float32)
    if voz is not None:
        r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(voz), "-ac", "1", "-ar", "16000",
                            "-f", "s16le", "-"], capture_output=True)
        pcm = np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0
        paso = 800  # 50 ms a 16 kHz
        off = max(0, int(round(desde / 0.05)))
        for i in range(max(0, n - off)):
            seg = pcm[i * paso:(i + 1) * paso]
            if seg.size:
                rms[off + i] = float(np.sqrt(np.mean(seg * seg)))
        # La envolvente del compresor lateral: ataque casi inmediato, cola de 0,8 s.
        decaimiento = math.exp(-0.05 / 0.8)
        for i in range(1, n):
            rms[i] = max(rms[i], rms[i - 1] * decaimiento)
    db = 20 * np.log10(np.maximum(rms, 1e-4))
    reduccion = np.maximum(0.0, (db - 20 * math.log10(0.005)) * (1 - 1 / 12))
    duck = np.power(10.0, -reduccion / 20)
    t = np.arange(n) * 0.05
    fundido = np.minimum(np.minimum(t / fundido_in, 1.0), np.clip((dur - t) / fundido_out, 0.0, 1.0))
    return [round(float(x), 4) for x in fundido * duck]
