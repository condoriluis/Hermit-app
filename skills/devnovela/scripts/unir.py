"""
Une los clips de una devnovela en el video final. El montaje es de video-base: este archivo solo le pasa `--estilo`.
Se corre desde la raíz del proyecto (o con `--en <carpeta>`, la ruta de `Carpeta:`):

    python <skill>/scripts/unir.py <nombre> [--en <carpeta>] [--formato vertical|horizontal] [--duracion 30|45|1:30|2 min]
        [--sin-subtitulos] [--sin-recortar] [--forzar]
"""

import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent / "video-base" / "scripts"
sys.exit(subprocess.run([sys.executable, str(BASE / "unir.py"), *sys.argv[1:], "--estilo", "devnovela"]).returncode)
