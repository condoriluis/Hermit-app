"""
El video entero en un comando, de fondo: de `plan.json` (lo único que escribe el agente: qué foto o video del
usuario va en cada momento, en qué orden y con qué título) a `out/final.mp4`, medido y con su hoja para mirarlo.

    python -I -B -X utf8 <skill>/scripts/hacer.py --revisa     solo revisa plan.json y el material (un segundo)
    python -I -B -X utf8 <skill>/scripts/hacer.py              todo: media, sonido, render, medida y hoja

Desde la raíz del proyecto (la carpeta que dejó `nuevo.py`). En orden, y para en el primer ✗ diciendo todo lo que
hay que arreglar de una vez:

1. Comprueba plan.json: cada archivo existe, cada video tiene `desde`/`hasta` dentro de su duración, cada collage
   trae de 2 a 4 fotos, los segundos son positivos.
2. Prepara el material en public/media/ (lo ya hecho no se rehace): las fotos a jpg/png de máximo 2560 px y los
   videos recortados y normalizados a H.264 yuv420p bt709 a 30 fps (así Remotion los decodifica siempre, sea cual
   sea el formato del celular).
3. El sonido dentro de la composición (pistas separadas para el motor en vivo y la línea de tiempo):
   la música en `public/sonido/` a su volumen con fundidos y el ducking bajo la voz (su envolvente se
   mide aquí y la aplica el `volume` de Remotion, cuadro a cuadro), la voz en su `voz_desde`, y el kit
   sfx/ del estilo en los cortes del montaje.
4. Escribe src/montaje.json con las escenas medidas en cuadros y corre terminar.py: render con sonido,
   masterizado a −14 LUFS, out/final.mp4 y su comprobación. Después la hoja de contacto en revision/hoja.png.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
BASE = SKILL.parent / "video-base" / "scripts"
RAIZ = Path.cwd()
PY = [sys.executable, "-I", "-B", "-X", "utf8"]
# Los scripts de la skill buscan video-base por HERMIT_SKILLS: que sea la de esta copia, no la de la app instalada.
os.environ.setdefault("HERMIT_SKILLS", str(SKILL.parent))
sys.path.insert(0, str(BASE))
sys.path.insert(0, str(SKILL / "scripts"))
from formato import formato, tamano  # noqa: E402
from pistas import a_public, duracion_wav, firma, ganancia_musica  # noqa: E402

MOVIMIENTOS = {"acercar", "alejar", "izquierda", "derecha", "arriba", "abajo"}
TIPOS_FOTO = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".avif"}
MUSICA = (".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac")


def correr(cmd: list[str], que: str, fatal: bool = True) -> str:
    r = subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace")
    salida = (r.stdout + r.stderr).strip()
    if r.returncode and fatal:
        sys.exit(f"✗ {que} falló:\n" + salida[-2500:])
    return salida


def resolver(ruta: str) -> Path:
    """La ruta del plan, relativa al proyecto o absoluta; fuentes/ se intenta si no está donde dice."""
    p = Path(ruta)
    if not p.is_absolute():
        p = RAIZ / p
    if not p.exists() and not Path(ruta).is_absolute():
        q = RAIZ / "fuentes" / Path(ruta).name
        if q.exists():
            p = q
    return p


def segundos_de(e: dict) -> float:
    if e.get("tipo") == "video":
        return float(e.get("hasta", 0)) - float(e.get("desde", 0))
    return float(e.get("segundos", 2.2))


def resumen(plan: dict) -> None:
    """plan.md: el plan en lectura para la etapa «Plan» del estudio. Se rehace en cada corrida, del plan.json
    validado (antes de que `preparar` le cambie las rutas): el JSON sigue siendo la fuente, esto solo lo cuenta."""
    lineas = ["# Plan del video", ""]
    escenas = plan.get("escenas", [])
    total = sum(segundos_de(e) for e in escenas)
    for clave in ("intro", "cierre"):
        if plan.get(clave):
            total += float(plan[clave].get("segundos", 2.2))
    lineas.append(f"**{len(escenas)} escenas** · ~{total:.0f} s · formato {formato(RAIZ)}")
    if plan.get("musica"):
        lineas.append(f"**Música:** `{plan['musica']}`")
    if plan.get("musica_volumen") is not None:
        lineas.append(f"**Volumen de la música:** {float(plan['musica_volumen']):.2f}")
    if plan.get("voz"):
        lineas.append(f"**Voz:** `{plan['voz']}`")
    if plan.get("voz_volumen") is not None:
        lineas.append(f"**Volumen de la voz:** {float(plan['voz_volumen']):.2f}")
    lineas += ["", "## Escenas", ""]
    n = 0

    def tarjeta(nombre: str, t: dict) -> None:
        nonlocal n
        n += 1
        detalle = " — ".join(x for x in (t.get("titulo"), t.get("subtitulo")) if x)
        lineas.append(f"{n}. **{nombre}** · {float(t.get('segundos', 2.2)):.1f} s" + (f" — «{detalle}»" if detalle else ""))

    if plan.get("intro"):
        tarjeta("Intro", plan["intro"])
    movs = {"acercar": "acercar", "alejar": "alejar", "izquierda": "izquierda", "derecha": "derecha",
            "arriba": "arriba", "abajo": "abajo"}
    for e in escenas:
        n += 1
        seg = segundos_de(e)
        tipo = e.get("tipo")
        titulo = e.get("titulo") or e.get("subtitulo") or ""
        if tipo == "collage":
            que = f"collage de {len(e.get('fotos', []))} fotos"
        elif tipo == "foto":
            que = f"`{e.get('archivo', '?')}`"
            if e.get("mov"):
                que += f" · paneo {movs.get(e['mov'], e['mov'])}"
        elif tipo == "video":
            que = f"`{e.get('archivo', '?')}` ({float(e.get('desde', 0)):.1f}–{float(e.get('hasta', 0)):.1f} s)"
        else:
            que = str(tipo)
        extra = f" — «{titulo}»" if titulo else ""
        lineas.append(f"{n}. **{(tipo or '?').capitalize()}** · {seg:.1f} s — {que}{extra}")
    if plan.get("cierre"):
        tarjeta("Cierre", plan["cierre"])
    (RAIZ / "plan.md").write_text("\n".join(lineas) + "\n", encoding="utf-8")


def duracion_video(p: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def es_video(p: Path) -> bool:
    return p.suffix.lower() in {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".3gp", ".mts"}


def leer_plan() -> tuple[dict, list[str]]:
    f = RAIZ / "plan.json"
    if not f.exists():
        sys.exit("✗ Falta plan.json en la raíz del proyecto: es lo que hace el agente (qué va, en qué orden).")
    try:
        plan = json.loads(f.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"✗ plan.json no es JSON válido: {e}")
    errores: list[str] = []
    escenas = plan.get("escenas")
    if not isinstance(escenas, list) or not escenas:
        errores.append("plan.json: `escenas` debe ser una lista con al menos un momento")
        escenas = escenas if isinstance(escenas, list) else []
    durs: dict[str, float] = {}
    for i, e in enumerate(escenas):
        k = f"escena {i + 1}"
        if not isinstance(e, dict):
            errores.append(f"{k}: no es un objeto")
            continue
        tipo = e.get("tipo")
        if tipo == "collage":
            fotos = e.get("fotos")
            if not isinstance(fotos, list) or not 2 <= len(fotos) <= 4:
                errores.append(f"{k} (collage): `fotos` debe tener de 2 a 4 fotos")
            else:
                for j, fo in enumerate(fotos):
                    if not isinstance(fo, dict) or not fo.get("archivo"):
                        errores.append(f"{k} foto {j + 1}: falta `archivo`")
                    else:
                        p = resolver(str(fo["archivo"]))
                        if not p.exists():
                            errores.append(f"{k} foto {j + 1}: no existe {fo['archivo']}")
            seg = e.get("segundos")
            if not isinstance(seg, (int, float)) or not 1.5 <= seg <= 12:
                errores.append(f"{k} (collage): `segundos` debe estar entre 1,5 y 12")
        elif tipo in ("foto", "video"):
            arc = e.get("archivo")
            if not arc:
                errores.append(f"{k} ({tipo}): falta `archivo`")
            else:
                p = resolver(str(arc))
                if not p.exists():
                    errores.append(f"{k} ({tipo}): no existe {arc}")
                elif tipo == "video":
                    if p not in durs:
                        durs[p] = duracion_video(p)
                    if not durs[p]:
                        errores.append(f"{k} (video): ffprobe no pudo leer {arc}")
                    desde, hasta = e.get("desde"), e.get("hasta")
                    if not all(isinstance(x, (int, float)) for x in (desde, hasta)):
                        errores.append(f"{k} (video): faltan `desde` y `hasta` (segundos dentro del video)")
                    elif not (0 <= desde < hasta <= durs[p] + 0.05):
                        errores.append(f"{k} (video): `desde`/`hasta` fuera del video ({durs[p]:.1f} s): {desde}–{hasta}")
                    elif hasta - desde < 0.8:
                        errores.append(f"{k} (video): el tramo dura menos de 0,8 s ({desde}–{hasta})")
                else:
                    if p.suffix.lower() not in TIPOS_FOTO:
                        errores.append(f"{k} (foto): {arc} no parece imagen ({p.suffix})")
            if tipo == "foto":
                seg = e.get("segundos")
                if not isinstance(seg, (int, float)) or not 0.8 <= seg <= 15:
                    errores.append(f"{k} (foto): `segundos` debe estar entre 0,8 y 15")
            if e.get("mov") is not None and e["mov"] not in MOVIMIENTOS:
                errores.append(f"{k}: `mov` debe ser uno de {sorted(MOVIMIENTOS)}")
        else:
            errores.append(f"{k}: `tipo` debe ser foto, video o collage (llegó {tipo!r})")
    for clave in ("intro", "cierre"):
        t = plan.get(clave)
        if t is None:
            continue
        if not isinstance(t, dict) or not t.get("titulo"):
            errores.append(f"plan.json: `{clave}` debe ser un objeto con `titulo`")
        elif not isinstance(t.get("segundos", 2.2), (int, float)) or not 1 <= t.get("segundos", 2.2) <= 8:
            errores.append(f"plan.json: `{clave}.segundos` debe estar entre 1 y 8")
    for clave in ("musica", "voz"):
        r = plan.get(clave)
        if r and clave == "musica":
            # La canción puede ser una ruta del proyecto o un archivo de public/assets/music/.
            if not (resolver(str(r)).exists() or (RAIZ / "public" / "assets" / "music" / Path(str(r)).name).exists()):
                errores.append(f"plan.json: `musica` no existe: {r}")
        elif r and not resolver(str(r)).exists():
            errores.append(f"plan.json: `{clave}` no existe: {r}")
    m = plan.get("musica")
    if m is not None and m is not False and not isinstance(m, str):
        errores.append("plan.json: `musica` debe ser la ruta de una canción o `false` (sin música)")
    for clave in ("musica_volumen", "voz_volumen"):
        v = plan.get(clave)
        if v is not None and (isinstance(v, bool) or not isinstance(v, (int, float)) or not 0 <= v <= 1):
            errores.append(f"plan.json: `{clave}` debe ser un número entre 0 y 1")
    if plan.get("sfx") is not None and not isinstance(plan["sfx"], bool):
        errores.append("plan.json: `sfx` debe ser `false` para quitar los efectos o no ponerse")
    return plan, errores


def preparar_foto(p: Path, salida: Path) -> None:
    """La foto a jpg (o png si traía transparencia posible), de máximo 2560 px: liviana para el render."""
    if p.suffix.lower() == ".png":
        vf = "scale='min(iw,2560)':'min(ih,2560)':force_original_aspect_ratio=decrease"
        correr(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(p), "-vf", vf, str(salida)], "la foto")
    else:
        vf = "scale='min(iw,2560)':'min(ih,2560)':force_original_aspect_ratio=decrease"
        correr(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(p), "-vf", vf, "-q:v", "3", str(salida)], "la foto")


def preparar_video(p: Path, desde: float, hasta: float, salida: Path) -> None:
    """El tramo del video, normalizado: H.264 yuv420p bt709, 30 fps, sin audio, rotación aplicada."""
    vf = ("fps=30,scale='min(iw,1920)':'min(ih,1920)':force_original_aspect_ratio=decrease,setsar=1")
    correr(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{desde:.3f}", "-t", f"{hasta - desde:.3f}", "-i", str(p),
            "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-g", "30", "-an", "-movflags", "+faststart", str(salida)], "el video")


def preparar(plan: dict) -> dict:
    """Cada archivo del plan a public/media/ con nombre por contenido: lo ya hecho no se rehace. Devuelve el plan
    con las rutas ya cambiadas a `media/…` (las que entiende staticFile)."""
    media = RAIZ / "public" / "media"
    media.mkdir(parents=True, exist_ok=True)
    cache: dict[str, str] = {}

    def foto(arc: str) -> str:
        clave = ("foto", arc)
        if clave in cache:
            return cache[clave]
        p = resolver(arc)
        h = firma(p.resolve(), p.stat().st_mtime_ns)
        ext = ".png" if p.suffix.lower() == ".png" else ".jpg"
        salida = media / f"{h}{ext}"
        if not salida.exists():
            preparar_foto(p, salida)
        rel = f"media/{salida.name}"
        cache[clave] = rel
        return rel

    def video(arc: str, desde: float, hasta: float) -> str:
        clave = ("video", arc, desde, hasta)
        if clave in cache:
            return cache[clave]
        p = resolver(arc)
        h = firma(p.resolve(), p.stat().st_mtime_ns, desde, hasta)
        salida = media / f"{h}.mp4"
        if not salida.exists():
            preparar_video(p, desde, hasta, salida)
        rel = f"media/{salida.name}"
        cache[clave] = rel
        return rel

    for e in plan.get("escenas", []):
        if e.get("tipo") == "collage":
            for fo in e["fotos"]:
                fo["src"] = foto(str(fo["archivo"]))
                fo.pop("archivo", None)
        elif e.get("tipo") == "foto":
            e["src"] = foto(str(e["archivo"]))
            e.pop("archivo", None)
        elif e.get("tipo") == "video":
            e["src"] = video(str(e["archivo"]), float(e["desde"]), float(e["hasta"]))
            e["video"] = True
            e.pop("archivo", None)
    return plan


def musica_del_usuario(plan: dict) -> Path | None:
    """La canción: la del plan, la de public/assets/music/, o una sintetizada del largo del video."""
    candidatos = []
    if plan.get("musica"):
        r = str(plan["musica"])
        candidatos += [resolver(r), RAIZ / "public" / "assets" / "music" / Path(r).name]
    carpeta = RAIZ / "public" / "assets" / "music"
    if carpeta.exists():
        candidatos += sorted(f for f in carpeta.iterdir() if f.suffix.lower() in MUSICA)
    return next((c for c in candidatos if c.exists()), None)


SFX = SKILL / "sfx"
# El fundido entre escenas de la plantilla (Montaje.tsx): el empuje dura F cuadros (~0,33 s).
F_ENTRE = 10


def cues_sfx(datos: dict) -> list[tuple[float, Path, float]]:
    """Los momentos del kit propio, en segundos del video: el whoosh cuando una escena empieza a
    empujar a la anterior, el pop cuando cae el collage y el cierre cálido al abrir la tarjeta de
    cierre. Los tiempos salen de montaje.json (escenas medidas en cuadros), no de suposiciones."""
    fps = float(datos.get("fps", 30))
    escenas = datos.get("escenas", [])
    cues: list[tuple[float, Path, float]] = []
    for i in range(1, len(escenas)):
        # El whoosh arranca cuando la escena entrante asoma (~6 cuadros dentro del empuje de F).
        t = max(0.0, (escenas[i]["desde"] - F_ENTRE + 6) / fps)
        cues.append((t, SFX / ("deslize_1.wav" if i % 2 else "deslize_2.wav"), 0.16))
    for e in escenas:
        if e.get("tipo") == "collage":
            cues.append(((e["desde"] + 6) / fps, SFX / "pop_1.wav", 0.30))
        elif e.get("tipo") == "tarjeta" and e.get("variante") == "cierre":
            cues.append(((e["desde"] + 4) / fps, SFX / "cierre_1.wav", 0.32))
    return sorted(c for c in cues if c[1].exists())


def preparar_sonido(plan: dict, datos: dict, musica: Path | None) -> dict | None:
    """El bloque `sonido` de montaje.json y los archivos de `public/sonido/`: la música en loop con su
    ganancia por ventanas (fundidos + ducking bajo la voz), la voz en su `voz_desde` y el kit sfx del
    estilo en los cortes — cada uno como pista propia, para que el motor en vivo lo oiga y la línea de
    tiempo las muestre por separado. None si el video no lleva sonido (musica:false, sfx:false, sin voz)."""
    fps = float(datos["fps"])
    total = datos["duracion"]
    dur = total / fps
    voz_rel = None
    voz_abs: Path | None = None
    voz_desde = float(plan.get("voz_desde", 0))
    if plan.get("voz"):
        voz = resolver(str(plan["voz"]))
        if voz.exists():
            voz_rel = a_public(voz, "voz", RAIZ)
            voz_abs = RAIZ / "public" / voz_rel
    sonido: dict = {}
    if musica is not None:
        # Con voz, el compresor lateral la hunde bajo la narración; sin ella, solo los fundidos.
        sonido["musica"] = {
            "src": a_public(musica, "musica", RAIZ),
            "volumen": float(plan.get("musica_volumen", 0.35 if voz_abs else 0.85)),
            "ganancia": ganancia_musica(voz_abs, voz_desde, dur),
        }
    if voz_abs and voz_rel:
        desde_f = max(0, int(round(voz_desde * fps)))
        n = min(total - desde_f, round(duracion_wav(voz_abs) * fps))
        if n > 0:
            sonido["voz"] = {"src": voz_rel, "desde": desde_f, "hasta": desde_f + n,
                             "volumen": float(plan.get("voz_volumen", 1.0))}
    cues = cues_sfx(datos) if plan.get("sfx") is not False else []
    if cues:
        sonido["sfx"] = []
        for t, ruta, ganancia in cues:
            rel = a_public(ruta, ruta.stem, RAIZ)
            n = max(1, round(duracion_wav(RAIZ / "public" / rel) * fps))
            desde = max(0, int(round(t * fps)))
            sonido["sfx"].append({"src": rel, "desde": desde, "hasta": min(total, desde + n),
                                  "volumen": ganancia})
    return sonido or None


def musica_de_fondo(plan: dict, dur: float) -> Path | None:
    """La cama: la canción del usuario o, sin ella, una sintetizada del largo pedido
    (musica.py de video-base, 92 BPM con batería marcada). `musica: false` en el plan es
    «sin música» a propósito: no se sintetiza ni se busca en assets/music. None si no se pudo hacer."""
    if plan.get("musica") is False:
        return None
    musica = musica_del_usuario(plan)
    if musica is not None:
        return musica
    trabajo = RAIZ / "work" / "musica.wav"
    trabajo.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(PY + [str(BASE / "musica.py"), f"{dur:.3f}", str(trabajo)], cwd=RAIZ,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode or not trabajo.exists():
        print("  ⚠ no se pudo sintetizar la música; el video sale sin cama", flush=True)
        return None
    return trabajo


def batidos_de(musica: Path | None, dur: float) -> list[float]:
    """Los golpes de la música en segundos (batidos.py), para que los cortes caigan en ellos.
    Sin música o sin ritmo claro: lista vacía y el montaje queda como siempre."""
    if musica is None:
        return []
    salida = RAIZ / "work" / "batidos.json"
    salida.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(PY + [str(SKILL / "scripts" / "batidos.py"), str(musica), f"{dur:.2f}", str(salida)],
                       cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode or not salida.exists():
        return []
    try:
        return [float(t) for t in json.loads(salida.read_text(encoding="utf-8")).get("batidos", [])]
    except (json.JSONDecodeError, ValueError):
        return []


# Lo que cada tipo de escena puede durar en cuadros (los mismos límites que valida leer_plan),
# para que el ajuste al ritmo nunca estire ni achique una escena fuera de lo permitido.
LIMITES = {"tarjeta": (30, 240), "foto": (24, 450), "collage": (45, 360)}


def ajustar_al_batido(n: int, cursor: int, fps: int, tipo: str, n_max: int,
                      batidos: list[float]) -> int:
    """Si el final de la escena puede caer sobre un golpe a ≤0,30 s sin salirse de sus límites,
    lo hace; si no, queda como estaba. El inicio ya venía del golpe anterior (o del 0)."""
    if not batidos:
        return n
    fin = (cursor + n) / fps
    golpe = min(batidos, key=lambda b: abs(b - fin))
    if abs(golpe - fin) > 0.30:
        return n
    mn, mx = LIMITES.get(tipo, (24, n_max))
    mx = min(mx, n_max)
    nuevo = round(golpe * fps) - cursor
    return nuevo if mn <= nuevo <= mx else n


def montaje(plan: dict, preparado: dict, batidos: list[float] | None = None) -> dict:
    """src/montaje.json: las escenas del plan medidas en cuadros, en el formato del video.
    Con `batidos` (segundos de la música), cada corte se acerca al golpe más cercano."""
    ancho, alto = tamano(RAIZ)
    fps = 30
    # El acento del video (marcador de títulos, filetes y barra de avance): plan.json puede pedirlo, si no, menta.
    acento = plan.get("acento")
    if not (isinstance(acento, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", acento)):
        acento = "#8ef0c8"
    salida = {"ancho": ancho, "alto": alto, "fps": fps, "duracion": 0, "acento": acento, "escenas": []}
    batidos = batidos or []
    partes: list[tuple[dict, int, str, int]] = []  # (escena sin tiempos, n cuadros, tipo, tope propio)

    def tarjeta(t: dict) -> None:
        n = max(1, round(float(t.get("segundos", 2.2)) * fps))
        e = {"tipo": "tarjeta", "variante": t.get("variante", "intro"), "titulo": t["titulo"],
             "subtitulo": t.get("subtitulo", "")}
        if t.get("kicker"):
            e["kicker"] = t["kicker"]
        partes.append((e, n, "tarjeta", 240))

    if plan.get("intro"):
        plan["intro"]["variante"] = "intro"
        tarjeta(plan["intro"])
    movs = ["acercar", "alejar", "izquierda", "derecha", "arriba", "abajo"]
    for i, e in enumerate(preparado.get("escenas", [])):
        mov = e.get("mov") or movs[i % len(movs)]
        if e.get("tipo") == "collage":
            n = max(1, round(float(e["segundos"]) * fps))
            partes.append(({"tipo": "collage", "fotos": [{"src": f["src"], "pie": f.get("pie", "")} for f in e["fotos"]],
                            "titulo": e.get("titulo", ""), "subtitulo": e.get("subtitulo", "")}, n, "collage", 360))
        elif e.get("tipo") == "foto":
            n = max(1, round(float(e["segundos"]) * fps))
            partes.append(({"tipo": "plano", "src": e["src"], "video": False, "mov": mov,
                            "titulo": e.get("titulo", ""), "subtitulo": e.get("subtitulo", "")}, n, "foto", 450))
        elif e.get("tipo") == "video":
            # La duración real del tramo preparado manda (redondeos de fps), no la pedida.
            real = duracion_video(RAIZ / "public" / e["src"])
            n = max(1, round((real or (float(e["hasta"]) - float(e["desde"]))) * fps))
            partes.append(({"tipo": "plano", "src": e["src"], "video": True, "mov": mov,
                            "titulo": e.get("titulo", ""), "subtitulo": e.get("subtitulo", "")}, n, "video", n))
    if plan.get("cierre"):
        plan["cierre"]["variante"] = "cierre"
        tarjeta(plan["cierre"])

    cursor = 0
    for j, (e, n, tipo, tope) in enumerate(partes):
        # El final del video no es un corte: la última escena conserva su duración.
        if j < len(partes) - 1:
            n = ajustar_al_batido(n, cursor, fps, tipo, tope, batidos)
        e["desde"], e["hasta"] = cursor, cursor + n
        cursor += n
        salida["escenas"].append(e)
    salida["duracion"] = cursor
    return salida


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    revisa = "--revisa" in args
    if [a for a in args if a != "--revisa"]:
        sys.exit(__doc__)
    if not (RAIZ / "remotion.config.ts").exists():
        sys.exit("Córrelo desde la raíz del proyecto (la carpeta que dejó nuevo.py, donde está remotion.config.ts).")
    plan, errores = leer_plan()
    if errores:
        sys.exit("✗ plan.json:\n  " + "\n  ".join(errores))
    resumen(plan)
    escenas = plan["escenas"]
    total = sum(float(e.get("segundos", (float(e["hasta"]) - float(e["desde"])) if e.get("tipo") == "video" else 2.2))
                for e in escenas)
    for clave in ("intro", "cierre"):
        if plan.get(clave):
            total += float(plan[clave].get("segundos", 2.2))
    print(f"plan.json bien: {len(escenas)} escenas, ~{total:.0f} s, formato {formato(RAIZ)}.", end="")
    if revisa:
        print(" Ya puedes lanzar hacer.py de fondo")
        return
    print(" Preparando…", flush=True)
    preparado = preparar(plan)
    # La cama se resuelve una vez: de ella salen los golpes para cortar a ritmo y el audio final.
    # El largo estimado del plan basta para sintetizarla; el -stream_loop de la mezcla la repite si falta.
    musica = musica_de_fondo(plan, total)
    datos = montaje(plan, preparado, batidos_de(musica, total + 1))
    # El sonido va dentro de la composición (pistas de música, voz y efectos): el motor en vivo lo oye
    # y la línea de tiempo lo muestra. Se prepara antes de escribir montaje.json para que la primera
    # versión en vivo ya salga con sonido.
    sonido_datos = preparar_sonido(plan, datos, musica)
    if sonido_datos:
        datos["sonido"] = sonido_datos
    (RAIZ / "src" / "montaje.json").write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
    dur = datos["duracion"] / datos["fps"]
    print(f"  render ({datos['duracion']} cuadros)…", flush=True)
    correr(PY + [str(SKILL / "scripts" / "terminar.py"), ".", "--sin-portada"], "el render")
    # La portada de un render anterior no se pega a este video: sale de este video, y la etapa Portada queda
    # pendiente solo cuando el nuevo ya está. Si el render falla, la vieja sigue con el video viejo.
    (RAIZ / "portada.png").unlink(missing_ok=True)
    print("  la hoja de contacto…", flush=True)
    correr(["node", str(BASE / "hoja.mjs"), "out/final.mp4", "revision/hoja.png", "--cada", "1.5"], "la hoja")
    print(f"✓ listo: out/final.mp4 ({dur:.0f} s). Mira revision/hoja.png: cada foto o video debe verse en su momento y "
          "los títulos leerse. El audio se comprobó por cifras (masterizar y comprobar), no se oyó.")


main()
