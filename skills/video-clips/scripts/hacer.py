"""
Los clips de un video largo, del proyecto a `out/redes/<n>-<nombre>.mp4`: cada corte de `cortes.json`
se reencuadra al formato, lleva su tarjeta de gancho si la tiene, se masteriza a -14 LUFS y se subtitula
en karaoke con el estilo del corte. Es el motor de los clips que salen de un video propio o de uno con
permiso (la sección Clips de Hermit arma el proyecto; aquí solo se corta y se viste).

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal] [--nombre <n>]

`--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit; sin ella, el directorio actual.

Lo que el agente deja en el proyecto:
- `public/video.mp4` (o `video.mp4`, la ruta que diga `fuente`): el video completo, ya bajado.
- `cortes.json`: la lista de cortes a sacar, cada uno con su sitio en el video:
      {"desde": 754.2, "hasta": 785.8, "nombre": "el-remate", "gancho": "el momento que lo cambió todo",
       "subtitulos": "minimal", "portada_titulo": "La promesa en 3 palabras",
       "acento": "amarillo", "portada_resaltar": "80%", "portada_fuente": "anton"}
  `reencuadre` (opcional): `auto` (el motor mide las caras del tramo y elige solo: primer plano con cara
  grande la mayor parte del tiempo → `persona`; si no → `difuminado`; sin datos de caras → `centrado`),
  `centrado` (recorte fijo al centro, el de omisión), `difuminado` (todo el cuadro
  nítido sobre su copia borrosa: para videos que enseñan cosas) o `persona` (la cámara sigue a quien habla:
  detecta las caras del tramo y panea suave, con zona muerta; si no puede detectarlas, sale `centrado`).
  `desde`/`hasta` son segundos del video fuente (los da la transcripción palabra a palabra). `nombre` es el
  slug del archivo (`out/redes/1-el-remate.mp4`); si falta, el número del corte. `gancho` es el texto que se
  lee los primeros segundos sobre el video (opcional, hasta 80 caracteres). `portada_titulo` es el título de
  la portada en vertical (opcional, 2 a 5 palabras; sin él, la portada usa el gancho limpio). `subtitulos` es el estilo karaoke:
  `minimal` (Bebas Neue, el de omisión), `top` (Anton, palabra activa amarilla), `archivo` (Archivo Black,
  palabra activa roja), `varela` (Varela Round, palabra activa cyan), `crimen` (Courier Prime, ámbar),
  `centro` (el minimal en el centro del cuadro; deprecado, solo cortes viejos) o `ninguno` (la fuente ya
  trae sus subtítulos: no se queman los nuestros). `formato` del JSON manda sobre `--formato`.
  `acento` (opcional) es el golpe de color del clip: `amarillo`, `rojo`, `naranja`, `verde`, `cyan`, `azul`,
  `morado`, `rosa` o un #RRGGBB — pinta la palabra activa de los subtítulos y, con `portada_resaltar`, la
  palabra o frase elegida del título de la portada (el resto queda blanco). `portada_fuente` (opcional) es
  la letra de la portada: `anton`, `archivo` (la de omisión, la del gancho), `bebas`, `courier` o `varela`.
- `permiso.txt` (opcional): de quién es el video y por qué se puede cortar — queda en el proyecto.

`--revisa` valida todo en un segundo y sin red ni voz: la forma de `cortes.json`, que la fuente exista y que
los tiempos sean posibles. El corte, el audio, los subtítulos y la hoja se cronometra en `revision/tiempos.json`.
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
from hermit import duracion, encoder_video  # noqa: E402
from momentos import Reloj, errores_mojibake, hoja, roto, titulo_portada  # noqa: E402
import encuadre  # noqa: E402 — la trayectoria del reencuadre «persona» (carpeta ../../video-base/scripts)

# `--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit: el proyecto no depende del directorio donde se
# corra; sin ella, el directorio actual.
_args = sys.argv[1:]
_en = _args[_args.index("--en") + 1] if "--en" in _args[:-1] else ""
formato_arg = _args[_args.index("--formato") + 1] if "--formato" in _args[:-1] else None
nombre_arg = _args[_args.index("--nombre") + 1] if "--nombre" in _args[:-1] else None
if ("--formato" in _args and formato_arg is None) or ("--nombre" in _args and nombre_arg is None):
    sys.exit(__doc__)
PROYECTO = Path(_en).resolve() if _en else Path.cwd()
# La carpeta de las skills no es un proyecto: el video no lo vería nadie.
if PROYECTO == SKILL.parent or SKILL.parent in PROYECTO.parents:
    sys.exit(f"{PROYECTO} es la carpeta de las skills: pasa la ruta completa de la línea `Carpeta:`.")
FORMATOS = {"vertical": (1080, 1920), "horizontal": (1920, 1080)}
SUBTITULOS = {"minimal", "top", "archivo", "varela", "crimen", "ninguno", "centro"}
# El acento del clip (`acento` en cortes.json): nombre de la paleta o #RRGGBB. Pinta la palabra
# destacada de la portada y la palabra activa de los subtítulos karaoke — el mismo golpe de color
# en todo el clip. Sin `acento`, la portada queda blanca y los subtítulos con el color del estilo.
ACENTOS = {"amarillo": "#ffe600", "rojo": "#ff4d4d", "naranja": "#fb923c", "verde": "#4ade80",
           "cyan": "#22d3ee", "azul": "#60a5fa", "morado": "#a78bfa", "rosa": "#f472b6"}
# Las letras de portada (`portada_fuente`): las del estilo del clip. Archivo Black es la del gancho.
PORTADA_FUENTES = {"anton": "Anton-Regular.ttf", "archivo": "ArchivoBlack-Regular.ttf",
                   "bebas": "BebasNeue-Regular.ttf", "courier": "CourierPrime-Bold.ttf",
                   "varela": "VarelaRound-Regular.ttf"}
FPS = 30
FUENTE_GANCHO = "ArchivoBlack-Regular.ttf"


def acento_hex(c: dict) -> str | None:
    """`acento` del corte en #RRGGBB: nombre de ACENTOS o hex directo (ya validado en `leer_cortes`)."""
    a = c.get("acento")
    if a is None:
        return None
    a = str(a).strip().lower()
    return ACENTOS.get(a) or (a if a.startswith("#") else None)


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args], check=True)


