"""comp.py — la edición del top como JSON para Remotion, sin que nadie escriba un `build.py`.

El director (`components/director.py`) arma las capas —un tramo de material por cada cosa de la escena y los textos
del puesto— y las entradas como una línea de tiempo de GSAP. `Comp.write` deja `src/edicion.json`, que dibuja
`plantilla/src/Top.tsx` (la misma arquitectura que el documental: capas con su tramo de cuadros, `tl.seek` por
cuadro, clips con `OffthreadVideo` en vivo y como `_cuadros/` en el render final).

Lo usan desde la raíz del proyecto:

    from comp import Comp
    c = Comp(duracion_s, ancho, alto)
    c.clip(t0, t1, '<div class="top-fill"><img …></div>', z=1)
    c.at('tl.fromTo("#x", …);')
    c.write('src/edicion.json', tokens='public/assets/top/tokens.css', audio='sonido.wav')
"""
import html as _html
import json
import os
import sys
from pathlib import Path

FPS = 30


def fr(t):            # snap seconds to the frame grid
    return round(t * FPS) / FPS


def dstr(t0, t1):     # clip duration floored so the renderer's ceil gives exactly the frame count
    n = round(t1 * FPS) - round(t0 * FPS)
    return f"{int(n / FPS * 1e4) / 1e4:.4f}"


def esc(s):
    return _html.escape(str(s), quote=True)


class Comp:
    def __init__(self, dur, ancho, alto, fps=FPS, cid="top"):
        self.dur, self.ancho, self.alto, self.fps, self.cid = fr(dur), ancho, alto, fps, cid
        self.els, self.vids, self.js, self.pre, self.css, self.escenas = [], [], [], [], [], []
        self.n = 0

    def uid(self, p="e"):
        self.n += 1
        return f"{p}{self.n}"

    def clip(self, t0, t1, inner, z, cls="top-layer", style="", pieza="capa"):
        """Una capa de HTML (texto, foto con paneo) visible entre t0 y t1."""
        cid = self.uid("c")
        self.els.append({"id": cid, "f0": round(t0 * self.fps), "f1": round(t1 * self.fps), "z": z,
                         "cls": cls, "style": style, "html": inner, "pieza": pieza})
        return cid

    def video(self, t0, t1, src, media_start_s, z, velocidad=1.0, style="", pieza="material"):
        """Un clip de video: `src` relativo a public/, `media_start_s` el segundo de entrada, `velocidad` su
        cámara lenta/apuro (0.6 = lenta, como `velocidad` de top.json)."""
        vid = self.uid("v")
        self.vids.append({"id": vid, "f0": round(t0 * self.fps), "f1": round(t1 * self.fps), "z": z,
                          "cls": "top-layer", "style": style, "src": src,
                          "desde": round(media_start_s * self.fps),
                          "velocidad": velocidad if velocidad and velocidad != 1 else None,
                          "pieza": pieza})
        return vid

    def escena(self, nombre, t0, t1):
        """Una línea del top en el tiempo: una escena del estudio de Hermit (para saltar o citar)."""
        self.escenas.append({"nombre": nombre, "f0": round(t0 * self.fps), "f1": round(t1 * self.fps)})

    def at(self, line):
        self.js.append(line)

    def write(self, path="src/edicion.json", tokens="public/assets/top/tokens.css", audio=None, title="Top"):
        """La edición para Remotion (`src/Top.tsx`). `audio`: el sonido entero relativo a public/, con `?v=` de su
        fecha para que el monitor en vivo lo vuelva a pedir cuando cambia."""
        archivo = Path("public") / audio if audio else None
        audio = f"{audio}?v={int(archivo.stat().st_mtime)}" if archivo and archivo.exists() else None
        doc = {"titulo": title, "fps": self.fps, "ancho": self.ancho, "alto": self.alto,
               "duracion": round(self.dur * self.fps),
               "css": Path(tokens).read_text(encoding="utf-8") + "\n" + "\n".join(self.css),
               "clips": self.els, "videos": self.vids, "pre": "\n".join(self.pre), "js": "\n".join(self.js),
               "escenas": sorted(self.escenas, key=lambda e: e["f0"]), "audio": audio}
        # Temporal y reemplazo: el motor en vivo relee el archivo en cuanto cambia y no debe verlo a medias.
        with open(path + ".tmp", "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False)
        os.replace(path + ".tmp", path)
