"""
Crea el proyecto de un «Video con tu material», en `<nombre>` (el de la línea `Carpeta:` de Hermit):

    python -I -B -X utf8 <skill>/scripts/nuevo.py <nombre> [--horizontal]

Sin `--horizontal` el video es vertical (1080×1920, TikTok, Reels y Shorts); con él, horizontal
(1920×1080, YouTube): lo dice la línea `Formato:` del mensaje.

Va en el directorio actual (Hermit lanza la card en `trabajo/video-propio`, y su panel de etapas busca ahí la
carpeta). Deja:

  package.json, src/                      la plantilla: Remotion dibuja src/montaje.json, que escribe hacer.py
  public/assets/fonts/                   Archivo Black y Varela Round, las del estilo
  fuentes/                               aquí van los archivos del usuario (fotos, videos, música, voz)
  public/media/                          lo que prepare hacer.py, ya medido para el formato
  public/assets/music/                   la canción del usuario, si la hay
  out/  revision/  work/
  node_modules                           un enlace al que comparten todos los videos de este estilo (espacio.py)
"""

import json
import shutil
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
# Los demás scripts de la skill buscan video-base por HERMIT_SKILLS: que sea la de esta copia.
import os
os.environ.setdefault("HERMIT_SKILLS", str(SKILL.parent))
sys.path.insert(0, str(SKILL.parent / "video-base" / "scripts"))
from espacio import enlazar_modulos  # noqa: E402

FUENTES = SKILL.parent / "video-base" / "assets" / "fonts"
TIPOGRAFIAS = ["ArchivoBlack-Regular.ttf", "VarelaRound-Regular.ttf"]


def modulos(destino: Path) -> None:
    """node_modules: un enlace al que comparten todos los videos de este estilo."""
    vecinos = [p for p in destino.parent.glob("*/node_modules") if p.parent != destino]
    enlazar_modulos(destino, "video-propio", SKILL / "plantilla", vecinos)


def crear(destino: Path, horizontal: bool) -> None:
    shutil.copytree(SKILL / "plantilla", destino, ignore=shutil.ignore_patterns("__pycache__", "node_modules"))
    (destino / "formato.txt").write_text("horizontal\n" if horizontal else "vertical\n", encoding="utf-8")
    m = destino / "src" / "montaje.json"
    d = json.loads(m.read_text(encoding="utf-8"))
    if horizontal:
        d["ancho"], d["alto"] = 1920, 1080
    m.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    fonts = destino / "public" / "assets" / "fonts"
    fonts.mkdir(parents=True, exist_ok=True)
    for f in TIPOGRAFIAS:
        shutil.copy(FUENTES / f, fonts / f)
    for d in ("fuentes", "public/media", "public/assets/music", "out", "revision", "work"):
        (destino / d).mkdir(parents=True, exist_ok=True)
    modulos(destino)


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--horizontal"]
    horizontal = "--horizontal" in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    nombre = args[0]
    aqui = Path.cwd()
    # Dentro de un proyecto (tiene package.json), junto a él: si no, saldría un video dentro de otro.
    if (aqui / "package.json").exists():
        aqui = aqui.parent
    destino = aqui / nombre
    if destino.exists():
        sys.exit(f"{destino} ya existe: usa otro nombre.")
    crear(destino, horizontal)
    print(f"listo: {destino}")


if __name__ == "__main__":
    main()
