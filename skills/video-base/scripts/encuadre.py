"""
La trayectoria del reencuadre inteligente: a partir de las caras que midió `detectar.py` (`<video>.caras.json`),
dice a cada instante del corte dónde va la ventana de crop para que la persona quede encuadrada — con zona
muerta (no sigue cada temblor) y paneos de velocidad limitada (nada de persecución nerviosa). No detecta ni
renderiza: convierte cajas en una trayectoria suave que `hacer.py` de `video-clips` mete en el `crop` de ffmpeg
(que evalúa `x`/`y` por fotograma con `t`).

    python -B encuadre.py <video.mp4> --desde S --hasta S --ancho 1080 --alto 1920 [--carpeta DIR] [--json salida.json] [--ffmpeg]

`--json` guarda la trayectoria `{"w","h","eje","t","x","y"}` y `--ffmpeg` imprime el `crop=w:h:x='…':y='…'`
listo para el filtro. Como script también sirve de librería (`trayectoria()`, `expresiones()`) para `hacer.py`.

Reglas:
- La ventana es la del cover (mismo aspecto que el formato): en fuente 16:9 → vertical panea en X con todo el
  alto; en fuente vertical → horizontal panea en Y con todo el ancho.
- Cara principal: la de mayor alto en cada muestra (el que habla suele ser el más grande), y su centro se
  suaviza con media móvil para que el pulso del detector no mueva la cámara.
- Zona muerta del 22 % del tamaño de la ventana a cada lado del centro: dentro no se mueve la cámara.
- Al violarla, el objetivo es la cara CENTRADA en la ventana, a velocidad máxima de paneo: cuando la cámara
  se mueve, lo hace decidido y se queda con la persona en el medio.
- Muestras sin cara: la cámara se queda donde estaba.
- Los tiempos `t` de la trayectoria son segundos DEL CORTE (el `t` del crop de ffmpeg arranca en 0 tras -ss).
"""

import argparse
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ZONA = 0.22          # semi-tamaño de la zona muerta, fracción de la ventana
VELOCIDAD = 1.2      # paneo máximo, fracciones de ventana por segundo
PASO = 0.5           # segundos entre puntos de la trayectoria
ALFA = 0.4           # peso de la muestra nueva en la media móvil del centro de la cara


def ventana(src_w: int, src_h: int, dst_w: int, dst_h: int) -> tuple[int, int, str]:
    """La ventana de crop con el aspecto del formato, lo grande que cabe en la fuente: (w, h, eje que panea)."""
    if src_w / src_h > dst_w / dst_h:
        h = src_h
        w = int(round(h * dst_w / dst_h))
        w -= w % 2
        return w, h, "x"
    w = src_w
    h = int(round(w * dst_h / dst_w))
    h -= h % 2
    return w, h, "y"


def trayectoria(datos: dict, desde: float, hasta: float, dst_w: int, dst_h: int) -> dict | None:
    """La ventana en el tiempo, en coordenadas de la fuente y segundos del corte. None si no recorta."""
    src_w, src_h = int(datos["ancho"]), int(datos["alto"])
    cw, ch, eje = ventana(src_w, src_h, dst_w, dst_h)
    max_x, max_y = src_w - cw, src_h - ch
    if max_x <= 0 and max_y <= 0:
        return None
    dur = hasta - desde
    ts = [round(i * PASO, 3) for i in range(max(1, int(dur / PASO) + 1))]
    if ts[-1] < dur - 1e-6:
        ts.append(round(dur, 3))

    # La cara principal de cada muestra: la de mayor alto (la que habla suele ser la más grande).
    crudas = {}
    for m in datos.get("muestras", []):
        if desde - 0.01 <= m["t"] <= hasta + 0.01 and m["caras"]:
            c = max(m["caras"], key=lambda c: c["h"])
            crudas[round(m["t"] - desde, 2)] = (c["x"] + c["w"] / 2, c["y"] + c["h"] / 2)
    # Media móvil del centro: el detector tiembla unos píxeles entre muestras y eso mareaba la cámara.
    caras, sx = {}, None
    for t in sorted(crudas):
        x, y = crudas[t]
        sx = (x, y) if sx is None else (sx[0] + ALFA * (x - sx[0]), sx[1] + ALFA * (y - sx[1]))
        caras[t] = sx
    tiempos = sorted(caras)

    def cara_en(t: float):
        if not tiempos:
            return None
        return caras[min(tiempos, key=lambda s: abs(s - t))]

    pos = {"x": max_x / 2, "y": max_y / 2}
    tray = {"w": cw, "h": ch, "eje": eje, "t": ts, "x": [], "y": []}
    tope = {"x": (cw, max_x), "y": (ch, max_y)}
    for t in ts:
        cara = cara_en(t)
        for e in ("x", "y"):
            dim, tope_e = tope[e]
            tray[e].append(round(pos[e], 2))
            if tope_e <= 0 or e != eje or cara is None:
                continue
            fc = cara[0] if e == "x" else cara[1]
            rel = fc - (pos[e] + dim / 2)
            if abs(rel) > dim * ZONA:
                # Objetivo: la cara centrada en la ventana (topeada por los bordes de la fuente).
                objetivo = min(max(fc - dim / 2, 0), tope_e)
                vmax_e = VELOCIDAD * dim
                pos[e] = min(max(pos[e] + min(max(objetivo - pos[e], -vmax_e * PASO), vmax_e * PASO), 0), tope_e)
    return tray