def leer_cortes() -> tuple[dict, list[str]]:
    """cortes.json de la raíz; devuelve (datos, errores de forma)."""
    archivo = PROYECTO / "cortes.json"
    if not archivo.exists():
        return {}, ["falta cortes.json en la raíz del proyecto"]
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        return {}, [f"cortes.json no es JSON: {e}"]
    if not isinstance(datos, dict):
        return {}, ["cortes.json no es un objeto: lleva `fuente` y `cortes`"]
    errores = errores_mojibake(datos)
    formato = datos.get("formato", "vertical")
    if formato not in FORMATOS:
        errores.append(f'formato «{formato}»: va "vertical" u "horizontal"')
    fuente = datos.get("fuente", "")
    if not isinstance(fuente, str) or not fuente.strip():
        errores.append("falta `fuente`: la ruta del video completo, relativa a la raíz")
    elif not (PROYECTO / fuente).is_file():
        errores.append(f"no está la fuente {fuente} (relativa a la raíz del proyecto)")
    cortes = datos.get("cortes")
    if not isinstance(cortes, list) or not cortes:
        errores.append("no tiene cortes: una lista `cortes`, cada uno con `desde` y `hasta`")
        cortes = []
    for k, c in enumerate(cortes):
        que = f"corte {k + 1}"
        if not isinstance(c, dict):
            errores.append(f"{que}: no es un objeto")
            continue
        try:
            desde, hasta = float(c.get("desde")), float(c.get("hasta"))
            if not (0 <= desde < hasta):
                raise ValueError
            if hasta - desde > 600:
                errores.append(f"{que}: dura más de 10 minutos ({hasta - desde:.0f} s): un clip es un momento")
        except (TypeError, ValueError):
            errores.append(f"{que}: `desde` y `hasta` son segundos del video fuente, `desde` < `hasta`")
        nombre = c.get("nombre")
        if nombre is not None and not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,60}", str(nombre)):
            errores.append(f"{que}: `nombre` es un slug en minúsculas (letras, números y guiones), o se quita")
        gancho = c.get("gancho")
        if gancho is not None and (not isinstance(gancho, str) or len(gancho) > 80):
            errores.append(f"{que}: `gancho` es un texto de hasta 80 caracteres o se quita")
        subtitulos = c.get("subtitulos", "minimal")
        if subtitulos not in SUBTITULOS:
            errores.append(f"{que}: `subtitulos` «{subtitulos}» no existe: va {', '.join(sorted(SUBTITULOS))}")
        portada_titulo = c.get("portada_titulo")
        if portada_titulo is not None and (not isinstance(portada_titulo, str) or len(portada_titulo) > 60):
            errores.append(f"{que}: `portada_titulo` es un texto de hasta 60 caracteres (2 a 5 palabras) o se quita")
        acento = c.get("acento")
        if acento is not None and not (str(acento).strip().lower() in ACENTOS
                                     or re.fullmatch(r"#[0-9a-fA-F]{6}", str(acento).strip())):
            errores.append(f"{que}: `acento` es uno de {', '.join(ACENTOS)} o un #RRGGBB")
        resaltar = c.get("portada_resaltar")
        if resaltar is not None and (not isinstance(resaltar, str) or not resaltar.strip() or len(resaltar) > 40):
            errores.append(f"{que}: `portada_resaltar` es la palabra o frase del título que va en el acento (hasta 40 caracteres)")
        portada_fuente = c.get("portada_fuente")
        if portada_fuente is not None and str(portada_fuente).strip().lower() not in PORTADA_FUENTES:
            errores.append(f"{que}: `portada_fuente` es una de {', '.join(PORTADA_FUENTES)}")
    return datos, errores


