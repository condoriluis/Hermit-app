"""director.py — de las escenas del video (`montaje.json` ya cronometado por `tiempos_de_escenas`) a la edición
entera.

El agente dice qué va en cada escena; el director pone lo demás con las medidas del formato, las mismas que usaba
el pipeline de ffmpeg: cada escena es su `imagen` a pantalla completa con el paneo Ken Burns (el zoompan a z
1.0↔1.15, alternando por escena) y el fundido de entrada y salida de 0,18 s — la transición editorial del
estilo—; el `titular` es el banner de alerta arriba en Archivo Black blanco con contorno negro; los subtítulos
son líneas de hasta 3 palabras —medidas con la fuente real por `grupos_de_lineas`, como en los demás
estilos— con la palabra de la cifra en amarillo y la de alarma en rojo (los regex del
`color_palabra` del pipeline viejo). Las imágenes van limpias, sin nada estampado encima: el estilo lo dice en
su contrato.

    armar(escenas_t, proyecto, ancho, alto, total, segmentos)   →  src/edicion.json

`escenas_t` es la salida de `tiempos_de_escenas` (cada escena con `t0`, `t1`, `imagen`, `titular`); `segmentos`
es la transcripción de la voz (los subtítulos se cronometan palabra a palabra con `palabras_tiempo`, como
hacía el `.ass`). El sonido (`public/sonido.wav`) lo pone hacer.py antes; aquí solo se apunta en la edición.
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
from subtitulos import grupos_de_lineas, linea, palabras_tiempo  # noqa: E402

# El titular de alerta: la medida del ASS viejo (0,52 del cuerpo de los subtítulos), centrado arriba al 4,5 %
# del alto — el alignment 8 con su MarginV.
TITULAR_DE_LETRA = 0.52
TITULAR_MARGEN = 0.045
# El fundido editorial de cada escena: 0,18 s entrando y saliendo, como el fade del pipeline viejo.
FUNDIDO = 0.18
PALABRAS_POR_BLOQUE = 3

# Las palabras que el formato pinta de otro color (los PATRON_* del pipeline viejo, tal cual).
PATRON_NUMEROS = re.compile(r"\d+[\d.,]*|\$|€|%|millon|millones|mil|dolar|dolares|pesos|euros|bitcoin", re.I)
PATRON_ALARMA = re.compile(r"escandalo|crisis|quiebra|despido|renuncia|traicion|culpable|fraude|corrupcion|deuda|alerta|urgente|peligro|secreto|estafa|conflicto", re.I)


def clase_palabra(palabra: str) -> str:
    """`num` para la cifra o el dinero (amarillo), `ala` para la alarma (rojo), nada para el blanco."""
    limpia = re.sub(r"[^\w$%]", "", palabra.lower())
    if PATRON_ALARMA.search(limpia):
        return "ala"
    if PATRON_NUMEROS.search(limpia):
        return "num"
    return ""


def imagen_public(proyecto: Path, archivo) -> str:
    """
    La ruta de la imagen relativa a `public/`, que es lo único que Remotion sirve. Lo que ya está en public/ se
    usa tal cual; lo demás (las descargas de `fuentes/material/` y las rutas del proyecto) entra por enlace
    duro en `public/material/i-<nombre>` — no ocupa disco y `fuentes/material/` sigue siendo la procedencia.
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
    destino = destino_dir / f"i-{p.name}"
    if not destino.exists():
        try:
            os.link(p, destino)
        except OSError:
            shutil.copy2(p, destino)
    return f"material/{destino.name}"


def imagen(c: Comp, k: int, e: dict, proyecto: Path, W: int, H: int):
    """
    La `imagen` de la escena a todo cuadro: el paneo Ken Burns del estilo (zoom 1,0↔1,15 alternando por escena,
    como el `i % 2` del zoompan) y el fundido de entrada y salida de 0,18 s sobre la capa entera — la
    transición editorial. GSAP empuja el paneo a 30 fps, suave donde `zoompan` era escalonado.
    """
    t0, t1 = e["t0"], e["t1"]
    src = imagen_public(proyecto, e["imagen"])
    iid = c.uid("img")
    s0, s1 = (1.0, 1.15) if k % 2 == 0 else (1.15, 1.0)
    inner = f'<div class="pol-img"><img id="{iid}" src="{esc(src)}"></div>'
    cid = c.clip(t0, t1, inner, 1, pieza="material")
    # El fundido de la escena: entra desde negro y se va a negro, sin mover los tiempos de nada más.
    c.at(f'tl.fromTo("#{cid}",{{opacity:0}},{{opacity:1,duration:{FUNDIDO},ease:"power1.out",immediateRender:false}},'
         f'{fr(t0):.4f});')
    c.at(f'tl.to("#{cid}",{{opacity:0,duration:{FUNDIDO},ease:"power1.in",immediateRender:false}},'
         f'{fr(t1 - FUNDIDO):.4f});')
    c.at(f'tl.fromTo("#{iid}",{{scale:{s0}}},{{scale:{s1},duration:{fr(t1) - fr(t0):.4f},ease:"none",immediateRender:false}},'
         f'{fr(t0):.4f});')
    return cid


