"""director.py — del montaje declarativo del anuncio (`publicidad.json` ya cronometado) a la edición entera.

El agente dice qué va en cada escena y qué material la acompaña; el director pone lo demás con las medidas del
formato (las mismas que usaba `escribir_textos`/`render_cierre` con drawtext): cada cosa del `material` ocupa
su tramo en partes iguales —la foto con un paneo lento en CSS+GSAP, suave a 30 fps, donde `zoompan` de ffmpeg
era escalonado; el clip con su `desde` y su `velocidad`—, los textos del anuncio (titular en Anton y `sub` en
Inter) entran con fundido y subida en cada corte, la escena sin material es la tarjeta sobre degradado, y el
`cierre` es la tarjeta de marca con logo, eslogan y píldora del CTA en el color de la marca — todo en capas
dentro de la composición, con sus entradas escalonadas.

    armar(escenas_t, archivos, proyecto, ancho, alto, total, marca)   →  src/edicion.json

`escenas_t` es la salida de `tiempos_de_escenas` (cada escena con `t0`, `t1`, `tipo`, `titular`, `sub`,
`material`); `archivos[k]` son los archivos de su material, en el mismo orden (los deja `traer_items` de
video-base). `marca` es el marca.json leído (nombre, eslogan, cta, color, fondo, logo). El sonido
(`public/sonido.wav`: la voz con la música, o solo la canción en modo música) lo pone hacer.py antes; aquí
solo se apunta en la edición. Los subtítulos karaoke (`subs`, los grupos de `grupos_de_lineas` de
subtitulos.py) van como capas dentro del video — no hay `.ass` ni post-pase.
"""
import json
import os
import re
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

# El paneo de cada foto: alterna sentido (como el k_global % 2 de hacer.py) y origen, para que dos fotos
# seguidas no se muevan igual. El zoom es el mismo lento de siempre.
ORIGENES = ("50% 50%", "30% 42%", "70% 38%", "46% 66%")
DIRECCION = ((1.0, 1.07), (1.07, 1.0))

# El nombre en grande de cada tipo para el texto fantasma de las tarjetas (detrás de los textos
# centrados): es la firma de motion design del anuncio — cada beat se anuncia en pantalla.
TIPOS_NOMBRE = {"gancho": "GANCHO", "problema": "PROBLEMA", "solucion": "SOLUCIÓN",
                "beneficios": "BENEFICIOS", "prueba": "PRUEBA", "oferta": "OFERTA"}


def _dentro_de_public(proyecto: Path, p: Path, carpeta: str, nombre: str) -> str | None:
    """La ruta relativa a public/ si el archivo ya está servido; si no, None."""
    try:
        return p.resolve().relative_to((proyecto / "public").resolve()).as_posix()
    except ValueError:
        return None


def _enlace_public(proyecto: Path, archivo, carpeta: str, prefijo: str) -> str:
    """
    La ruta del archivo relativa a `public/`, que es lo único que Remotion sirve. Lo que ya está en public/ se
    usa tal cual; lo demás (las descargas de `fuentes/material/`, el logo de `marca/` y las rutas del proyecto)
    entra por enlace duro en `public/<carpeta>/<prefijo>-<nombre>` — no ocupa disco y la carpeta de origen
    sigue siendo la procedencia.
    """
    p = Path(archivo)
    if not p.is_absolute():
        p = proyecto / p
    if ya := _dentro_de_public(proyecto, p, carpeta, prefijo):
        return ya
    destino_dir = proyecto / "public" / carpeta
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / f"{prefijo}-{p.name}"
    if not destino.exists():
        try:
            os.link(p, destino)
        except OSError:
            shutil.copy2(p, destino)
    return f"{carpeta}/{destino.name}"


def material_public(proyecto: Path, archivo, k: int, j: int) -> str:
    """La ruta del material de la escena k, cosa j, relativa a `public/` (enlaces en `public/material/`)."""
    p = Path(archivo)
    if not p.is_absolute():
        p = proyecto / p
    return _enlace_public(proyecto, p, "material", f"e{k + 1}-{j + 1}")


