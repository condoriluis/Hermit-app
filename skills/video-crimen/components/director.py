"""director.py — de las escenas del video (`escenas.json` ya cronometado por `tiempos_de_escenas`) a la edición
entera.

El agente dice qué va en cada escena; el director pone lo demás con las medidas del formato, las mismas que usaba
el pipeline de ffmpeg: cada cosa del `material` ocupa su tramo en partes iguales —la foto con el paneo Ken Burns
centrado y alternando sentido (lo que `zoompan` hacía a z 1.0↔1.12 por tramo), el clip con su `desde` y su
`velocidad`—, el `look` de la escena (`frio`, `sepia`, `color`) es el filtro CSS del medio, lo que eran los
eq/colorchannelmixer encadenados al paneo; sobre todo material van el grano de película y la viñeta (la firma del
expediente, lo que eran `noise` y `vignette`); una escena sin `material` es la tarjeta de expediente sobre fondo
negro con el `titular` en Courier Prime ámbar. Los cortes son secos, como el concat de antes: el movimiento lo
pone solo el paneo.

    armar(escenas_t, archivos, proyecto, ancho, alto, total)   →  src/edicion.json

`escenas_t` es la salida de `tiempos_de_escenas` (cada escena con `t0`, `t1`, `look`, `titular`, `material`);
`archivos[k]` son los archivos de su material, en el mismo orden (los deja `traer_items` de video-base). El sonido
(`public/sonido.wav`, la voz con los efectos del expediente y la música con ducking) lo pone hacer.py antes; aquí
solo se apunta en la edición.
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

# El `look` de escenas.json como filtro CSS del medio de la capa: el equivalente de los filtros ffmpeg del
# pipeline viejo. `frio` es el de expediente (el de omisión): colores apagados y fríos —saturación y brillo
# abajo, contraste arriba, como el eq=colorbalance encadenados—; `sepia` el archivo vintage; `color` sin filtro.
LOOKS = {
    "frio": "saturate(0.55) contrast(1.12) brightness(0.95)",
    "sepia": "sepia(0.8) contrast(1.05)",
    "color": "",
}
LOOK_POR_DEFECTO = "frio"
# La tarjeta de expediente: la Courier Prime Bold a 0,05 del ancho (54 px en 1080), como TAM_TARJETA del pipeline viejo.
TAM_TARJETA = 0.05
# El ambiente del expediente: el grano se mueve en saltos de ~2 cuadros, como el `allf=t` del noise de ffmpeg.
GRANO = '<div class="cri-ambiente"><div class="cri-grano"></div><div class="cri-vineta"></div></div>'


def material_public(proyecto: Path, archivo, k: int, j: int) -> str:
    """
    La ruta del material relativa a `public/`, que es lo único que Remotion sirve. Lo que ya está en public/ se usa
    tal cual; lo demás (las descargas de `fuentes/evidencia/` y las rutas del proyecto) entra por enlace duro en
    `public/material/e<k>-<j>-<nombre>` — no ocupa disco y `fuentes/evidencia/` sigue siendo la procedencia.
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


def grano(c: Comp, capa_id: str):
    """
    El grano de película vibrando dentro de la capa de material: un salto a una posición al azar cada ~2 cuadros
    (`allf=t` del noise de ffmpeg), por la línea de GSAP. El div es 150 % del cuadro y se mueve ±40 px: siempre
    cubre el encuadre.
    """
    c.at(f'tl.to("#{capa_id} .cri-grano",{{duration:0.0667,repeat:-1,ease:"none",'
         f'x:()=>gsap.utils.random(-40,40),y:()=>gsap.utils.random(-40,40)}},0);')


def foto(c: Comp, t0: float, t1: float, src: str, k_global: int, look: str, pie: str = "", W: int = 1080):
    """
    Una foto a todo cuadro como pieza del expediente: va dentro del marco de evidencia (borde claro y sombra,
    que no se mueve) con el paneo Ken Burns del estilo en la imagen — origen al centro y zoom lento que entra o
    sale (1.0↔1.12, alternando por tramo como el `k_tramo % 2` de `render_tramo`)—. El `<img>` lleva el `look`
    como su filtro y, si el item trae `pie`, la leyenda del expediente abajo a la izquierda. GSAP empuja el
    paneo a 30 fps, suave donde `zoompan` era escalonado.
    """
    iid = c.uid("img")
    s0, s1 = (1.0, 1.12) if k_global % 2 == 0 else (1.12, 1.0)
    filtro = f"filter:{look};" if look else ""
    leyenda = (f'<div class="cri-pie" style="--cri-pie-escala:{W / 1080:.3f}">{esc(pie)}</div>'
               if pie else "")
    inner = (f'<div class="cri-evidencia"><div class="cri-fill"><img id="{iid}" src="{esc(src)}" '
             f'style="transform-origin:50% 50%;{filtro}"></div>{leyenda}</div>{GRANO}')
    cid = c.clip(t0, t1, inner, 1, pieza="material")
    grano(c, cid)
    c.at(f'tl.fromTo("#{iid}",{{scale:{s0}}},{{scale:{s1},duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},'
         f'{fr(t0):.4f});')
    return cid