def resolver_reencuadre(fuente: Path, c: dict) -> str:
    """`reencuadre: "auto"` se resuelve aquí, una vez por corte: con la cobertura de caras del tramo decide
    `persona` (hay primer plano la mayor parte del tiempo) o `difuminado` (pantallas, tablas o presentador
    lejano). Sin `.caras.json` o con datos rotos se queda en `centrado`, el comportamiento de siempre."""
    modo = str(c.get("reencuadre") or "centrado")
    if modo != "auto":
        return modo
    caras = fuente.with_suffix(".caras.json")
    if not caras.is_file():
        return "centrado"
    try:
        datos = json.loads(caras.read_text(encoding="utf-8"))
        cov = encuadre.cobertura(datos, float(c["desde"]), float(c["hasta"]))
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return "centrado"
    return "persona" if cov["cobertura"] >= 0.5 else "difuminado"


def trayectoria_persona(fuente: Path, desde: float, hasta: float, ancho: int, alto: int) -> dict | None:
    """La trayectoria del corte para `reencuadre: "persona"`: lee `<fuente>.caras.json` (lo escribe
    `detectar.py`, que `main()` corre una vez por fuente y rango si falta o quedó viejo) y la suaviza con
    `encuadre.trayectoria`. None si no hay caras que seguir o el formato no recorta: el corte sale `centrado`."""
    caras = fuente.with_suffix(".caras.json")
    if not caras.is_file():
        return None
    try:
        datos = json.loads(caras.read_text(encoding="utf-8"))
        return encuadre.trayectoria(datos, desde, hasta, ancho, alto)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return None