def logo_public(proyecto: Path, logo: str) -> str | None:
    """El logo oficial de la marca relativo a `public/` (enlace en `public/marca/`), o None si no está."""
    p = Path(logo)
    if not p.is_absolute():
        p = proyecto / p
    if not p.exists():
        return None
    return _enlace_public(proyecto, p, "marca", "logo")


def foto(c: Comp, t0: float, t1: float, src: str, k_global: int, z: int = 1):
    """Una foto a todo cuadro con paneo lento: el `<img>` crece de más (un 8 % de margen) y GSAP lo empuja o
    lo recoge durante su tramo, a 30 fps y sin cortes — lo que `zoompan` hacía escalonado."""
    iid = c.uid("img")
    s0, s1 = DIRECCION[k_global % 2]
    origen = ORIGENES[k_global % len(ORIGENES)]
    inner = (f'<div class="pub-fill"><img id="{iid}" src="{esc(src)}" '
             f'style="left:-8%;top:-8%;width:116%;height:116%;transform-origin:{origen}"></div>')
    cid = c.clip(t0, t1, inner, z, pieza="material")
    c.at(f'tl.fromTo("#{iid}",{{scale:{s0}}},{{scale:{s1},duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},'
         f'{fr(t0):.4f});')
    return cid


def clip(c: Comp, t0: float, t1: float, src: str, desde: float, velocidad: float, z: int = 1):
    """Un clip de video con su segundo de entrada y su velocidad (la cámara lenta de `velocidad`)."""
    return c.video(t0, t1, src, desde, z, velocidad=velocidad, pieza="material")


def punch(c: Comp, cid: str, t0: float):
    """El empujón de cada corte de material: la capa entra a escala 1.05 y se asienta a 1 en ~0,2 s. Sin él,
    los cortes del anuncio son fotos quietas que cambian de golpe; con él, cada imagen «cae» en su sitio."""
    c.at(f'tl.fromTo("#{cid}",{{scale:1.05}},{{scale:1,duration:0.2,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')


def entrada(c: Comp, iid: str, t0: float, tam: int, dur: float = 0.4):
    """La entrada cinética de los textos del anuncio: fundido y subida en los primeros `dur` segundos — la
    misma que dibujaba el drawtext (`alpha=t/0.4`, `y` baja desde `0.9·tam`)."""
    sube = round(tam * 0.9)
    c.at(f'tl.fromTo("#{iid}",{{opacity:0,y:{sube}}},'
         f'{{opacity:1,y:0,duration:{dur},ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')


def slam(c: Comp, iid: str, t0: float, W: int):
    """
    El golpe del gancho: el titular cae con escala 1,45→1, un giro leve y un tembleque de pantalla en los
    primeros ~0,5 s — el pattern interrupt de los primeros 3 segundos del anuncio. Es la entrada del
    titular solo en la primera escena (las demás usan `entrada`, más limpia).
    """
    c.at(f'tl.fromTo("#{iid}",{{scale:1.45,rotation:-3,opacity:0}},'
         f'{{scale:1,rotation:0,opacity:1,duration:0.34,ease:"power4.out",immediateRender:false}},{fr(t0):.4f});')
    amp = round(W * 0.012)
    t = fr(t0) + 0.34
    for k, x in enumerate((-amp, amp, -round(amp * 0.5), 0)):
        if x == 0 and k < 3:
            continue
        c.at(f'tl.to("#{iid}",{{x:{x},duration:0.05,ease:"power1.out"}},{t + k * 0.05:.4f});')


def flash_escena(c: Comp, t0: float, color: str):
    """El destello del color de marca en cada corte de escena: 0,14 s que se encienden y se apagan — la
    transición que hace que los cambios de beat se sientan editados y no cortados."""
    fid = c.uid("fl")
    c.clip(t0, t0 + 0.4, f'<div id="{fid}" class="pub-flash" style="background:{esc(color)}"></div>',
           96, pieza="flash")
    c.at(f'tl.fromTo("#{fid}",{{opacity:0.30}},{{opacity:0,duration:0.14,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')


