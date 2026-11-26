"""director.py — de las escenas del video (`escenas.json` ya cronometado por `tiempos_de_escenas`) a la edición
entera.

El agente dice qué va en cada escena; el director pone lo demás con las medidas del formato, las mismas que usaba
el pipeline de ffmpeg: cada cosa del `material` ocupa su tramo en partes iguales —la foto con el paneo Ken Burns
centrado y alternando sentido (lo que `zoompan` hacía a z 1.0↔1.12 por tramo), el clip con su `desde` y su
`velocidad`—, el `look` de la escena (`bn`, `desaturado`, `color`) es el filtro CSS de su capa, lo que eran los
eq/hue encadenados al paneo; una escena sin `material` es la tarjeta de cita sobre fondo negro con el `titular`
en Bebas Neue. Los cortes son secos, como el concat de antes: el movimiento lo pone solo el paneo.

    armar(escenas_t, archivos, proyecto, ancho, alto, total)   →  src/edicion.json

`escenas_t` es la salida de `tiempos_de_escenas` (cada escena con `t0`, `t1`, `look`, `titular`, `material`);
`archivos[k]` son los archivos de su material, en el mismo orden (los deja `traer_items` de video-base). El sonido
(`public/sonido.wav`, la voz con los whoosh y los golpes de cita) lo pone hacer.py antes; aquí solo se apunta en
la edición.
"""
import json
import os
import shutil
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SKILL = AQUI.parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(SKILL.parent / "video-base" / "scripts"))
from comp import Comp, esc, fr  # noqa: E402
from tramos import desde_de, es_clip, velocidad_de  # noqa: E402
from subtitulos import linea  # noqa: E402

# El `look` de escenas.json como filtro CSS de la capa de material: el equivalente de los filtros ffmpeg del
# pipeline viejo (`bn`: gris + contraste; `desaturado`: el de serie —el de omisión—; `color`: sin tratar).
LOOKS = {
    "bn": "grayscale(1) contrast(1.15) brightness(0.98)",
    "desaturado": "saturate(0.45) contrast(1.2) brightness(0.96)",
    "color": "",
}
LOOK_POR_DEFECTO = "desaturado"
# La tarjeta de cita: la Bebas a 0,06 del ancho (65 px en 1080), como TAM_TARJETA del pipeline viejo.
TAM_TARJETA = 0.06


def material_public(proyecto: Path, archivo, k: int, j: int) -> str:
    """
    La ruta del material relativa a `public/`, que es lo único que Remotion sirve. Lo que ya está en public/ se usa
    tal cual; lo demás (las descargas de `fuentes/material/` y las rutas del proyecto) entra por enlace duro en
    `public/material/e<k>-<j>-<nombre>` — no ocupa disco y `fuentes/material/` sigue siendo la procedencia.
    """
    p = Path(archivo)
    if not p.is_absolute():
        p = proyecto / p
    pub = (proyecto / "public").resolve()
    try:
        return p.resolve().relative_to(pub).as_posix()
    except ValueError:
        pass
    destino_dir = proyecto / "public" / "material"
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / f"e{k + 1}-{j + 1}-{p.name}"
    if not destino.exists():
        try:
            os.link(p, destino)
        except OSError:
            shutil.copy2(p, destino)
    return f"material/{destino.name}"


def foto(c: Comp, t0: float, t1: float, src: str, k_global: int, style: str, z: int = 1):
    """
    Una foto a todo cuadro con el paneo Ken Burns del estilo: origen al centro y zoom lento que entra o sale
    (1.0↔1.12, alternando por tramo como el `k_tramo % 2` de `render_tramo`). El `<img>` va con un 2 % de
    margen para que el acercamiento nunca enseñe el borde; GSAP lo empuja a 30 fps, suave donde `zoompan`
    era escalonado.
    """
    iid = c.uid("img")
    s0, s1 = (1.0, 1.12) if k_global % 2 == 0 else (1.12, 1.0)
    inner = (f'<div class="mot-fill"><img id="{iid}" src="{esc(src)}" '
             f'style="transform-origin:50% 50%"></div>')
    cid = c.clip(t0, t1, inner, z, style=style, pieza="material")
    c.at(f'tl.fromTo("#{iid}",{{scale:{s0}}},{{scale:{s1},duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},'
         f'{fr(t0):.4f});')
    return cid


def clip(c: Comp, t0: float, t1: float, src: str, desde: float, velocidad: float, style: str, z: int = 1):
    """Un clip de video con su segundo de entrada y su velocidad (la cámara lenta de `velocidad`)."""
    return c.video(t0, t1, src, desde, z, velocidad=velocidad, style=style, pieza="material")


