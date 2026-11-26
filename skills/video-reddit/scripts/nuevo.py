"""
Crea el proyecto de un video de historia de Reddit en `<nombre>`:

    python -I -B -X utf8 <skill>/scripts/nuevo.py <nombre> [--vertical]

Deja:
  - plantilla Remotion (package.json, src/, remotion.config.ts, tsconfig.json).
  - public/assets/reddit/ con tokens.css y fonts/.
  - node_modules enlazado al compartido.
  - fuentes/, work/, out/, revision/.
  - post.json, guion.md y material.json iniciales.
"""
import json
import os
import shutil
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
os.environ.setdefault("HERMIT_SKILLS", str(SKILL.parent))
sys.path.insert(0, str(SKILL.parent / "video-base" / "scripts"))
from espacio import enlazar_modulos  # noqa: E402


def modulos(destino: Path) -> None:
    """Enlace a node_modules compartido entre proyectos Remotion."""
    vecinos = [p for p in destino.parent.glob("*/node_modules") if p.parent != destino]
    enlazar_modulos(destino, "video-reddit", SKILL / "plantilla", vecinos)


def crear(destino: Path, vertical: bool = True) -> None:
    shutil.copytree(SKILL / "plantilla", destino, ignore=shutil.ignore_patterns("__pycache__", "node_modules"))

    e = destino / "src" / "edicion.json"
    d = json.loads(e.read_text(encoding="utf-8"))
    d["ancho"], d["alto"] = (1080, 1920) if vertical else (1920, 1080)
    e.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")

    reddit_assets = destino / "public" / "assets" / "reddit"
    shutil.copytree(SKILL / "assets" / "fonts", reddit_assets / "fonts", dirs_exist_ok=True)
    shutil.copy(SKILL / "assets" / "tokens.css", reddit_assets / "tokens.css")

    for sub in ("fuentes/tema", "fuentes/voz", "public", "work", "out", "revision"):
        (destino / sub).mkdir(parents=True, exist_ok=True)

    post_init = {
        "subreddit": "r/AskReddit",
        "autor": "u/RedditUser",
        "tiempo": "hace 4 h",
        "titulo": "¿Cuál fue el momento en que te diste cuenta de que todo había cambiado?",
        "votos": "14.2k",
        "comentarios": "1.8k"
    }
    (destino / "post.json").write_text(json.dumps(post_init, ensure_ascii=False, indent=2), encoding="utf-8")

    guion_init = (
        f"# {post_init['titulo']}\n\n"
        "Esta es la historia de cómo un simple mensaje cambió todo para siempre.\n"
    )
    (destino / "guion.md").write_text(guion_init, encoding="utf-8")

    material_init = {
        "fondo": "mixkit:9024"
    }
    (destino / "material.json").write_text(json.dumps(material_init, ensure_ascii=False, indent=2), encoding="utf-8")

    modulos(destino)


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--vertical"]
    vertical = "--vertical" in sys.argv or "--horizontal" not in sys.argv
    if len(args) != 1 or args[0].startswith("-"):
        sys.exit(__doc__)
    nombre = args[0]
    aqui = Path.cwd()
    if (aqui / "package.json").exists():
        aqui = aqui.parent
    destino = aqui / nombre
    if destino.exists():
        sys.exit(f"{destino} ya existe: usa otro nombre.")
    crear(destino, vertical)
    print(f"✓ Listo: {destino}\nSigue: post.json, guion.md, material.json, la voz en fuentes/voz/, y hacer.py")


if __name__ == "__main__":
    main()