def barra_progreso(c: Comp, total: float):
    """La barra de progreso del color de marca arriba del cuadro, llenándose durante todo el anuncio — el
    detalle que todo comercial vertical lleva para que el espectador vea cuánto falta."""
    bid = c.uid("bp")
    c.clip(0, total, f'<div id="{bid}" class="pub-barra"></div>', 200, pieza="progreso")
    c.at(f'tl.fromTo("#{bid}",{{scaleX:0}},'
         f'{{scaleX:1,duration:{fr(total):.4f},ease:"none",immediateRender:false}},0);')


def subrayado(c: Comp, t0: float, t1: float, y: float, tam: int, escala: float, W: int):
    """El filete del color de marca bajo el titular: entra barriendo unos 0,3 s después del texto — el
    detalle que separa un anuncio diseñado de un drawtext encima de una foto."""
    lid = c.uid("ln")
    ancho_ln = round(min(W * 0.34, 380 * escala))
    top = round(y + tam * 1.12)
    inner = (f'<div id="{lid}" class="pub-linea" style="top:{top}px;width:{ancho_ln}px;'
             f'margin-left:{-ancho_ln // 2}px"></div>')
    c.clip(t0, t1, inner, 10, pieza="subrayado")
    c.at(f'tl.fromTo("#{lid}",{{scaleX:0}},'
         f'{{scaleX:1,duration:0.3,ease:"power3.out",immediateRender:false}},{fr(t0) + 0.3:.4f});')


def marca_agua(c: Comp, nombre, t0: float, t1: float, W: int, H: int):
    """La marca en marca de agua, pequeña abajo a la izquierda durante las escenas de contenido — el «bug»
    que todo anuncio mantiene para que la marca esté presente antes del cierre."""
    if not nombre:
        return
    tam = round(min(W * 0.030, H * 0.016))
    mid = c.uid("mk")
    inner = (f'<div class="pub-marca" style="bottom:{round(H * 0.115)}px;left:{round(W * 0.07)}px;'
             f'font-size:{tam}px">{esc(str(nombre).upper())}</div>')
    c.clip(t0, t1, inner, 8, pieza="marca")


def ghost(c: Comp, tipo: str, t0: float, t1: float, W: int, H: int):
    """El tipo del beat en gigante fantasma detrás de los textos de una tarjeta — el poster cinético de
    cada escena sin material («SOLUCIÓN», «OFERTA»…)."""
    palabra = TIPOS_NOMBRE.get(tipo, str(tipo).upper())
    # Bebas es más condensada que Anton (~0,44 em por mayúscula): el factor deja el fantasma lo más ancho
    # posible sin pasarse del cuadro.
    tam = min(H * 0.40, W * 0.92 / max(1, len(palabra) * 0.44))
    gid = c.uid("gh")
    c.clip(t0, t1, f'<div class="pub-ghost" style="top:{round(H * 0.34)}px;font-size:{round(tam)}px">'
           f'{esc(palabra)}</div>', 2, pieza="ghost")


def sticker(c: Comp, e: dict, t0: float, t1: float, W: int, H: int):
    """El sticker de la oferta (precio, descuento, «2x1»): píldora del color de marca, inclinada, que
    entra con un pop elástico — solo en escenas `tipo: oferta` con campo `oferta`."""
    oferta = e.get("oferta")
    if not oferta:
        return
    tam = round(W * 0.036)
    sid = c.uid("st")
    inner = (f'<div id="{sid}" class="pub-sticker"><span class="pub-sticker-in" style="font-size:{tam}px">'
             f'{esc(str(oferta).upper())}</span></div>')
    c.clip(t0, t1, inner, 12, pieza="oferta")
    c.at(f'tl.fromTo("#{sid}",{{opacity:0,scale:0.5,y:20}},'
         f'{{opacity:1,scale:1,y:0,duration:0.45,ease:"back.out(1.8)",immediateRender:false}},{fr(t0) + 0.15:.4f});')


