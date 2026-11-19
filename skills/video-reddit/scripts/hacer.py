"""
El video de historia de Reddit, del proyecto a `out/reddit-<nombre>.mp4`, con el contrato del motor
(`../video-base/MOTOR.md`):

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal]

`--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit; sin ella, el directorio actual.

Lo que el agente deja en el proyecto:
- `guion.md` y `fuentes/tema/post.json` (la historia).
- `public/voz.wav` (o `voz.wav`) y `public/musica.mp3` (opcional).
- `public/reddit_card.png` (opcional: la tarjeta del post de los primeros segundos).
- El fondo, de una de dos formas:
  - `material.json` con `{"fondo": "<referencia>"}` — se baja aquí con su licencia anotada (`../video-base/MATERIAL.md`:
    `mixkit:`, `archive:`, `commons:`, `nasa:`, `yt:` o una URL de video). Es la forma recomendada: la referencia la
    da `video-documental/scripts/buscar.py` y la licencia queda en `FUENTES.md`.
  - `public/fondo.mp4` ya puesto (lo bajó el agente a mano o lo dio el usuario): se usa tal cual.

`--revisa` valida todo en un segundo y sin red ni voz: que estén la voz, el fondo (archivo o referencia bien
formada), la forma del `material.json` y el formato. El montaje en sí lo hace `montar.py` (transcripción palabra
por palabra, subtítulos, tarjeta, música y master); aquí se cronometra cada paso en `revision/tiempos.json`.
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
from bancos import Falla, bajar_a, resolver  # noqa: E402
from momentos import Reloj  # noqa: E402

_args = sys.argv[1:]
_en = _args[_args.index("--en") + 1] if "--en" in _args[:-1] else ""
REVISAR = "--revisa" in _args
_fmt = next((a.split("=", 1)[1] for a in _args if a.startswith("--formato=")), "")
if not _fmt and "--formato" in _args[:-1]:
    _fmt = _args[_args.index("--formato") + 1]
PROYECTO = Path(_en).resolve() if _en else Path.cwd()
# La carpeta de las skills no es un proyecto: el video no lo vería nadie.
if PROYECTO == SKILL.parent or SKILL.parent in PROYECTO.parents:
    sys.exit(f"{PROYECTO} es la carpeta de las skills: pasa la ruta completa de la línea `Carpeta:`.")
FORMATO = _fmt or "vertical"
if FORMATO not in ("vertical", "horizontal"):
    sys.exit(f"formato «{FORMATO}» no existe: vertical u horizontal")

REFERENCIAS = ("mixkit:", "archive:", "commons:", "nasa:", "yt:")
REF_VIDEO = re.compile(r"^https?://\S+\.(mp4|webm|mov|m4v)(\?|$)", re.I)


def primer(*partes: str) -> Path | None:
    return next((PROYECTO / p for p in partes if (PROYECTO / p).exists()), None)


def leer_material() -> tuple[dict, list[str]]:
    """`material.json` del proyecto y lo que está mal en él, todo junto."""
    archivo = PROYECTO / "material.json"
    if not archivo.exists():
        return {}, []
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except ValueError as e:
        return {}, [f"material.json no es un JSON válido ({e})"]
    if not isinstance(datos, dict):
        return {}, ["material.json lleva un objeto: {\"fondo\": \"mixkit:…\"}"]
    errores = [f"material.json: clave «{k}» que no va (solo `fondo`)" for k in datos if k != "fondo"]
    fondo = datos.get("fondo")
    if fondo is not None:
        if not isinstance(fondo, str) or not (fondo.startswith(REFERENCIAS) or REF_VIDEO.match(fondo)):
            errores.append(f"material.json: «{fondo}» no es una referencia de video (mixkit:, archive:, commons:, "
                           "nasa:, yt: o una URL .mp4/.webm; las da video-documental/scripts/buscar.py)")
        elif fondo.lower().startswith("commons:") and not re.search(r"\.(webm|mp4|mov|m4v|ogv)(\?|$)", fondo, re.I):
            errores.append(f"material.json: «{fondo}» es una imagen de Commons: el fondo pide un video "
                           "(commons:File:….webm)")
    return datos, errores


def revisar() -> list[str]:
    errores = []
    material, errores_material = leer_material()
    errores += errores_material
    if not primer("public/voz.wav", "voz.wav"):
        errores.append("falta la voz: public/voz.wav (o voz.wav)")
    if "fondo" not in material and not primer("public/fondo.mp4", "fondo.mp4"):
        errores.append("falta el fondo: material.json con {\"fondo\": \"<referencia>\"} o public/fondo.mp4 "
                       "(referencias en ../video-base/MATERIAL.md)")
    if not primer("guion.md"):
        errores.append("falta guion.md")
    return errores


def traer_fondo(material: dict, reloj: Reloj) -> None:
    """Baja el fondo que pide `material.json`, una vez por URL; anota su licencia en FUENTES.md."""
    ref = str(material.get("fondo") or "")
    if not ref:
        return
    reloj.paso(f"fondo: {ref}")
    try:
        origen = resolver("clip", ref)
    except Falla as e:
        sys.exit(f"✗ fondo: {e}")
    destino = PROYECTO / "public" / "fondo.mp4"
    sello = PROYECTO / "work" / "fondo.json"
    try:
        previo = json.loads(sello.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        previo = {}
    if previo.get("url") == origen["url"] and destino.exists():
        print("  el fondo ya está bajado: no se repite")
    else:
        destino.parent.mkdir(parents=True, exist_ok=True)
        try:
            bajar_a(origen["url"], destino)
        except Falla as e:
            sys.exit(f"✗ fondo: {e}")
        sello.parent.mkdir(parents=True, exist_ok=True)
        sello.write_text(json.dumps({"ref": ref, "url": origen["url"]}, ensure_ascii=False), encoding="utf-8")
    fuentes = ["# Fuentes", "",
               "| Archivo | Fuente | Licencia | Revisar derechos |", "|---|---|---|---|"]
    fuentes.append(f"| `public/fondo.mp4` | {origen.get('pagina', ref)} | {origen.get('licencia', '')} | "
                   f"{origen.get('revisar') or '—'} |")
    (PROYECTO / "FUENTES.md").write_text("\n".join(fuentes) + "\n", encoding="utf-8")
    if origen.get("revisar"):
        print(f"  OJO: {origen['revisar']}")


def main() -> None:
    if REVISAR:
        errores = revisar()
        if errores:
            for e in errores:
                print(f"✗ {e}")
            sys.exit(1)
        print("✓ revisión: el proyecto está completo")
        return

    errores = revisar()
    if errores:
        for e in errores:
            print(f"✗ {e}")
        sys.exit("arréglalo y repite (o corre con --revisa para ver todo junto)")

    material, _ = leer_material()
    reloj = Reloj(PROYECTO)
    traer_fondo(material, reloj)

    reloj.paso("montaje (voz a subtítulos, tarjeta, música, master)")
    r = subprocess.run([sys.executable, "-I", "-B", "-X", "utf8", str(SKILL / "scripts" / "montar.py"),
                        str(PROYECTO), f"--formato={FORMATO}"], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    print(r.stdout, end="")
    if r.returncode:
        print(r.stderr, end="", file=sys.stderr)
        sys.exit(f"montar.py falló ({r.returncode}): arréglalo y repite — la voz y el fondo no se vuelven a bajar")

    nombre = PROYECTO.name if PROYECTO.name.startswith("reddit-") else f"reddit-{PROYECTO.name}"
    video = PROYECTO / "out" / f"{nombre}.mp4"
    if not video.exists():
        sys.exit(f"montar.py no dejó {video}")

    reloj.paso("hoja de revisión")
    revision = PROYECTO / "revision"
    revision.mkdir(exist_ok=True)
    hoja = revision / "hoja.png"
    subprocess.run(["node", str(BASE / "hoja.mjs"), str(video), str(hoja)], check=True)
    reloj.listo(video, [hoja])


if __name__ == "__main__":
    main()
