"""
Crea el proyecto de un video motivacional, en `<nombre>` (el de la línea `Carpeta:` de Hermit):

    python -I -B -X utf8 <skill>/scripts/nuevo.py <nombre> [--vertical]

El video no nace de una grabación: la voz se genera después (VOZ.md) y el montaje lo declara `escenas.json`.
Deja:

  package.json, src/, remotion.config.ts, tsconfig.json   la plantilla: Remotion dibuja src/edicion.json, que
                                                        escribe el director (hacer.py)
  public/assets/motivacional/                            tokens.css y fonts/, las del estilo
  fuentes/material/   public/material/                   el material con licencia y sus enlaces para el render
  public/   work/   out/   revision/
  node_modules                                            un enlace al que comparten todos los proyectos (espacio.py)

`--vertical` (el mensaje trae `Formato: vertical`): el cuadro de la edición es 1080x1920; sin él, 1920x1080. El
`formato` de escenas.json y `--formato` de hacer.py mandan igual: el director reescribe las medidas al armar.

Va en el directorio actual (Hermit lanza la card en `trabajo/video-motivacional`, y su panel de etapas busca ahí la
carpeta); dentro de un proyecto, junto a él.
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


def modulos(destino: Path) -> None:
    """node_modules: un enlace al que comparten todos los proyectos. La primera vez sale del de otro proyecto viejo."""
    vecinos = [p for p in destino.parent.glob("*/node_modules") if p.parent != destino]
    enlazar_modulos(destino, "video-motivacional", SKILL / "plantilla", vecinos)


def crear(destino: Path, vertical: bool = False) -> None:
    """La plantilla, las fuentes del estilo, las carpetas y node_modules. En vertical, el cuadro de 1080x1920."""
    shutil.copytree(SKILL / "plantilla", destino, ignore=shutil.ignore_patterns("__pycache__", "node_modules"))
    if vertical:
        e = destino / "src" / "edicion.json"
        d = json.loads(e.read_text(encoding="utf-8"))
        d["ancho"], d["alto"] = 1080, 1920
        e.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    mot = destino / "public" / "assets" / "motivacional"
    shutil.copytree(SKILL / "assets" / "fonts", mot / "fonts")
    shutil.copy(SKILL / "assets" / "tokens.css", mot)
    for d in ("fuentes/material", "public/material", "work", "out", "revision"):
        (destino / d).mkdir(parents=True, exist_ok=True)
    modulos(destino)


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--vertical"]
    vertical = "--vertical" in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    nombre = args[0]
    aqui = Path.cwd()
    # Dentro de un proyecto (tiene package.json), junto a él: si no, saldría un video dentro de otro.
    if (aqui / "package.json").exists():
        aqui = aqui.parent
    destino = aqui / nombre
    if destino.exists():
        sys.exit(f"{destino} ya existe: usa otro nombre (puede ser de otra sesión haciendo el mismo video).")
    crear(destino, vertical)
    print(f"listo: {destino}\nSigue: fuentes/tema.md, guion.md, escenas.json y la voz (VOZ.md), y hacer.py")


if __name__ == "__main__":
    main()