def textos_tramo(c: Comp, k: int, j: int, e: dict, tarjeta: bool, escala: float, W: int, H: int,
                t0: float, t1: float = 0.0, tipo: str = "") -> str:
    """
    Los textos del anuncio sobre su tramo: `titular` en Anton blanco con contorno y `sub` en Inter gris, en
    las medidas de `escribir_textos` (titular 58·escala arriba al 17 % —al 44 % en tarjeta—; `sub` 38·escala
    debajo, 64·escala más si hay titular). Las entradas son escalonadas —titular primero, sub ~0,12 s
    después— y en el gancho el titular hace `slam` en vez de `entrada`: el pattern interrupt. Debajo del
    titular va el `subrayado` del color de marca, que barre cuando el texto ya entró. Devuelve el HTML.
    """
    partes = []
    hay_titular = bool(e.get("titular"))
    if hay_titular:
        tam = round(58 * escala)
        y = H * (0.44 if tarjeta else 0.17)
        iid = c.uid("pt")
        partes.append(f'<div id="{iid}" class="pub-tit" style="top:{round(y)}px;font-size:{tam}px;'
                      f'--pub-contorno:{max(3, round(tam * 0.05))}px">{esc(str(e["titular"]).upper())}</div>')
        if tipo == "gancho" and j == 0:
            slam(c, iid, t0, W)
        else:
            entrada(c, iid, t0, tam)
        if t1 > t0:
            subrayado(c, t0, t1, y, tam, escala, W)
    if e.get("sub"):
        tam = round(38 * escala)
        y = H * (0.50 if tarjeta else 0.225)
        if hay_titular:
            y += round(64 * escala)
        iid = c.uid("ps")
        partes.append(f'<div id="{iid}" class="pub-sub" style="top:{round(y)}px;font-size:{tam}px">'
                      f'{esc(str(e["sub"]).upper())}</div>')
        entrada(c, iid, t0 + 0.12, tam)
    return "".join(partes)


def _tinta_hex(color: str) -> str:
    """La tinta del CTA en #RRGGBB: oscura sobre un color de marca claro, clara sobre uno oscuro."""
    c = color.lstrip("#")
    if len(c) != 6:
        return "#101014"
    r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    return "#101014" if 0.299 * r + 0.587 * g + 0.114 * b > 150 else "#ffffff"


def _tam_que_cabe(texto: str, tam: int, max_ancho: int, fuente: str = "Anton-Regular.ttf") -> int:
    """El tamaño que deja el texto dentro de `max_ancho` px, medido con `fuente` (Anton para los titulares,
    Bebas para la píldora del CTA que va en la voz condensada); si Pillow no puede medir, se estima por
    carácter (~0,5 em en mayúsculas de Anton, ~0,44 en Bebas)."""
    fuente_ttf = SKILL.parent / "video-base" / "assets" / "fonts" / fuente
    try:
        from PIL import ImageFont
        while tam > 10:
            if ImageFont.truetype(str(fuente_ttf), tam).getlength(texto.upper()) <= max_ancho:
                return tam
            tam = int(tam * 0.94)
    except Exception:
        pass
    factor = 0.44 if "Bebas" in fuente else 0.5
    while tam > 10 and len(texto) * tam * factor > max_ancho:
        tam = int(tam * 0.94)
    return tam