def medidas(video: Path) -> tuple[int, int]:
    """Ancho y alto del vídeo, con ffprobe: la misma fuente puede venir en vertical, horizontal o cuadrada."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height", "-of", "csv=p=0:s=x", str(video)],
                       capture_output=True, text=True)
    try:
        w, h = r.stdout.strip().split("x")
        return int(w), int(h)
    except ValueError:
        return 0, 0


def hay_recorte(fuente: Path, formato: str) -> bool:
    """Si la ventana del formato puede desplazarse dentro de la fuente. Cuando el aspecto ya es el del clip
    (un live vertical a clip vertical), la ventana cubre todo: no hay nada que seguir y `detectar.py` sería
    medir caras para un reencuadre imposible — se ahorra su pasada entera."""
    dst_w, dst_h = FORMATOS.get(formato, FORMATOS["vertical"])
    sw, sh = medidas(fuente)
    if not sw or not sh:
        return True  # sin medidas no se arriesga: se detecta como siempre
    cw, ch, _ = encuadre.ventana(sw, sh, dst_w, dst_h)
    return sw - cw > 0 or sh - ch > 0


def asegurar_caras(fuente: Path, cortes: list[dict], reloj, formato: str = "vertical") -> None:
    """Una pasada de `detectar.py` sobre el tramo que cubren los cortes «persona», si falta o la fuente es más
    nueva. Sin cv2 (Python sin opencv) o si la detección falla, los cortes salen `centrado` y se avisa una vez."""
    suyos = [c for c in cortes if str(c.get("reencuadre") or "") in ("persona", "auto")]
    if not suyos:
        return
    # Si ningún formato pedido puede desplazar la ventana sobre la fuente, las caras no deciden nada.
    if not any(hay_recorte(fuente, str(c.get("formato") or formato)) for c in suyos):
        return
    caras = fuente.with_suffix(".caras.json")
    desde = min(float(c["desde"]) for c in suyos) - 0.5
    hasta = max(float(c["hasta"]) for c in suyos) + 0.5
    if caras.is_file() and caras.stat().st_mtime >= fuente.stat().st_mtime:
        try:  # Solo vale si el rango pedido cabe dentro del que se midió de verdad.
            medido = json.loads(caras.read_text(encoding="utf-8")).get("rango") or [0, 0]
            if medido[0] - 0.6 <= desde and hasta <= medido[1] + 0.6:
                return
        except (json.JSONDecodeError, TypeError, IndexError):
            pass  # JSON roto o sin `rango`: se vuelve a medir.
    reloj.paso("detectando caras para el reencuadre…")
    try:
        subprocess.run([sys.executable, "-I", "-B", "-X", "utf8", str(BASE / "detectar.py"),
                        str(fuente), "--desde", f"{desde:.2f}", "--hasta", f"{hasta:.2f}", "--fps", "3"],
                       check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    except (subprocess.CalledProcessError, OSError) as e:
        print(f"  no pude detectar caras ({(e.stderr or '') if hasattr(e, 'stderr') else e}): los clips «persona» salen centrados")


def corte_video(revision: Path, fuente: Path, c: dict, k: int, ancho: int, alto: int) -> Path:
    """
    El corte k ya en el formato pedido: `-ss`/`-to` sobre la fuente, reencuadre al cuadro, la tarjeta de gancho
    si la lleva (Archivo Black blanca, se apaga a los 2,5 s) y el audio a 48 kHz estéreo. Sin masterizar todavía.
    `reencuadre` del corte: `centrado` (cover + crop al centro, lo de siempre) o `difuminado` (el cuadro entero
    nítido sobre su propia copia ampliada y borrosa: no se corta nada del original, para videos que enseñan cosas).
    """
    salida = revision / f"corte-{k + 1:02d}-base.mp4"
    rotulo = ""
    if c.get("gancho"):
        txt = revision / f"gancho-{k + 1:02d}.txt"
        txt.write_text(str(c["gancho"]), encoding="utf-8")
        fuente_ttf = (BASE.parent / "assets" / "fonts" / FUENTE_GANCHO).as_posix().replace(":", "\\:")
        tam = round(ancho * 0.055)
        rotulo = (
            f"drawtext=fontfile='{fuente_ttf}':expansion=none:textfile='{txt.as_posix().replace(':', chr(92) + ':')}':"
            f"fontsize={tam}:fontcolor=white:borderw={max(2, round(tam * 0.06))}:bordercolor=black@0.85:"
            f"x=(w-text_w)/2:y=h*0.30:alpha='if(lt(t\\,2.5)\\,max(0\\,1-(t-2.2)/0.3)\\,0)'")
    modo = resolver_reencuadre(fuente, c)
    if modo == "persona":
        # La cámara sigue a quien habla: la trayectoria sale de las caras medidas por detectar.py
        # (`<fuente>.caras.json`, junto al video). Si no está o no se pudo medir, se cae a `centrado`.
        tray = trayectoria_persona(fuente, float(c["desde"]), float(c["hasta"]), ancho, alto)
        if tray is not None:
            vf = [f"{encuadre.expresiones(tray)},scale={ancho}:{alto}"]
            if rotulo:
                vf.append(rotulo)
            vf.append("format=yuv420p")
            filtro = ["-vf", ",".join(vf)]
            modo = "hecho"
    if modo == "difuminado":
        cadena = (f"split[bg][fg];"
                  f"[bg]scale={ancho}:{alto}:force_original_aspect_ratio=increase,crop={ancho}:{alto},boxblur=24[bgb];"
                  f"[fg]scale={ancho}:-2[fgs];"
                  f"[bgb][fgs]overlay=(W-w)/2:(H-h)*0.42[v0];"
                  f"[v0]{rotulo + ',' if rotulo else ''}format=yuv420p[vout]")
        filtro = ["-filter_complex", cadena, "-map", "[vout]", "-map", "0:a?"]
    elif modo != "hecho":
        vf = [f"scale={ancho}:{alto}:force_original_aspect_ratio=increase,crop={ancho}:{alto}"]
        if rotulo:
            vf.append(rotulo)
        vf.append("format=yuv420p")
        filtro = ["-vf", ",".join(vf)]
    dur = float(c["hasta"]) - float(c["desde"])
    ffmpeg("-ss", f"{float(c['desde']):.3f}", "-i", str(fuente), "-t", f"{dur:.3f}",
           *filtro, "-af", "aresample=48000,aformat=channel_layouts=stereo",
           *encoder_video(18), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(salida))
    return salida

def main() -> None:
    formato = formato_arg or "vertical"
    if formato not in FORMATOS:
        sys.exit('--formato es "vertical" u "horizontal".')
    # Los valores de las opciones no son argumentos sueltos: un nombre de más es un error del que llama.
    sueltos = {v for v in (_en, formato_arg, nombre_arg) if v}
    if [a for a in _args if not a.startswith("--") and a not in sueltos]:
        sys.exit(__doc__)
    revisa = "--revisa" in _args

    for f in ("cortes.json",):
        if not (PROYECTO / f).exists():
            sys.exit(f"✗ Falta {f} en la raíz del proyecto.")
    if malo := roto((PROYECTO / "cortes.json").read_text(encoding="utf-8")):
        sys.exit(f"✗ cortes.json tiene la codificación rota («{malo}»): UTF-8 leído como latin-1; reescríbelo en UTF-8.")

    datos, errores = leer_cortes()
    if datos.get("formato") and not formato_arg:
        formato = datos["formato"]
    if errores:
        sys.exit("✗ cortes.json:\n  " + "\n  ".join(errores))
    cortes = [c for c in (datos.get("cortes") or []) if isinstance(c, dict)]
    fuente = PROYECTO / str(datos.get("fuente", "")).strip()
    total_fuente = duracion(fuente)
    for k, c in enumerate(cortes):
        if float(c["hasta"]) > total_fuente + 0.5:
            sys.exit(f"✗ corte {k + 1}: `hasta` ({c['hasta']} s) pasa del final del video ({total_fuente:.1f} s)")
    if revisa:
        print(f"✓ cortes.json bien: {len(cortes)} cortes de {total_fuente:.0f} s de fuente")
        if formato == "vertical":
            # La portada vende el clip: en vertical conviene `portada_titulo` (el titular del tema) y `acento`
            # (su golpe de color). Sin ellos sale el gancho/el nombre y todo blanco — válido, pero genérico.
            sin_titulo = [k + 1 for k, c in enumerate(cortes) if not str(c.get("portada_titulo") or "").strip()]
            sin_acento = [k + 1 for k, c in enumerate(cortes) if not c.get("acento")]
            if sin_titulo:
                print(f"  · sin `portada_titulo` (la portada usa el gancho o el nombre): {', '.join(map(str, sin_titulo))}")
            if sin_acento:
                print(f"  · sin `acento` (portada blanca, subtítulos del estilo): {', '.join(map(str, sin_acento))}")
        return

    ancho, alto = FORMATOS[formato]
    reloj = Reloj(PROYECTO)
    revision = PROYECTO / "revision"
    revision.mkdir(exist_ok=True)
    (revision / "cortes").mkdir(exist_ok=True)
    out_dir = PROYECTO / "out" / "redes"
    out_dir.mkdir(parents=True, exist_ok=True)

    asegurar_caras(fuente, cortes, reloj, formato)

    hechos = []
    for k, c in enumerate(cortes):
        slug = str(c.get("nombre") or f"corte-{k + 1:02d}")
        final = out_dir / f"{k + 1}-{slug}.mp4"
        # Solo se salta el que ya está hecho DESPUÉS de sus fuentes: `cortes.json` y su `portada/<nombre>` si la hay.
        # Si alguna es más nueva (un gancho, un tiempo o la portada corregidos), ese clip se rehace solo.
        cambios = (PROYECTO / "cortes.json").stat().st_mtime
        for ext in ("png", "jpg"):
            port = PROYECTO / "portada" / f"{final.stem}.{ext}"
            if port.is_file():
                cambios = max(cambios, port.stat().st_mtime)
        if final.exists() and final.stat().st_mtime >= cambios:
            continue
        reloj.paso(f"corte {k + 1}/{len(cortes)} ({slug})…")
        base = corte_video(revision / "cortes", fuente, c, k, ancho, alto)

        # La voz a -14 LUFS (masterizar.mjs da WAV): entra al mp4 antes de subtitular, que copia el audio.
        # El norm va en out/redes/ con `_` delante: subtitulos.py corre ffmpeg con cwd=salida.parent y la entrada
        # debe estar junto a la salida; con `_` no cuenta como video terminado ni lo recoge la cola de redes.
        voz_wav = revision / "cortes" / f"corte-{k + 1:02d}-voz.wav"
        # masterizar.mjs escribe el WAV y DESPUÉS exige −14 LUFS ±0,5 con pico ≤ −1 dBTP: en mezclas muy
        # dinámicas (música en vivo, público) puede quedar a ~0,6 LU y salir con error aunque el audio ya
        # esté masterizado. Si el WAV existe, el clip sigue con ese audio; solo cae si no se escribió nada.
        r_master = subprocess.run(["node", str(BASE / "masterizar.mjs"), str(base), str(voz_wav)],
                                  capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r_master.returncode:
            if not voz_wav.is_file():
                sys.stderr.write(r_master.stdout + r_master.stderr)
                sys.exit(f"masterizar.mjs falló en el corte {k + 1} ({slug})")
            print(f"  {slug}: el master quedó a ~0,5 LU del objetivo (mezcla muy dinámica) — sale con ese audio")
        norm = out_dir / f"_corte-{k + 1:02d}-{slug}.mp4"
        ffmpeg("-i", str(base), "-i", str(voz_wav), "-map", "0:v", "-map", "1:a",
               "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(norm))

        estilo_subs = str(c.get("subtitulos") or "minimal")
        if estilo_subs == "ninguno":
            # La fuente ya trae sus subtítulos quemados (o el clip no los quiere): sale con el audio normalizado.
            import shutil
            shutil.copyfile(norm, final)
            print(f"  {slug}: sin subtítulos propios — sale con los de la fuente")
        else:
            reloj.paso(f"subtítulos {slug}…")
            cmd_subs = [sys.executable, "-I", "-B", "-X", "utf8", str(BASE / "subtitulos.py"),
                        str(norm), str(final), "--estilo", estilo_subs, "--formato", formato]
            acento = acento_hex(c)
            if acento:
                cmd_subs += ["--acento", acento]
            r = subprocess.run(cmd_subs, capture_output=True, text=True,
                               encoding="utf-8", errors="replace")
            if r.returncode:
                if "no oyó voz" not in (r.stdout + r.stderr):
                    sys.stderr.write(r.stdout + r.stderr)
                    sys.exit(f"subtitulos.py falló en el corte {k + 1} ({slug})")
                # Un clip sin voz (música, ambiente) no lleva karaoke: sale sin subtítulos, ya normalizado.
                import shutil
                shutil.copyfile(norm, final)
                print(f"  {slug}: sin voz que transcribir — sale sin subtítulos")

        # La portada del clip en vertical (PORTADA.md de video-base): la suya en `portada/<archivo>.png`, la
        # compartida del proyecto (`portada.png`, `public/portada.png`, `portada/portada.*`), o una generada del
        # propio clip con su gancho de título. En horizontal no entra: la suya es la miniatura de YouTube.
        if alto > ancho:
            propia = next((PROYECTO / p for p in [f"portada/{final.stem}.png", f"portada/{final.stem}.jpg",
                                                  "portada.png", "public/portada.png",
                                                  "portada/portada.png", "portada/portada.jpg"]
                           if (PROYECTO / p).is_file()), None)
            if propia is None:
                # El título de la portada: `portada_titulo` (2 a 5 palabras) o el gancho limpio; la letra es la
                # del propio clip (Archivo Black, la de la tarjeta de gancho), no la Arial Black por defecto.
                titulo = (titulo_portada(c.get("portada_titulo") or "")
                          or titulo_portada(str(c.get("gancho") or ""))
                          or slug.replace("-", " "))
                portada_dir = PROYECTO / "portada"
                portada_dir.mkdir(exist_ok=True)
                gen = portada_dir / f"{final.stem}.png"
                try:
                    fuente_portada = (BASE.parent / "assets" / "fonts"
                                      / PORTADA_FUENTES[str(c.get("portada_fuente") or "archivo").strip().lower()])
                    cmd_portada = ["node", str(BASE / "portada_sin_ia.mjs"), str(final), str(gen),
                                   "--titulo", titulo, "--fuente", str(fuente_portada)]
                    acento = acento_hex(c)
                    if acento:
                        cmd_portada += ["--color", acento]
                    if c.get("portada_resaltar"):
                        cmd_portada += ["--resaltar", str(c["portada_resaltar"]).strip()]
                    subprocess.run(cmd_portada, check=True, capture_output=True)
                    propia = gen if gen.is_file() else None
                except subprocess.CalledProcessError as e:
                    detalle = (e.stderr or b"").decode("utf-8", "replace").strip().splitlines()
                    print(f"  {slug}: la portada automática no salió ({detalle[-1] if detalle else e}) — el clip va sin ella")
            if propia:
                subprocess.run(["node", str(BASE / "portada.mjs"), str(final), str(propia)], check=False)

        # La hoja de ese clip para mirarlo de un vistazo
        hoja_png = hoja(final, revision / f"hoja-{k + 1:02d}-{slug}.png")
        hechos.append((final, hoja_png))

    for final, hoja_png in hechos:
        reloj.listo(final, [hoja_png])


if __name__ == "__main__":
    main()
