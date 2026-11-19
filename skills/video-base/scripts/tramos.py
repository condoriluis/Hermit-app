"""
Los tramos de un video de escenas: cada cosa de `material` con su paneo en su parte del tramo, y todos unidos
en un solo mp4 sin audio. Lo comparten los estilos de escenas con material (top, motivacional): cada uno le pasa
sus filtros extra (la tarjeta del puesto, el look cinematográfico) y aquí queda el mecánico.

    from tramos import render_tramo, unir_tramos

`render_tramo` escribe un mp4 de `dur` segundos a `salida`:
- foto: el archivo en bucle con paneo Ken Burns (zoom lento, alternando dirección con `zoom_in`)
- clip: `-stream_loop` para que nunca se quede corto; `desde` es el segundo de entrada y `velocidad` el ritmo
  (0.6 = cámara lenta). Con velocidad 1 el recorte va por `-ss`/`-t` de salida; con otra, por `trim`+`setpts`
  dentro del filtro, que es donde el tiempo se puede estirar sin perder el inicio.
`extra` son filtros ffmpeg más que se encadenan tras el paneo (drawtext, eq, vignette…), antes de `format`.
`unir_tramos` concatena los mp4 (mismo codec y parámetros) en `salida` con `-c copy`, sin recodificar.
"""

import subprocess
from pathlib import Path


def _ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args], check=True)


def render_tramo(salida: Path, ruta: Path, dur: float, es_clip: bool, desde: float, velocidad: float,
                 ancho: int, alto: int, fps: int, extra: list[str], zoom_in: bool) -> None:
    """Un tramo de `dur` s: `ruta` (foto o clip) con paneo y los `extra` del estilo, a `salida` (mp4, sin audio)."""
    escala = 2  # el doble del cuadro: el zoompan acerca sin enseñar el borde
    z = "min(zoom+0.0012,1.12)" if zoom_in else "max(1.12-0.0012*on,1.0)"
    filtros = [f"scale={ancho * escala}:{alto * escala}:force_original_aspect_ratio=increase,"
               f"crop={ancho * escala}:{alto * escala}"]
    recorte = ""
    if es_clip:
        if velocidad == 1:
            # Probado: el recorte por salida (`-ss`/`-t`) con el stream en bucle.
            recorte = "-ss"
        else:
            # La cámara lenta estira el tiempo dentro del filtro: del segundo `desde` del original salen
            # `dur × velocidad` segundos de fuente, que `setpts` convierte en `dur` de salida.
            filtros += [f"trim=start={desde:.3f}:duration={dur * velocidad:.3f}",
                        f"setpts=(PTS-STARTPTS)/{velocidad:.4f}"]
    filtros += [f"fps={fps}",
                f"zoompan=z='{z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={ancho}x{alto}:fps={fps},"
                "setsar=1", *extra, "format=yuv420p"]
    cadena = ",".join(filtros)
    comun = ["-vf", cadena, "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18",
             "-pix_fmt", "yuv420p", "-r", str(fps), str(salida)]
    if not es_clip:
        # -framerate: el loop de imagen entra a 25 fps por defecto y el tramo saldría más corto que la voz.
        _ffmpeg("-framerate", str(fps), "-loop", "1", "-t", f"{dur:.3f}", "-i", str(ruta), *comun)
    elif velocidad == 1:
        _ffmpeg("-stream_loop", "-1", "-i", str(ruta), "-ss", f"{desde:.3f}", "-t", f"{dur:.3f}", *comun)
    else:
        _ffmpeg("-stream_loop", "-1", "-i", str(ruta), "-t", f"{dur + 0.2:.3f}", *comun)


def unir_tramos(segmentos: list[Path], salida: Path) -> Path:
    """Los tramos en un solo mp4 (`-c copy`: mismo codec, sin recodificar)."""
    lista = salida.parent / "concat.txt"
    lista.write_text("".join(f"file '{s.as_posix()}'\n" for s in segmentos), encoding="utf-8")
    _ffmpeg("-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy", str(salida))
    return salida


def render_tarjeta(salida: Path, dur: float, items_texto: list, fuente: str,
                   ancho: int, alto: int, fps: int) -> None:
    """
    Una escena de solo texto: fondo negro liso con los `items_texto` (los mismos `(archivo, tamaño, color, y)`
    que dibuja el estilo sobre su material) centrados por el propio `x=(w-text_w)/2`. Mismo codec que los tramos
    para que el concat `-c copy` sirva.
    """
    vf = ",".join(
        f"drawtext=fontfile='{fuente}':textfile='{ruta_txt}':expansion=none:fontsize={tam_px}:fontcolor={color}:"
        f"borderw={max(2, round(tam_px * 0.05))}:bordercolor=black:x=(w-text_w)/2:y={y}"
        for ruta_txt, tam_px, color, y in items_texto)
    _ffmpeg("-f", "lavfi", "-i", f"color=c=black:s={ancho}x{alto}:r={fps}:d={dur:.3f}",
            "-vf", f"{vf},setsar=1,format=yuv420p" if vf else "setsar=1,format=yuv420p",
            "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-pix_fmt", "yuv420p", "-r", str(fps), "-t", f"{dur:.3f}", str(salida))


def es_clip(item: dict) -> bool:
    return "clip" in item


def desde_de(item: dict) -> float:
    return float(item.get("desde") or 0)


def velocidad_de(item: dict) -> float:
    return float(item.get("velocidad") or 1)
