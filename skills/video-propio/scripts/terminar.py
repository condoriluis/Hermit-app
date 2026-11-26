"""
El video terminado: render de Remotion con su sonido (la música, la voz y los efectos van dentro de la
composición, como pistas), el masterizado para redes y la comprobación. No publica nada.

    python -I -B -X utf8 <skill>/scripts/terminar.py <video> [--borrador]

1. Renderiza en out/_render.mp4, en H.264 yuv420p y bt709, con el audio de la composición (render.cjs de
   video-base). Si el video no lleva sonido (plan con musica:false, sfx:false y sin voz), el render sale
   mudo y se le añade una pista de silencio para que el archivo tenga audio como todo video de redes.
2. Masteriza el audio del render a −14 LUFS (masterizar.mjs de video-base), con el pico bajo −2 dBTP: el
   AAC sube los clics hasta un decibelio y el archivo tiene que quedar bajo −1.
3. Los junta en out/final.mp4 (AAC 48 kHz, faststart) y lo comprueba (comprobar.mjs: tamaño, 30 fps,
   duración, sonido). Los negros se aceptan: las tarjetas y los fundidos lo son a propósito.

--borrador: a la mitad de tamaño y sin masterizar, en out/borrador.mp4, para verlo entero rápido.
--sin-portada: no vuelve a estampar portada.png en el video (hacer.py lo usa al relanzar: la portada vieja no va
   en el video nuevo; la nueva la genera el agente después y la estampa con portada.mjs).
"""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
BASE = Path(os.environ.get("HERMIT_SKILLS") or SKILL.parent) / "video-base" / "scripts"
sys.path.insert(0, str(BASE))
from espacio import comprobar_disco  # noqa: E402


def correr(cmd, cwd, fatal=True):
    r = subprocess.run(cmd, cwd=cwd)
    if r.returncode and fatal:
        sys.exit(f"terminar: falló {' '.join(map(str, cmd))}")
    return r.returncode


def correr_con_progreso(cmd, cwd):
    """Corre el render dejando pasar su salida y escribiendo el % en out/_render.progreso: el estudio de
    Hermit lo lee para llenar el borde del monitor en vivo. Se borra al acabar, salga bien o mal."""
    progreso = Path(cwd) / "out" / "_render.progreso"
    p = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, encoding="utf-8", errors="replace")
    try:
        assert p.stdout is not None
        for linea in p.stdout:
            print(linea, end="", flush=True)
            m = re.search(r"(\d{1,3}) %", linea)
            if m:
                progreso.write_text(m.group(1), encoding="utf-8")
        return p.wait()
    finally:
        progreso.unlink(missing_ok=True)


def poner(tmp: Path, salida: Path) -> None:
    """Si el estudio de Hermit está enseñando la salida, Windows no deja reemplazarla: se reintenta y, si no, se aparta."""
    for _ in range(20):
        try:
            return os.replace(tmp, salida)
        except PermissionError:
            time.sleep(0.5)
    apartado = salida.with_name(f"_viejo-{int(time.time())}-{salida.name}")
    os.replace(salida, apartado)
    os.replace(tmp, salida)


def tiene_audio(render: Path) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
                        "stream=codec_type", "-of", "csv=p=0", str(render)],
                       capture_output=True, text=True)
    return "audio" in r.stdout


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    borrador = "--borrador" in sys.argv
    sin_portada = "--sin-portada" in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    v = Path(args[0]).resolve()
    if not (v / "src" / "montaje.json").exists():
        sys.exit(f"terminar: {v} no tiene src/montaje.json: corre hacer.py primero")
    datos = json.loads((v / "src" / "montaje.json").read_text(encoding="utf-8"))
    out = v / "out"
    out.mkdir(exist_ok=True)
    render = out / ("_borrador.mp4" if borrador else "_render.mp4")
    comprobar_disco(v)  # barre los temporales de renders cortados y para si no cabe otro
    # Dos tercios de los núcleos dibujando: con la mitad sobraba máquina; con todos, se pisan.
    codigo = correr_con_progreso(["node", str(BASE / "render.cjs"), str(render), "--id=Montaje", "--crf=18",
                                 "--x264-preset=veryfast", "--pixel-format=yuv420p", "--color-space=bt709",
                                 "--concurrency=66%", *( ["--scale=0.5"] if borrador else [] )], v)
    if codigo:
        sys.exit(f"terminar: falló el render (código {codigo})")
    if borrador:
        # El render ya trae el sonido de la composición: a tamaño borrador, sin masterizar.
        poner(render, out / "borrador.mp4")
        print(f"terminar: {out / 'borrador.mp4'}")
        return
    final = out / "final.mp4"
    tmp = out / f"_{final.name}"
    master = out / "_master.wav"
    dur = datos["duracion"] / datos["fps"]
    if tiene_audio(render):
        # El master sale del audio del propio render (mezcla de la composición); el pico, medido ya en
        # AAC, pide −2 casi siempre y baja a −3 o −4 si los clics lo exigen.
        for pico in ("-2", "-3", "-4"):
            correr(["node", str(BASE / "masterizar.mjs"), str(render), str(master), "--pico", pico], v)
            correr(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(render), "-i", str(master),
                    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                    "-ar", "48000", "-movflags", "+faststart", str(tmp)], v)
            mal = correr(["node", str(BASE / "comprobar.mjs"), str(tmp), "--duracion", f"{dur:.3f}", "--fps", "30",
                          "--tamano", f"{datos['ancho']}x{datos['alto']}", "--lufs", "-14", "--pico", "-1", "--negro-ok"], v, fatal=pico == "-4")
            if not mal:
                break
    else:
        # Sin sonido a propósito (musica:false, sfx:false y sin voz): pista muda para que el archivo
        # tenga audio como todo video de redes; la comprobación la acepta con --silencio-ok.
        correr(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(render), "-f", "lavfi", "-t", f"{dur:.3f}",
                "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart", str(tmp)], v)
        correr(["node", str(BASE / "comprobar.mjs"), str(tmp), "--duracion", f"{dur:.3f}", "--fps", "30",
                "--tamano", f"{datos['ancho']}x{datos['alto']}", "--silencio-ok"], v)
    poner(tmp, final)
    render.unlink(missing_ok=True)
    master.unlink(missing_ok=True)
    # En vertical, la portada de video-base (PORTADA.md) de primer fotograma: un render nuevo no la pierde.
    if not sin_portada and datos["alto"] > datos["ancho"] and (v / "portada.png").exists():
        correr(["node", str(BASE / "portada.mjs"), str(final), str(v / "portada.png")], v)
    print(f"terminar: {final}")


if __name__ == "__main__":
    main()