def cierre(c: Comp, e: dict, marca: dict, proyecto: Path, W: int, H: int, t0: float, t1: float):
    """
    La tarjeta de marca del `cierre` (lo que era `render_cierre`): fondo del color de la marca (o casi
    negro), el logo oficial encajado en su caja sin deformarse con fundido y subida en 0,6 s —sin logo, el
    nombre de la marca ocupa su lugar—, el eslogan en Anton grande y el CTA en una píldora del color de
    marca con su tinta. Las entradas van escalonadas: marca primero, eslogan a los ~0,45 s y CTA al ~0,9 s,
    para que la firma del anuncio se lea como un comercial y no como un cuadro fijo.
    """
    fondo = marca.get("fondo") or "#0b0e11"
    color = marca.get("color") or "#ffffff"
    eslogan = e.get("titular") or marca.get("eslogan") or ""
    cta = e.get("cta") or marca.get("cta") or ""
    vertical = H > W
    max_txt = round(W * 0.92)

    c.clip(t0, t1, f'<div class="pub-fondo" style="background:{esc(fondo)}"></div>', 0, pieza="fondo")

    # El héroe de la tarjeta: el logo oficial en su caja (centro al 36 %/33 % del alto), o el nombre en
    # grande si no hay logo verificado.
    logo = marca.get("logo")
    src_logo = logo_public(proyecto, logo) if logo else None
    caja_w, caja_h = round(W * 0.72), round(H * (0.34 if vertical else 0.40))
    centro = 0.36 if vertical else 0.33
    if src_logo:
        # El glow del color de marca detrás del logo: el halo que hace que la firma se lea como marca y no
        # como una foto pegada — entra con el mismo fundido y subida del logo.
        gid = c.uid("gl")
        gw, gh = round(caja_w * 1.8), round(caja_h * 1.8)
        inner = (f'<div id="{gid}" class="pub-glow" style="left:{round((W - gw) / 2)}px;'
                 f'top:{round(centro * H - gh / 2)}px;width:{gw}px;height:{gh}px"></div>')
        c.clip(t0, t1, inner, 4, pieza="glow")
        c.at(f'tl.fromTo("#{gid}",{{opacity:0,scale:0.85}},'
             f'{{opacity:0.30,scale:1,duration:0.6,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')
        lid = c.uid("lg")
        inner = (f'<div id="{lid}" class="pub-logo" style="left:{round((W - caja_w) / 2)}px;'
                 f'top:{round(centro * H - caja_h / 2)}px;width:{caja_w}px;height:{caja_h}px">'
                 f'<img src="{esc(src_logo)}"></div>')
        c.clip(t0, t1, inner, 5, pieza="logo")
        slide = round(W * 0.04)
        c.at(f'tl.fromTo("#{lid}",{{opacity:0,y:{-slide}}},'
             f'{{opacity:1,y:0,duration:0.6,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')
    elif marca.get("nombre"):
        tam = _tam_que_cabe(str(marca["nombre"]), round(W * 0.13), max_txt)
        y = round(H * (0.36 if vertical else 0.33) - round(W * 0.105) // 3)
        nid = c.uid("nm")
        inner = (f'<div id="{nid}" class="pub-nombre" style="top:{y}px;font-size:{tam}px;'
                 f'--pub-contorno:{max(3, round(tam * 0.06))}px">{esc(str(marca["nombre"]).upper())}</div>')
        c.clip(t0, t1, inner, 5, pieza="nombre")
        slide = round(W * 0.04)
        c.at(f'tl.fromTo("#{nid}",{{opacity:0,y:{-slide}}},'
             f'{{opacity:1,y:0,duration:0.6,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')

    # El eslogan, en grande y ajustado al ancho como hacía `_tam_que_cabe`.
    if eslogan:
        tam = _tam_que_cabe(str(eslogan), round(W * 0.105), max_txt)
        y = round(H * (0.65 if vertical else 0.70))
        sid = c.uid("es")
        inner = (f'<div id="{sid}" class="pub-eslogan" style="top:{y}px;font-size:{tam}px;'
                 f'--pub-contorno:{max(3, round(tam * 0.04))}px">{esc(str(eslogan).upper())}</div>')
        c.clip(t0, t1, inner, 10, pieza="eslogan")
        entrada(c, sid, t0 + 0.45, tam, dur=0.5)

    # El CTA en su píldora del color de marca, con la tinta que contrasta: entra con un pop elástico y una
    # vez dentro el brillo la cruza de lado a lado — el detalle que hace que el botón «pulse» en pantalla.
    if cta:
        tam = _tam_que_cabe(str(cta), round(W * 0.058), max_txt, fuente="BebasNeue-Regular.ttf")
        y = round(H * (0.79 if vertical else 0.86))
        pad = round(tam * 0.55)
        pid = c.uid("ct")
        bid = c.uid("cb")
        inner = (f'<div id="{pid}" class="pub-pill" style="top:{y - pad}px">'
                 f'<span style="font-size:{tam}px"><i id="{bid}" class="pub-brillo"></i>'
                 f'{esc(str(cta).upper())}</span></div>')
        c.clip(t0, t1, inner, 10, pieza="cta")
        c.at(f'tl.fromTo("#{pid}",{{opacity:0,y:{round(tam * 0.9)},scale:0.92}},'
             f'{{opacity:1,y:0,scale:1,duration:0.45,ease:"back.out(1.6)",immediateRender:false}},{fr(t0) + 0.9:.4f});')
        c.at(f'tl.fromTo("#{bid}",{{xPercent:-160}},'
             f'{{xPercent:380,duration:0.7,ease:"power2.inOut",immediateRender:false}},{fr(t0) + 1.35:.4f});')

        # El sitio de la marca bajo la píldora (si marca.json lo trae): la dirección que el espectador
        # puede escribir — el último empujón antes del cierre.
        sitio = re.sub(r"^https?://(www\.)?", "", str(marca.get("sitio") or "")).rstrip("/")
        if sitio:
            tam_s = round(W * 0.034)
            y_s = y + pad + round(tam * 1.9)
            sid2 = c.uid("st2")
            inner = (f'<div id="{sid2}" class="pub-sitio" style="top:{y_s}px;font-size:{tam_s}px">'
                     f'{esc(sitio.lower())}</div>')
            c.clip(t0, t1, inner, 10, pieza="sitio")
            entrada(c, sid2, t0 + 1.35, tam_s, dur=0.4)


def subtitulos(c: Comp, lineas: list, W: int, H: int, hasta: float | None = None, z: int = 85):
    """
    El karaoke del anuncio dentro de la edición, como en el top y el documental: una capa por línea con una
    palabra por tramo; la palabra que se dice se enciende en el color de la marca (`.on`, `--pub-acento`) por
    la línea de GSAP. `lineas` son los grupos de `grupos_de_lineas` de subtitulos.py ((inicio, fin, texto) en
    segundos, ya medidos para el ancho). `hasta` es el t0 del cierre: ninguna palabra ni línea lo pasa — el
    karaoke no cae encima de la tarjeta de marca. Sin `.ass` ni ffmpeg: el texto es parte del video.
    """
    if not lineas:
        return
    vertical = H > W
    letra = round(W * (0.070 if vertical else 0.042))
    margen = round(H * (0.21 if vertical else 0.10))
    contorno = max(round(letra * 0.12), 2)
    for k, g in enumerate(lineas):
        palabras = [(ini, fin, texto) for ini, fin, texto in g if texto.strip()]
        if hasta is not None:
            palabras = [p for p in palabras if p[0] < hasta]
        if not palabras:
            continue
        t0, t1 = palabras[0][0], palabras[-1][1]
        if hasta is not None:
            t1 = min(t1, hasta)
        if t1 - t0 < 1.0 / c.fps:
            continue
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
        inner = (f'<div class="pub-karaoke" style="font-size:{letra}px;bottom:{margen}px;'
                 f'--pub-contorno:{contorno}px">{" ".join(partes)}</div>')
        c.clip(t0, t1, inner, z, pieza="subtitulo")


def armar(escenas_t: list[dict], archivos: list[list], proyecto: Path, ancho: int, alto: int,
          total: float, marca: dict | None = None, audio: str | None = "sonido.wav",
          subs: list | None = None, sonido: dict | None = None) -> dict:
    """
    La edición entera del proyecto: `src/edicion.json` con sus capas, su línea GSAP y sus escenas. Devuelve el
    JSON escrito (para `--revisa` o avisos). `total` es el final del audio: la edición dura hasta el último
    `t1`. `marca` es el marca.json (los colores se inyectan como variables CSS de la edición). `subs` son las
    líneas de subtítulos karaoke (grupos de `grupos_de_lineas`), que van como capas dentro del video — no hay
    `.ass` ni post-pase. `sonido` son las pistas por separado del monitor en vivo y la línea de tiempo.
    """
    proyecto = Path(proyecto)
    # Comp.write trabaja con rutas relativas a public/ y src/, como el top: se corre desde la raíz.
    antes = Path.cwd()
    os.chdir(proyecto)
    try:
        return _armar(escenas_t, archivos, proyecto, ancho, alto, total, marca, audio, subs, sonido)
    finally:
        os.chdir(antes)


def _armar(escenas_t: list[dict], archivos: list[list], proyecto: Path, ancho: int, alto: int,
           total: float, marca: dict | None, audio: str | None, subs: list | None,
           sonido: dict | None) -> dict:
    marca = marca or {}
    c = Comp(max([e["t1"] for e in escenas_t] + [total]), ancho, alto)
    escala = min(ancho / 1080, alto / 1920)
    # La marca de la campaña, inyectada como variables CSS: el fondo y la tinta de la tarjeta de marca, el
    # color de la píldora del CTA y el acento del karaoke (el amarillo del formato si la marca no trae color).
    color = marca.get("color") or "#ffffff"
    c.css.append(f":root{{--pub-color:{color};--pub-fondo:{marca.get('fondo') or '#0b0e11'};"
                 f"--pub-acento:{color if marca.get('color') else '#ffe600'};--pub-tinta:{_tinta_hex(color)}}}")
    barra_progreso(c, max(e["t1"] for e in escenas_t))
    k_global = 0
    hasta = None
    for k, e in enumerate(escenas_t):
        t0, t1 = e["t0"], e["t1"]
        tipo = str(e.get("tipo") or "escena")
        c.escena(f"{k + 1}. {tipo.capitalize()}", t0, t1)
        if tipo == "cierre":
            hasta = t0
            cierre(c, e, marca, proyecto, ancho, alto, t0, t1)
            k_global += 1
            continue
        # El flash del color de marca en el corte de cada escena — la firma de transición del anuncio.
        flash_escena(c, t0, color)
        marca_agua(c, marca.get("nombre"), t0, t1, ancho, alto)
        suyos = archivos[k] if k < len(archivos) else []
        if not suyos:
            # La tarjeta sobre el degradado: el tipo fantasma detrás y los textos centrados, como
            # render_tarjeta.
            c.clip(t0, t1, '<div class="pub-fill pub-tarjeta"></div>', 0, pieza="tarjeta")
            ghost(c, tipo, t0, t1, ancho, alto)
            inner = textos_tramo(c, k, 0, e, tarjeta=True, escala=escala, W=ancho, H=alto,
                                 t0=t0, t1=t1, tipo=tipo)
            if inner:
                c.clip(t0, t1, inner, 10, pieza="textos")
            sticker(c, e, t0, t1, ancho, alto)
            k_global += 1
            continue
        slot = (t1 - t0) / len(suyos)
        # El velo de lectura sobre el material: el degradado que deja leer el texto blanco sobre
        # material claro — va sobre el material (z=2) y debajo de textos y karaoke.
        c.clip(t0, t1, '<div class="pub-velo"></div>', 2, pieza="velo")
        for j, (ruta, item) in enumerate(zip(suyos, e.get("material") or [])):
            a = fr(t0 + j * slot)
            b = fr(t1 if j == len(suyos) - 1 else t0 + (j + 1) * slot)
            src = material_public(proyecto, ruta, k, j)
            if es_clip(item):
                cid = clip(c, a, b, src, desde_de(item), velocidad_de(item), z=1)
            else:
                cid = foto(c, a, b, src, k_global, z=1)
            punch(c, cid, a)
            # Los textos entran con su fundido y subida en cada tramo: con varios materiales «rebota»
            # en cada corte, como el golpe cinético del anuncio.
            inner = textos_tramo(c, k, j, e, tarjeta=False, escala=escala, W=ancho, H=alto,
                                 t0=t0 + j * slot, t1=t0 + (j + 1) * slot, tipo=tipo)
            if inner:
                c.clip(a, b, inner, 10, pieza="textos")
            sticker(c, e, t0 + j * slot, min(t1, t0 + (j + 1) * slot), ancho, alto)
            k_global += 1
    subtitulos(c, subs or [], ancho, alto, hasta=hasta)
    c.write("src/edicion.json", tokens="public/assets/pub/tokens.css", audio=audio,
            title=str(marca.get("nombre") or "").strip() or "Publicidad", sonido=sonido)
    return json.loads((proyecto / "src" / "edicion.json").read_text(encoding="utf-8"))