def titular(c: Comp, k: int, e: dict, ancho: int, alto: int, z: int = 5):
    """
    El banner de alerta de la escena: el `titular` en Archivo Black mayúsculas, blanco con contorno negro,
    centrado arriba al 4,5 % del alto — el estilo Titular del ASS viejo. Vive lo que dura su escena y se apaga
    con ella; no se funde, aparece y desaparece como el texto quemado.
    """
    texto = str(e.get("titular") or "").strip()
    if not texto:
        return
    vertical = alto > ancho
    letra = round(ancho * 0.066) if vertical else round(alto * 0.078)
    tam = round(letra * TITULAR_DE_LETRA)
    contorno = max(round(letra * 0.07), 1)
    sombra = max(round(letra * 0.04), 1)
    margen = round(alto * TITULAR_MARGEN)
    # El titular también se mide con la fuente real: uno largo baja su cuerpo hasta que quepa en el marco.
    plano = " ".join(texto.upper().split())
    try:
        from PIL import ImageFont
        fuente = ImageFont.truetype(str(SKILL / "assets" / "fonts" / "ArchivoBlack-Regular.ttf"), tam)
        ancho_texto = fuente.getlength(plano) + 2 * contorno
        util = ancho - 120
        if ancho_texto > util:
            tam = max(round(tam * (util - 2 * contorno) / ancho_texto), 14)
    except Exception:
        pass
    inner = (f'<div class="pol-titular" style="font-size:{tam}px;top:{margen}px;'
             f'--pol-titular-contorno:{contorno}px;--pol-titular-sombra:{sombra}px">{esc(texto)}</div>')
    c.clip(e["t0"], e["t1"], inner, z, pieza="titular")


def subtitulos(c: Comp, segmentos: list, W: int, H: int, z: int = 85):
    """
    Los subtítulos de impacto dentro de la edición: líneas de hasta 3 palabras que aparecen juntas —los
    `palabras` del estilo de subtitulos.py— armadas por `grupos_de_lineas`, que mide cada palabra con la
    Archivo Black real y pasa a otra línea lo que no cabe en el marco: el cuerpo es siempre el mismo en todos
    los subtítulos y ninguna línea se sale del cuadro. Cada palabra va coloreada por su contenido (cifra en
    amarillo, alarma en rojo, resto en blanco con contorno negro). `segmentos` es la transcripción de la voz.
    """
    if not segmentos:
        return
    vertical = H > W
    letra = round(W * 0.066) if vertical else round(H * 0.078)
    margen = round(H * (0.25 if vertical else 0.10))
    contorno = max(round(letra * 0.14), 1)
    sombra = max(round(letra * 0.08), 1)
    # grupos_de_lineas calcula su propia letra como ancho × tam: se le pasa la misma que usa el render
    # (letra/W) para que la medida sea la del cuadro que se ve.
    estilo = {"palabras": PALABRAS_POR_BLOQUE, "archivo": "ArchivoBlack-Regular.ttf",
              "tam_v": letra / W, "tam_h": letra / W}
    palabras = [(ini, fin, texto) for ini, fin, texto in palabras_tiempo(segmentos, 0.0)]
    for g in grupos_de_lineas(palabras, estilo, W, H):
        partes = []
        for ini, fin, texto in g:
            w = linea(texto)
            if not w:
                continue
            plano = w.upper()
            clase = clase_palabra(plano)
            partes.append(f'<span class="{clase}">{esc(plano)}</span>' if clase else esc(plano))
        if not partes:
            continue
        t0, t1 = g[0][0], g[-1][1]
        if t1 - t0 < 1.0 / c.fps:
            continue
        inner = (f'<div class="pol-subs" style="font-size:{letra}px;bottom:{margen}px;'
                 f'--pol-contorno:{contorno}px;--pol-sombra:{sombra}px">{" ".join(partes)}</div>')
        c.clip(t0, t1, inner, z, pieza="subtitulo")


def armar(escenas_t: list[dict], proyecto: Path, ancho: int, alto: int,
          total: float, audio: str | None = "sonido.wav", segmentos: list | None = None,
          sonido: dict | None = None) -> dict:
    """
    La edición entera del proyecto: `src/edicion.json` con sus capas, su línea GSAP y sus escenas. Devuelve el JSON
    escrito (para `--revisa` o avisos). `total` es el final de la voz: la edición dura hasta el último `t1`.
    `segmentos` es la transcripción (los subtítulos de impacto se cronometan dentro de cada segmento).
    """
    proyecto = Path(proyecto)
    # Comp.write trabaja con rutas relativas a public/ y src/, como los demás estilos: se corre desde la raíz.
    antes = Path.cwd()
    os.chdir(proyecto)
    try:
        return _armar(escenas_t, proyecto, ancho, alto, total, audio, segmentos, sonido)
    finally:
        os.chdir(antes)


def _armar(escenas_t: list[dict], proyecto: Path, ancho: int, alto: int,
          total: float, audio: str | None, segmentos: list | None, sonido: dict | None) -> dict:
    c = Comp(max([e["t1"] for e in escenas_t] + [total]), ancho, alto)
    for k, e in enumerate(escenas_t):
        t0, t1 = e["t0"], e["t1"]
        c.escena(f"Escena {k + 1}", t0, t1)
        imagen(c, k, e, proyecto, ancho, alto)
        titular(c, k, e, ancho, alto)
    subtitulos(c, segmentos or [], ancho, alto)
    c.write("src/edicion.json", tokens="public/assets/politica/tokens.css", audio=audio,
            title="Política", sonido=sonido)
    return json.loads((proyecto / "src" / "edicion.json").read_text(encoding="utf-8"))