def tarjeta(c: Comp, k: int, e: dict, ancho: int, z: int = 1):
    """
    La escena sin material: fondo negro liso con la cita centrada — el `titular` en Bebas Neue a 0,06 del
    ancho, a 1,28 de interlínea y con `\\n` partiendo renglones, como la dibujaba `render_tarjeta` con
    drawtext. Entra y sale en corte seco, como el concat de tramos.
    """
    lineas = [l.strip() for l in str(e.get("titular") or "").split("\n") if l.strip()]
    if not lineas:
        return
    tam = round(TAM_TARJETA * ancho)
    inner = (f'<div class="mot-fill mot-card"><div class="mot-quote" id="q{k}" '
             f'style="font-size:{tam}px">{esc(chr(10).join(lineas))}</div></div>')
    c.clip(e["t0"], e["t1"], inner, z, pieza="tarjeta")


def subtitulos(c: Comp, lineas: list, W: int, H: int, z: int = 85):
    """
    El karaoke del estilo dentro de la edición, como en el top: una capa por línea con una palabra por tramo;
    la palabra que se dice se enciende en el blanco cálido (`.on`) por la línea de GSAP. `lineas` son los grupos
    de `grupos_de_lineas` de subtitulos.py con el estilo `minimal` (Bebas Neue, blanco puro, palabra activa
    #FFF4E6, abajo al 21 % de la altura en vertical). Sin `.ass` ni ffmpeg: el texto es parte del video.
    """
    if not lineas:
        return
    vertical = H > W
    letra = round(W * (0.072 if vertical else 0.044))
    margen = round(H * (0.21 if vertical else 0.10))
    contorno = max(round(letra * 0.10), 1)
    sombra = max(round(letra * 0.04), 1)
    for k, g in enumerate(lineas):
        palabras = [(ini, fin, texto) for ini, fin, texto in g if texto.strip()]
        if not palabras or palabras[-1][1] - palabras[0][0] < 1.0 / c.fps:
            continue
        t0, t1 = palabras[0][0], palabras[-1][1]
        partes = []
        for ini, fin, texto in palabras:
            w = linea(texto)
            if not w:
                continue
            wid = c.uid("w")
            partes.append(f'<span class="w" id="{wid}">{esc(w.upper())}</span>')
            c.at(f'tl.set("#{wid}",{{className:"w on"}},{fr(ini):.4f});')
            c.at(f'tl.set("#{wid}",{{className:"w"}},{fr(fin):.4f});')
        if not partes:
            continue
        inner = (f'<div class="mot-karaoke" style="font-size:{letra}px;bottom:{margen}px;'
                 f'--mot-contorno:{contorno}px;--mot-sombra:{sombra}px">{" ".join(partes)}</div>')
        c.clip(t0, t1, inner, z, pieza="subtitulo")


def armar(escenas_t: list[dict], archivos: list[list], proyecto: Path, ancho: int, alto: int,
          total: float, audio: str | None = "sonido.wav", subs: list | None = None,
          sonido: dict | None = None) -> dict:
    """
    La edición entera del proyecto: `src/edicion.json` con sus capas, su línea GSAP y sus escenas. Devuelve el JSON
    escrito (para `--revisa` o avisos). `total` es el final de la voz: la edición dura hasta el último `t1`.
    `subs` son las líneas de subtítulos karaoke (grupos de `grupos_de_lineas` con el estilo `minimal`).
    """
    proyecto = Path(proyecto)
    # Comp.write trabaja con rutas relativas a public/ y src/, como el top: se corre desde la raíz.
    antes = Path.cwd()
    os.chdir(proyecto)
    try:
        return _armar(escenas_t, archivos, proyecto, ancho, alto, total, audio, subs, sonido)
    finally:
        os.chdir(antes)


def _armar(escenas_t: list[dict], archivos: list[list], proyecto: Path, ancho: int, alto: int,
          total: float, audio: str | None, subs: list | None, sonido: dict | None) -> dict:
    c = Comp(max([e["t1"] for e in escenas_t] + [total]), ancho, alto)
    k_global = 0
    for k, e in enumerate(escenas_t):
        t0, t1 = e["t0"], e["t1"]
        suyos = archivos[k] if k < len(archivos) else []
        es_cita = not suyos
        c.escena(f"Cita {k + 1}" if es_cita else f"Escena {k + 1}", t0, t1)
        material = e.get("material") or []
        if not suyos:
            # La tarjeta de cita sobre fondo negro.
            tarjeta(c, k, e, ancho, z=1)
            continue
        look = LOOKS.get(e.get("look") or LOOK_POR_DEFECTO, "")
        style = f"filter:{look}" if look else ""
        slot = (t1 - t0) / len(suyos)
        for j, (ruta, item) in enumerate(zip(suyos, material)):
            a = fr(t0 + j * slot)
            b = fr(t1 if j == len(suyos) - 1 else t0 + (j + 1) * slot)
            src = material_public(proyecto, ruta, k, j)
            if es_clip(item):
                clip(c, a, b, src, desde_de(item), velocidad_de(item), style=style, z=1)
            else:
                foto(c, a, b, src, k_global, style=style, z=1)
            k_global += 1
    subtitulos(c, subs or [], ancho, alto)
    c.write("src/edicion.json", tokens="public/assets/motivacional/tokens.css", audio=audio,
            title="Motivacional", sonido=sonido)
    return json.loads((proyecto / "src" / "edicion.json").read_text(encoding="utf-8"))
