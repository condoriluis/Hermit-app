"""comp.py — La edición de video-reddit como JSON para Remotion.

El director (`components/director.py`) arma las capas —fondo inmersivo, tarjeta inicial de Reddit
y subtítulos palabra por palabra— y las entradas como una línea de tiempo de GSAP.
`Comp.write` escribe `src/edicion.json` de forma atómica para el render de Remotion.
"""
import html as _html
import json
import os
from pathlib import Path

FPS = 30


def fr(t):
    return round(t * FPS) / FPS


def esc(s):
    return _html.escape(str(s), quote=True)


class Comp:
    def __init__(self, dur, ancho, alto, fps=FPS, cid="reddit"):
        self.dur, self.ancho, self.alto, self.fps, self.cid = fr(dur), ancho, alto, fps, cid
        self.els, self.vids, self.js, self.pre, self.css, self.escenas = [], [], [], [], [], []
        self.n = 0

    def uid(self, p="e"):
        self.n += 1
        return f"{p}{self.n}"

    def clip(self, t0, t1, inner, z, cls="reddit-layer", style="", pieza="capa"):
        """Una capa de HTML (tarjeta, viñeta, subtítulo) visible entre t0 y t1."""
        cid = self.uid("c")
        self.els.append({
            "id": cid,
            "f0": round(t0 * self.fps),
            "f1": round(t1 * self.fps),
            "z": z,
            "cls": cls,
            "style": style,
            "html": inner,
            "pieza": pieza,
        })
        return cid

    def video(self, t0, t1, src, media_start_s=0.0, z=1, velocidad=1.0, style="", pieza="fondo"):
        """Un clip de video para el fondo continuo."""
        vid = self.uid("v")
        self.vids.append({
            "id": vid,
            "f0": round(t0 * self.fps),
            "f1": round(t1 * self.fps),
            "z": z,
            "cls": "reddit-layer",
            "style": style,
            "src": src,
            "desde": round(media_start_s * self.fps),
            "velocidad": velocidad if velocidad and velocidad != 1 else None,
            "pieza": pieza,
        })
        return vid

    def escena(self, nombre, t0, t1):
        """Una escena o hito cronometrado en la composición."""
        self.escenas.append({"nombre": nombre, "f0": round(t0 * self.fps), "f1": round(t1 * self.fps)})

    def at(self, line):
        self.js.append(line)

    def write(self, path="src/edicion.json", tokens="public/assets/reddit/tokens.css", audio=None, title="Reddit",
              sonido=None):
        """Escribe la edición completa para Remotion. `sonido`: las pistas por separado del monitor en
        vivo y la línea de tiempo (la voz, la música y cada efecto)."""
        archivo = Path("public") / audio if audio else None
        audio_src = f"{audio}?v={int(archivo.stat().st_mtime)}" if archivo and archivo.exists() else None
        tokens_css = Path(tokens).read_text(encoding="utf-8") if Path(tokens).exists() else ""
        doc = {
            "titulo": title,
            "fps": self.fps,
            "ancho": self.ancho,
            "alto": self.alto,
            "duracion": round(self.dur * self.fps),
            "css": tokens_css + "\n" + "\n".join(self.css),
            "clips": self.els,
            "videos": self.vids,
            "pre": "\n".join(self.pre),
            "js": "\n".join(self.js),
            "escenas": sorted(self.escenas, key=lambda e: e["f0"]),
            "audio": audio_src,
        }
        if sonido:
            doc["sonido"] = sonido
        with open(path + ".tmp", "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        os.replace(path + ".tmp", path)

