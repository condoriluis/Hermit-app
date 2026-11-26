"""director.py — de las escenas del top (`top.json` ya cronometado por `tiempos_de_escenas`) a la edición entera.

El agente dice qué va en cada puesto; el director pone lo demás con las medidas del formato (las mismas que usaba
`escribir_textos` con drawtext): cada cosa del `material` ocupa su tramo en partes iguales —la foto con un paneo
lento en CSS+GSAP, suave a 30 fps, donde `zoompan` de ffmpeg era escalonado; el clip con su `desde` y su
`velocidad`—, los textos del puesto («NÚMERO N» en el amarillo del top y el titular en blanco, con su contorno) entran
con la línea de GSAP al empezar la escena, y una escena sin material es la tarjeta sobre fondo negro.

    armar(escenas_t, archivos, proyecto, ancho, alto, total)   →  src/edicion.json

`escenas_t` es la salida de `tiempos_de_escenas` (cada escena con `t0`, `t1`, `numero`, `titular`, `material`);
`archivos[k]` son los archivos de su material, en el mismo orden (los deja `traer_items` de video-base). El sonido
(`public/sonido.wav`, la voz con los golpes por puesto) lo pone hacer.py antes; aquí solo se apunta en la edición.
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

# El paneo de cada foto: alterna sentido (como el k_global % 2 de hacer.py) y origen, para que dos fotos seguidas no
# se muevan igual. El zoom es el mismo lento de siempre (~6 % en el tramo).
ORIGENES = ("50% 50%", "30% 42%", "70% 38%", "46% 66%")
DIRECCION = ((1.0, 1.07), (1.07, 1.0))


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


def foto(c: Comp, t0: float, t1: float, src: str, k_global: int, z: int = 1):
    """Una foto a todo cuadro con paneo lento: el `<img>` crece de más (un 8 % de margen) y GSAP lo empuja o lo
    recoge durante su tramo, a 30 fps y sin cortes — lo que `zoompan` hacía escalonado."""
    iid = c.uid("img")
    s0, s1 = DIRECCION[k_global % 2]
    origen = ORIGENES[k_global % len(ORIGENES)]
    inner = (f'<div class="top-fill"><img id="{iid}" src="{esc(src)}" '
             f'style="left:-8%;top:-8%;width:116%;height:116%;transform-origin:{origen}"></div>')
    cid = c.clip(t0, t1, inner, z, pieza="material")
    c.at(f'tl.fromTo("#{iid}",{{scale:{s0}}},{{scale:{s1},duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},'
         f'{fr(t0):.4f});')
    return cid


def clip(c: Comp, t0: float, t1: float, src: str, desde: float, velocidad: float, z: int = 1):
    """Un clip de video con su segundo de entrada y su velocidad (la cámara lenta de `velocidad`)."""
    return c.video(t0, t1, src, desde, z, velocidad=velocidad, pieza="material")


def golpe_visual(c: Comp, iid: str, t0: float, fuerte: bool = False):
    """
    El slam del número al entrar el puesto: escala desde 2.6 (3.0 en el #1) a 1 en ~0,3 s con power4, un
    de ~5 cuadros (±16 px, más en el #1) y un flash amarillo de 1-2 cuadros. Todo en el t0 del golpe de audio:
    es el golpe *visual* de la cuenta regresiva, lo que hace que el formato se sienta top y no slideshow.
    """
    s0, dur = (3.0, 0.34) if fuerte else (2.6, 0.30)
    c.at(f'tl.fromTo("#{iid}",{{scale:{s0},opacity:0}},'
         f'{{scale:1,opacity:1,duration:{dur},ease:"power4.out",immediateRender:false}},{fr(t0):.4f});')
    amp = 20 if fuerte else 14
    t = fr(t0) + dur
    for k, x in enumerate((-amp, int(amp * 0.75), -int(amp * 0.45), int(amp * 0.25), 0)):
        if x == 0 and k < 4:
            continue
        c.at(f'tl.to("#{iid}",{{x:{x},duration:0.05,ease:"power1.out"}},{t + k * 0.05:.4f});')


def flash(c: Comp, k: int, t0: float, fuerte: bool = False):
    """El destello amarillo del corte de puesto: una capa a todo cuadro que se enciende y se apaga en ~0,14 s."""
    fid = c.uid("fl")
    c.clip(t0, t0 + 0.5, f'<div id="{fid}" class="top-flash"></div>', 95, pieza="flash")
    op = 0.8 if fuerte else 0.55
    c.at(f'tl.fromTo("#{fid}",{{opacity:{op}}},{{opacity:0,duration:0.16,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')


def punch(c: Comp, cid: str, t0: float):
    """El empujón de cada corte de material: la capa entra a escala 1.05 y se asienta a 1 en ~0,2 s. Sin él, los
    cortes de la cuenta regresiva son fotos quietas que cambian de golpe; con él, cada imagen «cae» en su sitio."""
    c.at(f'tl.fromTo("#{cid}",{{scale:1.05}},{{scale:1,duration:0.2,ease:"power2.out",immediateRender:false}},{fr(t0):.4f});')


def subtitulos(c: Comp, lineas: list, W: int, H: int, z: int = 85):
    """
    El karaoke del top dentro de la edición, como en el documental: una capa por línea con una palabra por
    tramo; la palabra que se dice se enciende en amarillo (`.on`) por la línea de GSAP. `lineas` son los grupos
    de `grupos_de_lineas` de subtitulos.py ((inicio, fin, texto) en segundos, ya medidos para el ancho). Sin
    `.ass` ni ffmpeg: el texto es parte del video desde el render.
    """
    if not lineas:
        return
    vertical = H > W
    letra = round(W * (0.070 if vertical else 0.042))
    margen = round(H * (0.21 if vertical else 0.10))
    contorno = max(round(letra * 0.12), 2)
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
        inner = (f'<div class="top-karaoke" style="font-size:{letra}px;bottom:{margen}px;'
                 f'--top-contorno:{contorno}px">{" ".join(partes)}</div>')
        c.clip(t0, t1, inner, z, pieza="subtitulo")


def textos(c: Comp, k: int, e: dict, tarjeta: bool, escala: float, W: int, H: int, z: int = 10):
    """
    Los textos del puesto sobre su escena. Con material van arriba: «NÚMERO N» en el amarillo del top, grande
    (la cuenta regresiva es el formato: el número es su marca), y el titular debajo. En una tarjeta, centrados y
    con el número fantasma gigante detrás. El número entra con `golpe_visual` (slam + + flash) en el t0 de la
    escena — el mismo instante del golpe seco—; el titular sube suave. El #1 es más grande y golpea más fuerte.
    """
    numero = e.get("numero")
    items = []
    num_y = num_tam = 0
    if numero:
        fuerte = numero == 1
        num_tam = round((205 if fuerte else 175) * escala)
        num_y = H * (0.36 if tarjeta else 0.075)
        items.append((f"pn{k}", f"NÚMERO {numero}", num_y, num_tam, "top-num", "#ffe600"))
    if e.get("titular"):
        if tarjeta:
            y = H * (0.50 if numero else 0.46)
        elif numero:
            # La misma luz bajo el número en todos los puestos: el glifo de Anton ocupa ~1,17 em desde el tope
            # de la capa y el titular arranca ~0,31 em bajo el suyo, así que el #1 (más grande) baja lo justo
            # para que no se pegue — con una separación fija o con 0,72 em quedaba más corto.
            y = num_y + num_tam * 1.17 + round(11 * escala)
        else:
            y = H * 0.19
        tam = round((64 if tarjeta else 58) * escala)
        items.append((f"pt{k}", str(e["titular"]).upper(), y, tam, "top-tit", "#ffffff"))
    if not items:
        return None
    partes = []
    # El número/texto fantasma de las tarjetas: el mismo texto al ~9 % detrás de todo, con tamaño que quepa en el
    # ancho (Anton ~0,48 em por carácter). Solo en escenas sin material: con material taparía la foto.
    if tarjeta:
        fantasma = f"NÚMERO {numero}" if numero else str(e.get("titular") or "").upper()
        if fantasma:
            tam_f = min(H * 0.42, W * 0.92 / max(1, len(fantasma) * 0.48))
            partes.append(f'<div class="top-ghost" style="top:{round(H * 0.30)}px;font-size:{round(tam_f)}px;'
                          f'opacity:0.09">{esc(fantasma)}</div>')
    for iid, texto, y, tam, clase, color in items:
        contorno = max(3, round(tam * 0.06))
        partes.append(f'<div id="{iid}" class="{clase}" style="top:{round(y)}px;font-size:{tam}px;'
                      f'--top-contorno:{contorno}px;color:{color}">{esc(texto)}</div>')
    t0, t1 = e["t0"], e["t1"]
    cid = c.clip(t0, t1, "".join(partes), z, pieza="puesto")
    if numero:
        golpe_visual(c, f"pn{k}", t0, fuerte=numero == 1)
        flash(c, k, t0, fuerte=numero == 1)
    if e.get("titular"):
        c.at(f'tl.fromTo("#pt{k}",{{y:{round(H * 0.02)},opacity:0}},'
             f'{{y:0,opacity:1,duration:0.4,ease:"power2.out",immediateRender:false}},'
             f'{fr(t0) + 0.14:.4f});')
    return cid


def armar(escenas_t: list[dict], archivos: list[list], proyecto: Path, ancho: int, alto: int,
          total: float, audio: str | None = "sonido.wav", subs: list | None = None) -> dict:
    """
    La edición entera del proyecto: `src/edicion.json` con sus capas, su línea GSAP y sus escenas. Devuelve el JSON
    escrito (para `--revisa` o avisos). `total` es el final de la voz: la edición dura hasta el último `t1`.
    `subs` son las líneas de subtítulos karaoke (grupos de `grupos_de_lineas`), que van como capas dentro del
    video como en el documental — no hay `.ass` ni post-pase.
    """
    proyecto = Path(proyecto)
    # Comp.write trabaja con rutas relativas a public/ y src/, como el documental: se corre desde la raíz.
    antes = Path.cwd()
    os.chdir(proyecto)
    try:
        return _armar(escenas_t, archivos, proyecto, ancho, alto, total, audio, subs)
    finally:
        os.chdir(antes)


def _armar(escenas_t: list[dict], archivos: list[list], proyecto: Path, ancho: int, alto: int,
          total: float, audio: str | None, subs: list | None) -> dict:
    c = Comp(max([e["t1"] for e in escenas_t] + [total]), ancho, alto)
    escala = min(ancho / 1080, alto / 1920)
    k_global = 0
    for k, e in enumerate(escenas_t):
        t0, t1 = e["t0"], e["t1"]
        numero = e.get("numero")
        c.escena(f"Puesto {numero}" if numero else f"Escena {k + 1}", t0, t1)
        suyos = archivos[k] if k < len(archivos) else []
        material = e.get("material") or []
        if not suyos:
            # La tarjeta sobre fondo negro: el texto centrado, como render_tarjeta.
            c.clip(t0, t1, '<div class="top-fill top-tarjeta"></div>', 0, pieza="tarjeta")
            textos(c, k, e, tarjeta=True, escala=escala, W=ancho, H=alto)
            continue
        slot = (t1 - t0) / len(suyos)
        for j, (ruta, item) in enumerate(zip(suyos, material)):
            a = fr(t0 + j * slot)
            b = fr(t1 if j == len(suyos) - 1 else t0 + (j + 1) * slot)
            src = material_public(proyecto, ruta, k, j)
            if es_clip(item):
                cid = clip(c, a, b, src, desde_de(item), velocidad_de(item), z=1)
            else:
                cid = foto(c, a, b, src, k_global, z=1)
            punch(c, cid, a)
            k_global += 1
        textos(c, k, e, tarjeta=False, escala=escala, W=ancho, H=alto)
    subtitulos(c, subs or [], ancho, alto)
    c.write("src/edicion.json", tokens="public/assets/top/tokens.css", audio=audio,
            title=f"Top {escenas_t[0].get('numero') or ''}".strip() or "Top")
    return json.loads((proyecto / "src" / "edicion.json").read_text(encoding="utf-8"))
