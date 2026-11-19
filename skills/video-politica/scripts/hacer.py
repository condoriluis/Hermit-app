"""
El video entero en un comando, de fondo: de guion.md y montaje.json (lo único que escribe el agente) a
out/politica-<nombre>.mp4 con su portada y revision/hoja.png para mirarlo.

    python -B <skill>/scripts/hacer.py --revisa     solo revisa montaje.json contra guion.md (un segundo)
    python -B <skill>/scripts/hacer.py              la voz y el video, de corrido
    python -B <skill>/scripts/hacer.py --formato horizontal --nombre <n>

Desde la raíz del proyecto (o con `--en <carpeta>`, la ruta de `Carpeta:`).

`montaje.json` declara las escenas en orden, cada una anclada a las palabras del guion donde entra:

    {"formato": "vertical",
     "escenas": [{"palabra": "de queens a la casa blanca", "imagen": "fuentes/material/01-queens.jpg",
                  "titular": "DE QUEENS A LA CASA BLANCA"}, …]}

La primera imagen entra con el primer segundo; cada siguiente entra cuando se dice su `palabra` y se queda
hasta la siguiente. `titular` es el banner superior de alerta (opcional). `palabra`/`vez` como en
momentos.json: una a tres palabras seguidas del guion.

En orden, y para en el primer ✗ diciendo qué arreglar:
1. Revisa montaje.json contra guion.md y que cada `imagen` exista, en un segundo y sin voz.
2. La voz en public/voz.wav (o voz.wav), la transcripción Whisper (se repite solo si la voz cambió) y el
   anclaje de cada escena a lo que la voz dijo de verdad.
3. El visual: cada imagen con su paneo Ken Burns durante su tramo, los subtítulos dinámicos en Archivo Black
   (amarillo para cifras y dinero, rojo para palabras de alarma) y los titulares, la música a bajo volumen,
   la masterización a -14 LUFS y el mp4 con su portada y su hoja de cuadros.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
SKILL = Path(__file__).resolve().parent.parent
BASE = SKILL.parent / "video-base" / "scripts"
sys.path.insert(0, str(BASE))
from hermit import duracion, encoder_video, transcribir  # noqa: E402
from momentos import Reloj, anclar, errores_mojibake, hoja, palabras_de, roto  # noqa: E402

# `--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit: el proyecto no depende del directorio donde se
# corra; sin ella, el directorio actual.
_args = sys.argv[1:]
_en = _args[_args.index("--en") + 1] if "--en" in _args[:-1] else ""
PROYECTO = Path(_en).resolve() if _en else Path.cwd()
# La carpeta de las skills no es un proyecto: el video no lo vería nadie.
if PROYECTO == SKILL.parent or SKILL.parent in PROYECTO.parents:
    sys.exit(f"{PROYECTO} es la carpeta de las skills: pasa la ruta completa de la línea `Carpeta:`.")
FORMATOS = {"vertical": (1080, 1920), "horizontal": (1920, 1080)}
FPS = 30
PALABRAS_POR_BLOQUE = 3

# Palabras de impacto para colorear automáticamente
PATRON_NUMEROS = re.compile(r"\d+[\d.,]*|\$|€|%|millon|millones|mil|dolar|dolares|pesos|euros|bitcoin", re.I)
PATRON_ALARMA = re.compile(r"escandalo|crisis|quiebra|despido|renuncia|traicion|culpable|fraude|corrupcion|deuda|alerta|urgente|peligro|secreto|estafa|conflicto", re.I)


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args], check=True)


def seg_a_ass(s: float) -> str:
    cs = round(s * 100)
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ass_texto(t: str) -> str:
    """Un texto para el ASS: sin llaves (abrirían un bloque de códigos) ni saltos de línea."""
    return " ".join(str(t).replace("{", "(").replace("}", ")").split())


def color_palabra(palabra: str) -> str:
    limpia = re.sub(r"[^\w$%]", "", palabra.lower())
    if PATRON_ALARMA.search(limpia):
        # Rojo vibrante en ASS BGR: &H003333FF&
        return "{\\c&H003333FF&}" + palabra + "{\\c&H00FFFFFF&}"
    if PATRON_NUMEROS.search(limpia):
        # Amarillo fluorescente en ASS BGR: &H0000FFFF&
        return "{\\c&H0000FFFF&}" + palabra + "{\\c&H00FFFFFF&}"
    return palabra


def generar_subtitulos_ass(segmentos: list[dict], escenas: list[dict], ancho: int, alto: int, salida: Path) -> None:
    """Subtítulos dinámicos palabra por palabra con colores de choque, más el titular de cada escena arriba."""
    vertical = alto > ancho
    # Archivo Black es más ancha que Arial Black: un punto menos de tamaño para que quepan las mismas palabras.
    letra = round(ancho * 0.066) if vertical else round(alto * 0.078)
    margen_v = round(alto * 0.25) if vertical else round(alto * 0.10)

    cabeza = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {ancho}\n"
        f"PlayResY: {alto}\n"
        "WrapStyle: 0\n"
        "ScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Politica,Archivo Black,{letra},&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,{round(letra * 0.14)},{round(letra * 0.08)},2,50,50,{margen_v},1\n"
        f"Style: Titular,Archivo Black,{round(letra * 0.52)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,{round(letra * 0.07)},{round(letra * 0.04)},8,50,50,{round(alto * 0.045)},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    eventos = []
    for e in escenas:
        if e.get("titular") and e["t1"] > e["t0"]:
            eventos.append(f"Dialogue: 0,{seg_a_ass(e['t0'])},{seg_a_ass(e['t1'])},Titular,,0,0,0,,{ass_texto(e['titular'])}")
    for s in segmentos:
        palabras = s.get("text", "").split()
        if not palabras:
            continue
        bloques = [palabras[i : i + PALABRAS_POR_BLOQUE] for i in range(0, len(palabras), PALABRAS_POR_BLOQUE)]
        largo_total = sum(len(" ".join(b)) for b in bloques) or 1
        t_actual = s["start"]
        dur_segmento = max(s["end"] - s["start"], 0.3)

        for b in bloques:
            dur_bloque = dur_segmento * (len(" ".join(b)) / largo_total)
            t_fin = t_actual + dur_bloque
            palabras_coloreadas = [color_palabra(p.upper()) for p in b]
            texto_linea = " ".join(palabras_coloreadas)
            eventos.append(f"Dialogue: 0,{seg_a_ass(t_actual)},{seg_a_ass(t_fin)},Politica,,0,0,0,,{texto_linea}")
            t_actual = t_fin

    salida.write_text(cabeza + "\n".join(eventos) + "\n", encoding="utf-8-sig")


def texto_guion() -> str:
    """Lo que se dice: guion.md sin títulos ni las líneas en negrita, que son textos en pantalla, no narración."""
    lineas = []
    for l in (PROYECTO / "guion.md").read_text(encoding="utf-8-sig").splitlines():
        s = l.strip()
        if not s or s.startswith("#") or s.startswith("**") or s.lower().startswith("corte de datos"):
            continue
        lineas.append(s)
    return " ".join(lineas)


def leer_montaje() -> tuple[dict, list[str]]:
    """montaje.json de la raíz; devuelve (datos, errores de forma)."""
    archivo = PROYECTO / "montaje.json"
    if not archivo.exists():
        return {}, ["falta montaje.json en la raíz del proyecto"]
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        return {}, [f"montaje.json no es JSON: {e}"]
    if not isinstance(datos, dict):
        return {}, ["montaje.json no es un objeto: lleva `formato` y `escenas`"]
    errores = errores_mojibake(datos)
    formato = datos.get("formato", "vertical")
    if formato not in FORMATOS:
        errores.append(f'formato «{formato}»: va "vertical" u "horizontal"')
    escenas = datos.get("escenas")
    if not isinstance(escenas, list) or not escenas:
        errores.append("no tiene escenas: una lista `escenas`, cada una con `palabra` e `imagen`")
        escenas = []
    for k, e in enumerate(escenas):
        que = f"escena {k + 1}"
        if not isinstance(e, dict):
            errores.append(f"{que}: no es un objeto")
            continue
        if not str(e.get("palabra", "")).strip():
            errores.append(f"{que}: falta `palabra`, las palabras del guion donde entra")
        if not str(e.get("imagen", "")).strip():
            errores.append(f"{que}: falta `imagen`, el archivo que se ve (por ejemplo fuentes/material/01.jpg)")
        elif not (PROYECTO / str(e["imagen"])).is_file():
            errores.append(f"{que}: no está el archivo {e['imagen']} (relativo a la raíz del proyecto)")
        t = e.get("titular")
        if t is not None and (not isinstance(t, str) or len(t) > 90):
            errores.append(f"{que}: `titular` es un texto de hasta 90 caracteres o se quita")
    return datos, errores


def tiempos_de_escenas(escenas: list[dict], segmentos: list[dict], total: float) -> list[dict]:
    """
    El segundo en que entra cada escena, según lo que la voz dijo de verdad: las palabras de la transcripción
    reparten el tiempo de su segmento (lo mismo que hacen los subtítulos), y `anclar` ubica cada `palabra`.
    La primera escena entra en 0; cada siguiente, en la palabra que la voz dijo.
    """
    dichas, tiempos = [], []
    for s in segmentos:
        ws = palabras_de(s.get("text", ""))
        n = len(ws)
        if not n:
            continue
        paso_seg = (s["end"] - s["start"]) / n
        for j, w in enumerate(ws):
            dichas.append(w)
            tiempos.append(s["start"] + paso_seg * j)
    indices, errores = anclar(escenas, dichas, "la voz")
    if errores:
        sys.exit("✗ montaje.json:\n  " + "\n  ".join(errores)
                 + "\n  La voz dijo: " + " ".join(dichas)[:400])
    salida = []
    for k, e in enumerate(escenas):
        t0 = 0.0 if k == 0 else min(max(tiempos[indices[k]], 0.0), total)
        salida.append({**e, "imagen": PROYECTO / str(e["imagen"]), "t0": t0})
    for k, e in enumerate(salida):
        e["t1"] = salida[k + 1]["t0"] if k + 1 < len(salida) else total
        if e["t1"] - e["t0"] < 0.3:
            e["t1"] = e["t0"] + 0.3
    return salida


def visual(escenas: list[dict], ancho: int, alto: int, total: float, salida: Path) -> None:
    """Cada imagen con su paneo Ken Burns durante su tramo; las escenas unen en un solo visual.mp4."""
    entradas, tramos = [], []
    for i, e in enumerate(escenas):
        dur = e["t1"] - e["t0"]
        entradas.extend(["-loop", "1", "-t", f"{dur:.3f}", "-i", str(e["imagen"])])
        zoom_in = i % 2 == 0
        z_expr = "min(zoom+0.0015,1.15)" if zoom_in else "max(1.15-0.0015*on,1.0)"
        tramos.append(f"[{i}:v]scale={ancho * 2}:{alto * 2},fps={FPS},zoompan=z='{z_expr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={ancho}x{alto}:fps={FPS},setsar=1,format=yuv420p[v{i}]")
    concat_v = "".join(f"[v{i}]" for i in range(len(escenas))) + f"concat=n={len(escenas)}:v=1:a=0[v]"
    ffmpeg(*entradas, "-filter_complex", ";".join(tramos) + ";" + concat_v, "-map", "[v]",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-t", f"{total:.3f}", str(salida))


def audio(voz: Path, revision: Path) -> Path:
    """La voz con la música incidental a bajo volumen, masterizada a -14 LUFS."""
    audio_master = revision / "audio_master.wav"
    musica = next((PROYECTO / p for p in ["public/musica.mp3", "musica.mp3", "public/musica.wav"] if (PROYECTO / p).exists()), None)
    if musica:
        mezcla = revision / "mezcla.wav"
        ffmpeg("-i", str(voz), "-stream_loop", "-1", "-i", str(musica), "-filter_complex",
               "[1:a]volume=0.08[m];[0:a][m]amix=inputs=2:duration=first[a]", "-map", "[a]", str(mezcla))
        subprocess.run(["node", str(BASE / "masterizar.mjs"), str(mezcla), str(audio_master)], check=True)
    else:
        subprocess.run(["node", str(BASE / "masterizar.mjs"), str(voz), str(audio_master)], check=True)
    return audio_master


def main() -> None:
    formato_arg = _args[_args.index("--formato") + 1] if "--formato" in _args[:-1] else None
    nombre_arg = _args[_args.index("--nombre") + 1] if "--nombre" in _args[:-1] else None
    if ("--formato" in _args and formato_arg is None) or ("--nombre" in _args and nombre_arg is None):
        sys.exit(__doc__)
    if formato_arg and formato_arg not in FORMATOS:
        sys.exit('--formato es "vertical" u "horizontal".')
    # Los valores de las opciones no son argumentos sueltos: un nombre de más es un error del que llama.
    sueltos = {v for v in (_en, formato_arg, nombre_arg) if v}
    if [a for a in _args if not a.startswith("--") and a not in sueltos]:
        sys.exit(__doc__)
    revisa = "--revisa" in _args

    for f in ("guion.md", "montaje.json"):
        if not (PROYECTO / f).exists():
            sys.exit(f"✗ Falta {f} en la raíz del proyecto.")
    for f in ("guion.md", "montaje.json"):
        if malo := roto((PROYECTO / f).read_text(encoding="utf-8")):
            sys.exit(f"✗ {f} tiene la codificación rota («{malo}»): UTF-8 leído como latin-1; reescríbelo en UTF-8.")

    datos, errores = leer_montaje()
    formato = formato_arg or datos.get("formato", "vertical")
    ancho, alto = FORMATOS[formato]

    # Lo declarativo contra el guion: cada palabra existe y van en el orden en que se dicen, en un segundo.
    if errores:
        sys.exit("✗ montaje.json:\n  " + "\n  ".join(errores))
    escenas = [e for e in (datos.get("escenas") or []) if isinstance(e, dict)]
    if malos := anclar(escenas, palabras_de(texto_guion()), "el guion")[1]:
        sys.exit("✗ montaje.json:\n  " + "\n  ".join(malos))
    if revisa:
        print("✓ montaje.json bien: ya puedes lanzar hacer.py de fondo")
        return

    reloj = Reloj(PROYECTO)
    revision = PROYECTO / "revision"
    revision.mkdir(exist_ok=True)
    out_dir = PROYECTO / "out"
    out_dir.mkdir(exist_ok=True)

    # 1. La voz
    reloj.paso("voz…")
    voz = next((PROYECTO / p for p in ["public/voz.wav", "public/voz/narracion.wav", "voz.wav"] if (PROYECTO / p).exists()), None)
    if not voz:
        sys.exit("✗ Falta el audio en public/voz.wav o voz.wav (VOZ.md de video-base).")
    total = duracion(voz)
    reloj.nota("voz", f"{total:.1f} s")

    # 2. La transcripción, solo si la voz cambió desde la última vez
    reloj.paso("transcripción…")
    cache = revision / "transcripcion.json"
    if cache.exists() and cache.stat().st_mtime >= voz.stat().st_mtime:
        segmentos = json.loads(cache.read_text(encoding="utf-8"))
        reloj.nota("transcripcion", "la de antes, la voz no cambió")
    else:
        segmentos = transcribir(voz).get("segmentos", [])
        cache.write_text(json.dumps(segmentos, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")

    # 3. Las escenas en la voz: en qué segundo entra cada imagen
    reloj.paso("escenas…")
    escenas_t = tiempos_de_escenas(escenas, segmentos, total)

    # 4. El visual y los subtítulos
    reloj.paso("visual…")
    video_crudo = revision / "visual.mp4"
    visual(escenas_t, ancho, alto, total, video_crudo)
    reloj.paso("subtítulos…")
    ass_path = revision / "subtitulos.ass"
    generar_subtitulos_ass(segmentos, escenas_t, ancho, alto, ass_path)

    # 5. El audio
    reloj.paso("audio…")
    audio_master = audio(voz, revision)

    # 6. El mp4 final
    reloj.paso("render…")
    nombre = nombre_arg or re.sub(r"^politica-", "", PROYECTO.name)
    final = out_dir / f"politica-{nombre}.mp4"
    # La tipografía del estilo viaja con video-base (Archivo Black); sin fontsdir ffmpeg usaría la del sistema.
    # Entre comillas y con los dos puntos escapados (C\:) para que el parser del filtro no parta la ruta.
    fuentes = "'" + (BASE.parent / "assets" / "fonts").as_posix().replace(":", "\\:") + "'"
    subprocess.run(
        ["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", video_crudo.name, "-i", audio_master.name,
         "-map", "0:v", "-map", "1:a", "-vf", f"subtitles={ass_path.name}:fontsdir={fuentes}:charenc=UTF-8",
         *encoder_video(18), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(final)],
        cwd=revision, check=True
    )

    # 7. La portada de primer fotograma en vertical (PORTADA.md de video-base)
    portada_img = next((PROYECTO / p for p in ["portada.png", "public/portada.png", "portada/portada.png", "portada/portada.jpg"] if (PROYECTO / p).exists()), None)
    if alto > ancho and portada_img:
        subprocess.run(["node", str(BASE / "portada.mjs"), str(final), str(portada_img)], check=False)

    # 8. La hoja de cuadros para mirarlo de un vistazo
    reloj.paso("hoja…")
    hoja_png = hoja(final, revision / "hoja.png")
    reloj.listo(final, [hoja_png])


if __name__ == "__main__":
    main()
