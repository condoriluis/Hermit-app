"""
Subtítulos karaoke para los estilos que no tienen plantilla propia (motivacional, crimen, top). Se corre desde la
raíz del proyecto:

    python <base>/scripts/subtitulos.py <video.mp4> <salida.mp4> --voz public/voz.wav
        [--formato vertical|horizontal] [--estilo minimal|crimen|top] [--offset 0]

Toma los tiempos de la voz (`--voz`, la pista ya masterizada; si no se pasa, el audio del propio vídeo) y los pasa por
el Whisper de Hermit. Escribe los subtítulos palabra a palabra en ASS —cada palabra se pinta en el color del estilo
mientras se dice— y los quema sobre el vídeo. Deja el `.ass` al lado de la salida, por si hay que retocar.

`--offset` retrasa los subtítulos (segundos): para vídeos que abren con una tarjeta o un plano sin voz antes de que
empiece la narración. El audio del vídeo no se toca, salvo que no tenga pista y sí `--voz`: entonces la voz entra como
audio de la salida.

Los estilos (cada uno con su tipografía de `../assets/fonts`, quemada con `fontsdir`, no con la del sistema):
- `minimal` (motivacional): Bebas Neue, blanco puro, palabra activa en blanco cálido apenas más cálido.
- `centro`: el mismo minimal, pero la línea va en el centro del cuadro (Alignment 5), para talks a cámara.
- `crimen`: Courier Prime, blanco con contorno marcado y palabra activa en ámbar, como las fechas y sellos de un expediente.
- `top`: Anton, blanco grande, palabra activa en amarillo puro. El golpe de cuenta regresiva.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BASE = Path(__file__).resolve().parent
PROYECTO = Path.cwd()
sys.path.insert(0, str(BASE))
from hermit import encoder_video, transcribir  # el Python de Hermit y Whisper, y el encoder de video, de video-base

FORMATOS = {"vertical": (1080, 1920), "horizontal": (1920, 1080)}
# Palabras por línea, tipografía propia (`archivo` en assets/fonts, `fuente` es el nombre de familia ASS) y color de la
# palabra activa (ASS: &HAABBGGRR). `tam_v`/`tam_h` son la altura de la letra como fracción del ancho, por formato.
FUENTES = BASE.parent / "assets" / "fonts"
ESTILOS = {
    "minimal": {"palabras": 4, "fuente": "Bebas Neue", "archivo": "BebasNeue-Regular.ttf", "negrita": -1, "acento": "&H00E6F4FF", "tinta": "&H00FFFFFF", "espaciado": 1, "contorno": 0.10, "sombra": 0.04, "tam_v": 0.072, "tam_h": 0.044},
    # `centro` es minimal en posición: ASS Alignment 5 (medio-centro) en vez del 2 (abajo) de los demás.
    "centro": {"palabras": 4, "fuente": "Bebas Neue", "archivo": "BebasNeue-Regular.ttf", "negrita": -1, "acento": "&H00E6F4FF", "tinta": "&H00FFFFFF", "espaciado": 1, "contorno": 0.10, "sombra": 0.04, "tam_v": 0.072, "tam_h": 0.044, "alineacion": 5},
    "crimen": {"palabras": 3, "fuente": "Courier Prime", "archivo": "CourierPrime-Bold.ttf", "negrita": -1, "acento": "&H0042B0FF", "tinta": "&H00FFFFFF", "espaciado": 0, "contorno": 0.14, "sombra": 0.08, "tam_v": 0.062, "tam_h": 0.037},
    "top": {"palabras": 3, "fuente": "Anton", "archivo": "Anton-Regular.ttf", "negrita": -1, "acento": "&H0000FFFF", "tinta": "&H00FFFFFF", "espaciado": 0, "contorno": 0.12, "sombra": 0.06, "tam_v": 0.070, "tam_h": 0.042},
}


def ffmpeg(*args: str) -> None:
    # -nostdin: dentro de un ciclo de la shell, ffmpeg se come la entrada del ciclo.
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args], check=True)


def tiene_audio(video: Path) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(video)], capture_output=True, text=True)
    return bool(r.stdout.strip())


def segundos(texto: str) -> float:
    return float(texto.replace(",", "."))


def tiempo(s: float) -> str:
    cs = max(round(s * 100), 0)
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def palabras_tiempo(segmentos: list[dict], offset: float) -> list[tuple[float, float, str]]:
    """Cada palabra con su tiempo: dentro del segmento se reparte por lo largo de cada una."""
    salida = []
    for s in segmentos:
        palabras = [p for p in re.findall(r"\S+", s.get("text", "")) if p.strip()]
        if not palabras:
            continue
        peso = [len(re.sub(r"[^\wáéíóúñü]", "", p.lower())) or 1 for p in palabras]
        total = sum(peso)
        t = s["start"] + offset
        for p, w in zip(palabras, peso):
            fin = t + (s["end"] - s["start"]) * w / total
            salida.append((t, fin, p))
            t = fin
    return salida


def linea(texto: str) -> str:
    """La línea limpia para ASS: sin llaves ni barras invertidas, sin puntuación final."""
    return re.sub(r"[{}\\]", "", texto).strip(" ,;:!?¡¿")


def ass(palabras: list[tuple[float, float, str]], estilo: dict, ancho: int, alto: int) -> str:
    """Un Dialogue por grupo de palabras; dentro, `{\\k}` por palabra: el karaoke las pinta en el acento al decirlas."""
    vertical = alto > ancho
    letra = round(ancho * (estilo["tam_v"] if vertical else estilo["tam_h"]))
    margen = round(alto * (0.21 if vertical else 0.10))
    contorno = max(round(letra * estilo["contorno"]), 1)
    sombra = max(round(letra * estilo["sombra"]), 1)
    cabeza = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {ancho}\nPlayResY: {alto}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Sub,{estilo['fuente']},{letra},{estilo['tinta']},{estilo['acento']},&H00000000,&H96000000,{estilo['negrita']},0,0,0,100,100,{estilo['espaciado']},0,1,{contorno},{sombra},{estilo.get('alineacion', 2)},60,60,{margen},1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    # Agrupar en líneas de hasta `palabras` palabras, cortando también tras puntuación de cierre.
    grupos: list[list[tuple[float, float, str]]] = []
    actual: list[tuple[float, float, str]] = []
    for p in palabras:
        actual.append(p)
        if len(actual) >= estilo["palabras"] or re.search(r"[.!?…:;]$", p[2]):
            grupos.append(actual)
            actual = []
    if actual:
        grupos.append(actual)

    lineas = []
    for g in grupos:
        partes = []
        for ini, fin, texto in g:
            w = linea(texto)
            if not w:
                continue
            # \k va en centésimas de segundo; mínimo 1 para que no quede invisible.
            partes.append("{\\k" + str(max(round((fin - ini) * 100), 1)) + "}" + w.upper() + " ")
        if partes:
            lineas.append(f"Dialogue: 0,{tiempo(g[0][0])},{tiempo(g[-1][1])},Sub,,0,0,0,,{''.join(partes).rstrip()}")
    return cabeza + "\n".join(lineas) + "\n"


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        sys.exit(__doc__)
    video, salida = Path(args[0]), Path(args[1])
    formato = "vertical"
    estilo = "minimal"
    acento = None
    voz = None
    offset = 0.0
    i = 1
    while i < len(sys.argv):
        a = sys.argv[i]
        if a == "--formato":
            formato = sys.argv[i + 1]
            i += 1
        elif a == "--estilo":
            estilo = sys.argv[i + 1]
            i += 1
        elif a == "--acento":
            acento = sys.argv[i + 1]
            i += 1
        elif a == "--voz":
            voz = Path(sys.argv[i + 1])
            i += 1
        elif a == "--offset":
            offset = segundos(sys.argv[i + 1])
            i += 1
        i += 1
    if formato not in FORMATOS:
        sys.exit('--formato es "vertical" u "horizontal".')
    if estilo not in ESTILOS:
        sys.exit(f'--estilo es uno de: {", ".join(ESTILOS)}.')
    estilo_sub = dict(ESTILOS[estilo])
    if acento is not None:
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", acento):
            sys.exit('--acento es un color #RRGGBB (por ejemplo #ffe600).')
        # ASS guarda &HAABBGGRR: el #RRGGBB se da la vuelta.
        estilo_sub["acento"] = "&H00" + acento[5:7] + acento[3:5] + acento[1:3]
    if not video.is_file():
        sys.exit(f"No existe {video}.")

    ancho, alto = FORMATOS[formato]
    salida.parent.mkdir(parents=True, exist_ok=True)
    ass_path = salida.with_suffix(".ass")

    # Los tiempos salen de la voz (o del audio del vídeo si no se pasa --voz).
    if voz is not None:
        if not voz.is_file():
            sys.exit(f"No existe {voz}.")
        datos = transcribir(voz)
    elif tiene_audio(video):
        datos = transcribir(video)
    else:
        sys.exit("El vídeo no tiene audio y no se pasó --voz: no hay de dónde sacar los tiempos.")

    segmentos = datos.get("segmentos", [])
    if not segmentos:
        sys.exit("El Whisper no oyó voz: sin tiempos no hay subtítulos.")
    ass_path.write_text(ass(palabras_tiempo(segmentos, offset), estilo_sub, ancho, alto), encoding="utf-8-sig", newline="\n")

    # Desde la carpeta de salida: la ruta absoluta de `subtitles` en Windows (C:\…) rompe su sintaxis. `fontsdir` va
    # entre comillas y con los dos puntos escapados (C\:) para que el parser del filtro no lo parta.
    fuentes = "'" + FUENTES.as_posix().replace(":", "\\:") + "'"
    entradas = ["-i", video.name]
    maps = ["-map", "0:v"]
    if voz is not None and not tiene_audio(video):
        entradas += ["-i", str(voz)]
        maps += ["-map", "1:a"]
    else:
        maps += ["-map", "0:a?"]
    subprocess.run(
        ["ffmpeg", "-nostdin", "-y", "-v", "error", *entradas, *maps,
         "-vf", f"subtitles={ass_path.name}:fontsdir={fuentes}:charenc=UTF-8",
         *encoder_video(18),
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", salida.name],
        cwd=salida.parent, check=True,
    )
    print(f"Listo: {salida}")
    print(f"Subtítulos ({estilo}, {len(segmentos)} segmentos): {ass_path}")


if __name__ == "__main__":
    main()