def clip(c: Comp, t0: float, t1: float, src: str, desde: float, velocidad: float, look: str):
    """Un clip de video con su segundo de entrada, su velocidad (la cámara lenta de `velocidad`) y su `look` en el medio."""
    vid = c.video(t0, t1, src, desde, 1, velocidad=velocidad, filtro=look, pieza="material")
    grano(c, vid)
    return vid


def tarjeta(c: Comp, k: int, e: dict, ancho: int, z: int = 1):
    """
    La escena sin material: fondo negro liso con el texto del expediente centrado — el `titular` en Courier
    Prime Bold ámbar a 0,05 del ancho, a 1,28 de interlínea y con `\\n` partiendo renglones, como la dibujaba
    `render_tarjeta` con drawtext. Entra y sale en corte seco, como el concat de tramos.
    """
    lineas = [l.strip() for l in str(e.get("titular") or "").split("\n") if l.strip()]
    if not lineas:
        return
    tam = round(TAM_TARJETA * ancho)
    inner = (f'<div class="cri-fill cri-card"><div class="cri-doc">'
             f'<i></i><i></i><i></i><i></i>'
             f'<div class="cri-quote" id="q{k}" style="font-size:{tam}px">'
             f'{esc(chr(10).join(lineas))}</div></div></div>')
    cid = c.clip(e["t0"], e["t1"], inner, z, pieza="tarjeta")
    # El sello del expediente: el documento se clava de golpe — entra grande y asienta en 0,3 s.
    c.at(f'tl.fromTo("#{cid} .cri-doc",{{scale:1.15,opacity:0}},'
         f'{{scale:1,opacity:1,duration:0.3,ease:"power3.out",immediateRender:false}},'
         f'{fr(e["t0"]):.4f});')


def subtitulos(c: Comp, lineas: list, W: int, H: int, z: int = 85):
    """
    El karaoke del expediente dentro de la edición: una capa por línea con una palabra por tramo; la palabra
    que se dice se enciende en el ámbar (`.on`) por la línea de GSAP. `lineas` son los grupos de
    `grupos_de_lineas` de subtitulos.py con el estilo `crimen` (Courier Prime Bold, 3 palabras por línea,
    blanco con contorno y sombra marcados, palabra activa ámbar, abajo al 21 % de la altura en vertical). Las
    palabras ya vienen medidas en mayúsculas, como las pinta el karaoke. Sin `.ass` ni ffmpeg: el texto es
    parte del video.
    """
    if not lineas:
        return
    vertical = H > W
    letra = round(W * (0.062 if vertical else 0.037))
    margen = round(H * (0.21 if vertical else 0.10))
    contorno = max(round(letra * 0.14), 1)
    sombra = max(round(letra * 0.08), 1)
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
        inner = (f'<div class="cri-karaoke" style="font-size:{letra}px;bottom:{margen}px;'
                 f'--cri-contorno:{contorno}px;--cri-sombra:{sombra}px">{" ".join(partes)}</div>')
        c.clip(t0, t1, inner, z, pieza="subtitulo")


def armar(escenas_t: list[dict], archivos: list[list], proyecto: Path, ancho: int, alto: int,
          total: float, audio: str | None = "sonido.wav", subs: list | None = None,
          sonido: dict | None = None) -> dict:
    """
    La edición entera del proyecto: `src/edicion.json` con sus capas, su línea GSAP y sus escenas. Devuelve el JSON
    escrito (para `--revisa` o avisos). `total` es el final de la voz: la edición dura hasta el último `t1`.
    `subs` son las líneas de subtítulos karaoke (grupos de `grupos_de_lineas` con el estilo `crimen`).
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
        c.escena(f"Tarjeta {k + 1}" if es_cita else f"Escena {k + 1}", t0, t1)
        material = e.get("material") or []
        if not suyos:
            # La tarjeta de expediente sobre fondo negro.
            tarjeta(c, k, e, ancho, z=1)
            continue
        look = LOOKS.get(e.get("look") or LOOK_POR_DEFECTO, "")
        slot = (t1 - t0) / len(suyos)
        for j, (ruta, item) in enumerate(zip(suyos, material)):
            a = fr(t0 + j * slot)
            b = fr(t1 if j == len(suyos) - 1 else t0 + (j + 1) * slot)
            src = material_public(proyecto, ruta, k, j)
            if es_clip(item):
                clip(c, a, b, src, desde_de(item), velocidad_de(item), look)
            else:
                foto(c, a, b, src, k_global, look, pie=str(item.get("pie") or ""), W=ancho)
            k_global += 1
    subtitulos(c, subs or [], ancho, alto)
    c.write("src/edicion.json", tokens="public/assets/crimen/tokens.css", audio=audio,
            title="Crimen", sonido=sonido)
    return json.loads((proyecto / "src" / "edicion.json").read_text(encoding="utf-8"))
