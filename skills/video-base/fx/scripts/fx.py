#!/usr/bin/env python3
"""fx.py — trae el kit de efectos al proyecto del video.

    python -B -X utf8 <video-base>/fx/scripts/fx.py traer

Copia `fx/src/` a `src/fx/` del proyecto (sobreescribe: el kit manda sobre la copia
vieja, como las versiones nuevas de modelos-3d) e imprime el import para la plantilla:

    import { Empuje, GlitchCorte, Shake } from "./fx";

Se corre en la carpeta del proyecto, igual que `modelos.py usar`.
"""
import shutil
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent          # skills/video-base/fx
SRC = BASE / "src"


def traer(proyecto: Path) -> None:
    destino = proyecto / "src" / "fx"
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(SRC, destino)
    n = len(list(destino.rglob("*.tsx"))) + len(list(destino.rglob("*.ts")))
    print(f"fx copiado a src/fx/ ({n} archivos). En la plantilla:")
    print('  import { Empuje, GlitchCorte, Shake } from "./fx";')
    print("  (desde src/Root.tsx o donde viva el componente principal: './fx'; desde src/escenas/: '../fx')")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] != "traer":
        sys.exit(__doc__)
    traer(Path.cwd())


if __name__ == "__main__":
    main()
