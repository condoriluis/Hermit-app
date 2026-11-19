"""
La hoja de un video del usuario para elegir sus momentos:

    python -I -B -X utf8 <skill>/scripts/marcos.py <video> <salida.jpg> [--cada 2.0] [--max 12]

Saca hasta `--max` fotogramas repartidos en la duración (uno cada `--cada` segundos) en una sola imagen de 4
columnas, y dice la duración, el tamaño, los fps, si tiene audio y a qué segundo corresponde cada cuadro. Con eso se
escriben los `desde`/`hasta` de plan.json sin adivinar.
"""

import json
import math
import subprocess
import sys
from pathlib import Path


def ffprobe(video: Path) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(video)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        sys.exit(f"marcos: ffprobe no pudo leer {video}:\n{r.stderr.strip()}")
    return json.loads(r.stdout)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opciones = sys.argv[1:]
    def opt(nombre, defecto):
        return float(opciones[opciones.index(nombre) + 1]) if nombre in opciones else defecto
    if len(args) != 2:
        sys.exit(__doc__)
    video, salida = Path(args[0]), Path(args[1])
    cada, maximo = opt("--cada", 2.0), int(opt("--max", 12))
    info = ffprobe(video)
    dur = float(info["format"].get("duration") or 0)
    v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
    hay_audio = any(s.get("codec_type") == "audio" for s in info.get("streams", []))
    if not dur:
        sys.exit(f"marcos: {video} no trae duración")
    n = max(1, min(maximo, math.ceil(dur / cada)))
    # Los cuadros se reparten parejos en toda la duración, no solo el primer tramo.
    paso = dur / n
    cols, rows = 4, math.ceil(n / 4)
    salida.parent.mkdir(parents=True, exist_ok=True)
    vf = f"fps={n}/{dur:.3f},scale=360:-2,tile={cols}x{rows}"
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(video), "-vf", vf, "-frames:v", "1", str(salida)], check=True)
    print(f"{video.name}: {dur:.1f} s · {v.get('width', '?')}x{v.get('height', '?')} · {eval(v.get('avg_frame_rate', '0/1')):.0f} fps"
          f" · {'con audio' if hay_audio else 'sin audio'} · {n} cuadros en {salida}")
    for i in range(n):
        print(f"  cuadro {i + 1}: ~{i * paso + paso / 2:.1f} s")


if __name__ == "__main__":
    main()