def cobertura(datos: dict, desde: float, hasta: float) -> dict:
    """Cuánto de la cara hay en el tramo, para que `hacer.py` decida el `reencuadre: "auto"`:
    - `muestras`: cuántas caen en el tramo; `con_cara`: las que tienen al menos una cara;
    - `grandes`: las que tienen una cara de más del 15 % del alto de la fuente (un primer plano que se ve);
    - `chica`/`score` para el diagnóstico. La regla del auto: ≥50 % de muestras con cara grande → «persona»,
    si no → «difuminado» (pantallas, tablas o presentador lejano: recortar perdería contenido)."""
    alto = float(datos.get("alto") or 0)
    mias = [m for m in datos.get("muestras", []) if desde - 0.01 <= m["t"] <= hasta + 0.01]
    con = [m for m in mias if m["caras"]]
    grandes = [m for m in con if any(c["h"] > 0.15 * alto for c in m["caras"])]
    return {"muestras": len(mias), "con_cara": len(con), "grandes": len(grandes),
            "cobertura": round(len(grandes) / len(mias), 3) if mias else 0.0}


def _expr(tray: dict, eje: str) -> str:
    """`x(t)`/`y(t)` de ffmpeg: lineal entre puntos, constante fuera del rango. Solo viajan los puntos donde
    la posición cambia o cada ~2 s (los cambios mandan; lo demás es mantener la cámara quieta)."""
    ts, vs = tray["t"], tray[eje]
    pts = [(ts[0], vs[0])]
    for i in range(1, len(ts)):
        if abs(vs[i] - pts[-1][1]) > 1 or ts[i] - pts[-1][0] >= 2 or i == len(ts) - 1:
            pts.append((ts[i], vs[i]))
    expr = f"{pts[-1][1]:.2f}"
    for i in range(len(pts) - 1, 0, -1):
        (t0, v0), (t1, v1) = pts[i - 1], pts[i]
        expr = (f"if(lt(t\\,{t1:.2f})\\,{v0:.2f}+({v1 - v0:.2f})*(t-{t0:.2f})/{max(t1 - t0, 1e-3):.2f}"
                f"\\,{expr})")
    return expr


def expresiones(tray: dict) -> str:
    """El trozo de filtro listo: `crop=W:H:x='…':y='…'`. En el eje fijo va el centro, como el crop de siempre."""
    if tray["eje"] == "x":
        return f"crop={tray['w']}:{tray['h']}:x='{_expr(tray, 'x')}':y='(in_h-out_h)/2'"
    return f"crop={tray['w']}:{tray['h']}:x='(in_w-out_w)/2':y='{_expr(tray, 'y')}'"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("video", type=Path)
    p.add_argument("--desde", type=float, required=True)
    p.add_argument("--hasta", type=float, required=True)
    p.add_argument("--ancho", type=int, required=True, help="ancho del formato de salida")
    p.add_argument("--alto", type=int, required=True, help="alto del formato de salida")
    p.add_argument("--carpeta", type=Path, help="dónde está <video>.caras.json (por defecto, junto al video)")
    p.add_argument("--json", type=Path, help="dónde guardar la trayectoria")
    p.add_argument("--ffmpeg", action="store_true", help="imprime la expresión crop lista para ffmpeg")
    a = p.parse_args()

    caras = (a.carpeta / (a.video.stem + ".caras.json")) if a.carpeta else a.video.with_suffix(".caras.json")
    if not caras.is_file():
        sys.exit(f"✗ No está {caras}: corre antes detectar.py sobre ese tramo del video.")
    datos = json.loads(caras.read_text(encoding="utf-8"))
    tray = trayectoria(datos, a.desde, a.hasta, a.ancho, a.alto)
    if tray is None:
        sys.exit("El aspecto del formato no recorta la fuente: no hace falta reencuadre.")

    eje = tray["eje"]
    mov = sum(1 for i in range(1, len(tray["t"])) if tray[eje][i] != tray[eje][i - 1])
    print(f"✓ ventana {tray['w']}x{tray['h']} paneando en {eje.upper()} · {len(tray['t'])} puntos · {mov} con movimiento")
    dim = tray["w"] if eje == "x" else tray["h"]
    print(f"  recorrido {min(tray[eje]):.0f}–{max(tray[eje]):.0f} px (ventana de {dim} en fuente de {datos['ancho']}x{datos['alto']})")
    if a.json:
        a.json.write_text(json.dumps(tray, ensure_ascii=False), encoding="utf-8")
        print(f"  → {a.json}")
    if a.ffmpeg:
        print(expresiones(tray))


if __name__ == "__main__":
    main()
