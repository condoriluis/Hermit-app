"""
El material del video, todo de una vez y en paralelo: de lo que `momentos.json` pide en `material` (una referencia por
cosa: una foto, un clip, una página, un post, un logo) a `public/assets/m/`, ya bajado, tratado (`ev1_treat`,
`ev1_clip`) y al tamaño del video. Lo llama `hacer.py`; el agente no baja ni trata nada a mano.

De cada cosa deja en `work/material.json` sus archivos, de dónde salió, su licencia y si hay que revisar sus derechos,
y de todo, `FUENTES.md` (la tabla que ve el usuario) y `revision/material.jpg` (todo el material en una hoja, con su
nombre: se mira una vez). Lo que ya se bajó con el mismo pedido no se baja otra vez.

Una referencia es:
  foto    `commons:File:Nombre.jpg` · `nasa:<id>` · la URL de la imagen · la URL de la página donde sale (su og:image)
  clip    `mixkit:<id>` · `archive:<identificador>` · `commons:File:Nombre.webm` · `nasa:<id>` · `yt:<id>` · una URL .mp4
  pagina  la URL de la página (se captura como se ve; `marca`: el texto que se resalta; `selector`: solo ese bloque)
  post    la URL de un post de X (se captura su tarjeta)
  logo    el dominio de la marca (`anthropic.com`) o la URL de su imagen
  archivo una ruta del disco (lo que adjuntó el usuario): imagen o video
Las referencias de `mixkit:`, `archive:`, `commons:` y `nasa:` las da `buscar.py`.
"""

import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np

SKILL = Path(__file__).resolve().parent.parent
BASE = SKILL.parent / "video-base" / "scripts"
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(BASE))
import ev1_clip  # noqa: E402
import ev1_treat  # noqa: E402
from formato import tamano  # noqa: E402

from bancos import AGENTE, API, Falla, bajar_a, commons_de_una, pedir, resolver  # noqa: E402

TIPOS = ("foto", "clip", "pagina", "post", "logo", "archivo")
LOOKS_FOTO = ("natural", "mono", "teal", "warm", "deep", "invert")
LOOKS_CLIP = tuple(ev1_clip.LOOKS)
# Los tratamientos por omisión, en el reparto medido en las referencias (look.md): de cada ocho imágenes, tres al
# natural, dos teal, dos en blanco y negro duro y una ámbar. Lo elige el orden en que sale cada cosa, no el azar.
RUEDA = ("teal", "natural", "mono", "natural", "warm", "teal", "mono", "natural")
VIDEO = (".mp4", ".webm", ".mov", ".m4v", ".mkv", ".ogv")
IMAGEN = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif")


# ------------------------------------------------------------------ cada tipo
def abrir_imagen(datos: bytes) -> np.ndarray:
    """Los bytes de una imagen como BGR; lo transparente, sobre blanco (un diagrama en PNG quedaba negro)."""
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(datos))
        im.load()
    except Exception as e:  # noqa: BLE001
        raise Falla(f"lo que bajó no es una imagen ({e})") from None
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        fondo = Image.new("RGB", im.size, "white")
        fondo.paste(im, mask=im.getchannel("A"))
        im = fondo
    return cv2.cvtColor(np.asarray(im.convert("RGB")), cv2.COLOR_RGB2BGR)


def vacia(im: np.ndarray) -> bool:
    """Una imagen casi de un solo color: una captura en blanco (un muro de cookies, un control de bots) o un negro."""
    chica = cv2.resize(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (96, 96), interpolation=cv2.INTER_AREA)
    return float(chica.std()) < 7


def luz(im: np.ndarray) -> float:
    """Qué tan clara es (0 a 1) la franja donde van los subtítulos: sobre lo claro van en tinta."""
    h = im.shape[0]
    a, b = (0.56, 0.70) if im.shape[0] > im.shape[1] else (0.42, 0.58)
    return round(float(cv2.cvtColor(im[int(h * a):int(h * b)], cv2.COLOR_BGR2GRAY).mean()) / 255, 3)


def tarjeta_de(im: np.ndarray, ancho: int = 1400) -> np.ndarray:
    """La misma imagen como tarjeta (en un collage, un muro, una ráfaga): entera, sin recortar, a `ancho` como mucho."""
    if im.shape[1] > ancho:
        im = cv2.resize(im, (ancho, round(im.shape[0] * ancho / im.shape[1])), interpolation=cv2.INTER_AREA)
    return im


def hacer_foto(id_: str, c: dict, crudo: bytes, destino: Path, k: int) -> dict:
    W, H = tamano()
    im = abrir_imagen(crudo)
    if min(im.shape[:2]) < 300:
        raise Falla(f"la imagen es muy chica ({im.shape[1]}×{im.shape[0]}): busca otra más grande")
    if vacia(im):
        raise Falla("la imagen es casi de un solo color (no enseña nada): busca otra")
    look = c.get("look") or RUEDA[k % len(RUEDA)]
    foco = tuple(c.get("foco") or (0.5, 0.5))
    # A cuadro completo va un 10 % más grande que el cuadro: el empuje lento no enseña el borde.
    llena = ev1_treat.treat(im, str(destino / f"{id_}.jpg"), look, (round(W * 1.1), round(H * 1.1)), foco,
                            ht=float(c.get("semitono", 0.22 if look in ("teal", "mono") else 0)), vig=0.74,
                            rec=tuple(c["recolor"]) if c.get("recolor") else None)
    cv2.imwrite(str(destino / f"{id_}-t.jpg"), tarjeta_de(ev1_treat.look(im, "natural")), [cv2.IMWRITE_JPEG_QUALITY, 90])
    return {"lleno": f"assets/m/{id_}.jpg", "tarjeta": f"assets/m/{id_}-t.jpg", "luz": luz(llena), "look": look,
            "proporcion": round(im.shape[1] / im.shape[0], 3)}


def agente_de(url: str) -> list[str]:
    """Con una URL, FFmpeg se presenta como un navegador (o con el agente de contacto en Wikimedia, que al suyo le
    contesta 429 a la segunda petición)."""
    if not str(url).startswith("http"):
        return []
    return ["-user_agent", (API if "wikimedia.org" in url else AGENTE)["User-Agent"]]


def duracion_de(url: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", *agente_de(url), "-show_entries", "format=duration", "-of", "csv=p=0", url],
                       capture_output=True, text=True, timeout=40)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def de_youtube(id_: str, desde: float, dura: float, crudo: Path) -> str:
    """El tramo de un video de YouTube, con el yt-dlp del Python de Hermit (en su turno: va de uno en uno)."""
    from hermit import hermit
    salida = crudo.with_suffix(".mp4")
    r = hermit("-m", "yt_dlp", "-q", "--no-warnings", "--no-playlist", "-f", "bv*[height<=1080][ext=mp4]/bv*[height<=1080]/b",
              "--download-sections", f"*{desde:.2f}-{desde + dura + 1:.2f}", "--force-keyframes-at-cuts", "-o", str(salida),
              f"https://www.youtube.com/watch?v={id_}", capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode or not salida.exists():
        raise Falla(f"YouTube no dio el tramo ({(r.stderr or r.stdout).strip()[-160:]})")
    return str(salida)


def hacer_clip(id_: str, c: dict, origen: dict, destino: Path, crudos: Path, dura: float, k: int) -> dict:
    W, H = tamano()
    url = origen["url"]
    look = c.get("look") or ("archive" if c["clip"].startswith("archive:") else RUEDA[k % len(RUEDA)])
    if look not in LOOKS_CLIP:
        look = "natural"
    velocidad = float(c.get("velocidad", 1))
    pide = dura * velocidad + 0.4
    if origen.get("bajar"):
        # Los videos de Wikimedia se bajan enteros antes de cortarlos: leídos a trozos por FFmpeg contestaban 429.
        url = bajar_a(url, crudos / f"{id_}{Path(urllib.parse.urlparse(url).path).suffix or '.webm'}")
    if url.startswith("yt:"):
        desde = float(c.get("desde", 0))
        url, corte = de_youtube(url[3:], desde, pide, crudos / id_), 0.0
    else:
        corte = c.get("desde")
        if corte is None:
            # Nunca la mitad del archivo ni su primer cuadro: una película de archivo abre con su rótulo y un clip de
            # banco, con un fundido. Un quinto adentro, sin pasarse de lo que dura.
            total = duracion_de(url)
            corte = 0.5 if not total else max(0.3, min(total * 0.2, max(0.0, total - pide - 0.5)))
    salida = destino / f"{id_}.mp4"
    try:
        ev1_clip.make(url, str(salida), float(corte), dura + 0.2, look, velocidad, tuple(c.get("foco") or (0.5, 0.5)),
                      float(c.get("zoom", 1)), size=(W, H), antes=agente_de(url))
    except subprocess.CalledProcessError as e:
        dijo = next((l.strip() for l in reversed((e.stderr or "").splitlines()) if l.strip()), "")[:140]
        limite = "429" in dijo or "403" in dijo
        raise Falla("el sitio no dejó bajar el clip: elige otro de busca.jpg" if limite else
                    f"no se pudo cortar el clip (¿`desde` pasa de lo que dura?): {dijo}") from None
    real = duracion_de(str(salida))
    if real < min(dura, 0.5) - 0.15:
        raise Falla(f"el clip dio {real:.1f} s y hacen falta {dura:.1f}: baja `desde` o usa otro")
    ok, cuadro = cv2.VideoCapture(str(salida)).read()
    if not ok:
        raise Falla("el clip salió sin imagen")
    if vacia(cuadro):
        ok2, otro = False, None
        cap = cv2.VideoCapture(str(salida))
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(real * 30) - 3))
        ok2, otro = cap.read()
        if not ok2 or vacia(otro):
            raise Falla("el clip es un plano negro o de un solo color en ese tramo: cambia `desde` o usa otro")
        cuadro = otro
    cv2.imwrite(str(destino / f"{id_}-t.jpg"), tarjeta_de(cuadro), [cv2.IMWRITE_JPEG_QUALITY, 90])
    return {"clip": f"assets/m/{id_}.mp4", "tarjeta": f"assets/m/{id_}-t.jpg", "lleno": f"assets/m/{id_}-t.jpg", "luz": luz(cuadro),
            "look": look, "dura": round(real, 2), "desde": round(float(corte), 2), "proporcion": round(W / H, 3)}


def hacer_logo(id_: str, c: dict, destino: Path) -> dict:
    from PIL import Image
    ref = str(c["logo"])
    dominio = ref if not ref.startswith("http") else urllib.parse.urlparse(ref).netloc
    # El ícono grande que da Google de ese sitio y, si es chico (chatgpt.com daba 48 px), el que el propio sitio pone
    # para el teléfono. El más grande gana; uno chico se usa igual, que un logo no para el video.
    fuentes = [ref] if ref.startswith("http") else [f"https://www.google.com/s2/favicons?domain={ref}&sz=256",
                                                    f"https://{ref}/apple-touch-icon.png", f"https://www.{ref}/apple-touch-icon.png"]
    im, falla = None, ""
    for url in fuentes:
        try:
            otra = Image.open(io.BytesIO(pedir(url, espera=10)[0])).convert("RGBA")
        except Exception as e:  # noqa: BLE001
            falla = str(e)
            continue
        if im is None or min(otra.size) > min(im.size):
            im = otra
        if min(im.size) >= 120:
            break
    if im is None:
        raise Falla(f"no salió el logo de {dominio} ({falla}): da la URL de su imagen o usa su `pagina`")
    if min(im.size) < 120:
        im = im.resize((im.size[0] * 240 // min(im.size), im.size[1] * 240 // min(im.size)), Image.LANCZOS)
    im.save(destino / f"{id_}.png")
    return {"logo": f"assets/m/{id_}.png", "tarjeta": f"assets/m/{id_}.png", "luz": 0.0, "proporcion": round(im.size[0] / im.size[1], 3),
            "origen": {"pagina": f"https://{dominio}" if not ref.startswith("http") else ref, "licencia": f"marca de {dominio}", "revisar": ""}}


def hacer_archivo(id_: str, c: dict, destino: Path, crudos: Path, dura: float, k: int, raiz: Path) -> dict:
    ruta = Path(str(c["archivo"]))
    ruta = ruta if ruta.is_absolute() else raiz / ruta
    if not ruta.is_file():
        raise Falla(f"no existe el archivo {ruta}")
    origen = {"pagina": str(ruta), "licencia": "del usuario", "revisar": ""}
    if ruta.suffix.lower() in VIDEO:
        r = hacer_clip(id_, {**c, "clip": str(ruta), "look": c.get("look") or "natural"}, {"url": str(ruta)}, destino, crudos, dura, k)
    else:
        r = hacer_foto(id_, {**c, "look": c.get("look") or "natural"}, ruta.read_bytes(), destino, k)
    return {**r, "origen": origen}


def capturar(trabajos: list[dict], crudos: Path) -> dict:
    """Las páginas y los posts, con `capture.mjs`, en hasta tres Chrome a la vez. De cada uno, su PNG y lo que se marca."""
    if not trabajos:
        return {}
    grupos = [trabajos[i::3] for i in range(min(3, len(trabajos)))]

    def uno(k: int, grupo: list[dict]) -> str:
        lista = crudos / f"capturas-{k}.json"
        lista.write_text(json.dumps(grupo, ensure_ascii=False), encoding="utf-8")
        r = subprocess.run(["node", str(SKILL / "scripts" / "capture.mjs"), str(lista), str(crudos)], capture_output=True,
                           text=True, encoding="utf-8", errors="replace", timeout=240)
        return r.stdout + r.stderr

    with ThreadPoolExecutor(3) as ex:
        salidas = list(ex.map(lambda p: uno(*p), enumerate(grupos)))
    return {t["name"]: "\n".join(salidas) for t in trabajos}


def trabajo_de_captura(id_: str, c: dict) -> dict:
    """El pedido a `capture.mjs`: la página como se ve en el cuadro del video (de teléfono si es vertical)."""
    W, H = tamano()
    vertical = H > W
    if "post" in c:
        m = re.search(r"/status(?:es)?/(\d+)", str(c["post"]))
        if not m:
            raise Falla("`post` es la URL de un post de X (…/status/<número>)")
        return {"name": id_, "url": f"https://platform.twitter.com/embed/Tweet.html?id={m.group(1)}&theme=dark&lang=es",
                "w": 620, "h": 900, "dsf": 2, "selector": "article", "pad": 0, "wait": 3500}
    t = {"name": id_, "url": c["pagina"], "wait": int(c.get("espera", 2500))}
    t.update({"w": 432, "h": 768, "dsf": 2.5, "mobile": True} if vertical else {"w": 1280, "h": 720, "dsf": 1.5})
    if c.get("selector"):
        t.update({"selector": c["selector"], "pad": 12, "dsf": 2})
    if c.get("marca"):
        t["marca"] = c["marca"]
    if c.get("baja"):
        t["baja"] = c["baja"]
    return t


def hacer_captura(id_: str, c: dict, crudos: Path, destino: Path, registro: str) -> dict:
    W, H = tamano()
    png = crudos / f"{id_}.png"
    if not png.exists():
        linea = next((l for l in registro.splitlines() if l.startswith(("MISS", "FAIL")) and id_ in l), "")
        raise Falla("la página no se pudo capturar" + (f" ({linea})" if linea else "") + ": usa otra página o su foto (`foto`)")
    im = cv2.imread(str(png))
    if im is None or vacia(im):
        raise Falla("la captura salió en blanco (un muro de cookies o un control de bots): usa otra página (la de su "
                    "documentación suele abrir) o su foto (`foto`)")
    marcas_json = crudos / f"{id_}.marcas.json"
    marcas = json.loads(marcas_json.read_text(encoding="utf-8")) if marcas_json.exists() else []
    es_tarjeta = "post" in c or bool(c.get("selector"))
    dominio = urllib.parse.urlparse(str(c.get("pagina") or c.get("post"))).netloc.removeprefix("www.")
    origen = {"pagina": c.get("pagina") or c.get("post"), "licencia": f"captura de {dominio}", "revisar": ""}
    if c.get("marca") and not marcas:
        origen["revisar"] = f"no encontré «{c['marca']}» en la página: va sin resaltar"
    if es_tarjeta:
        cv2.imwrite(str(destino / f"{id_}-t.png"), tarjeta_de(im, 1600))
        return {"tarjeta": f"assets/m/{id_}-t.png", "lleno": f"assets/m/{id_}-t.png", "luz": luz(im), "marcas": marcas, "es_tarjeta": True,
                "proporcion": round(im.shape[1] / im.shape[0], 3), "ancho": int(min(im.shape[1], 1600)), "origen": origen}
    # La captura ya sale con la proporción del cuadro: se ajusta a su tamaño exacto y las marcas con ella.
    k = W / im.shape[1]
    im = cv2.resize(im, (W, round(im.shape[0] * k)), interpolation=cv2.INTER_AREA)[:H]
    if im.shape[0] < H:
        im = cv2.copyMakeBorder(im, 0, H - im.shape[0], 0, 0, cv2.BORDER_REPLICATE)
    cv2.imwrite(str(destino / f"{id_}.jpg"), im, [cv2.IMWRITE_JPEG_QUALITY, 92])
    cv2.imwrite(str(destino / f"{id_}-t.jpg"), tarjeta_de(im), [cv2.IMWRITE_JPEG_QUALITY, 90])
    return {"pagina": f"assets/m/{id_}.jpg", "lleno": f"assets/m/{id_}.jpg", "tarjeta": f"assets/m/{id_}-t.jpg", "luz": luz(im),
            "marcas": [[round(v * k) for v in m] for m in marcas if m[1] * k < H], "proporcion": round(W / H, 3), "origen": origen}


# ------------------------------------------------------------------ todo junto
def tipo_de(c: dict) -> str | None:
    presentes = [t for t in TIPOS if t in c]
    return presentes[0] if len(presentes) == 1 else None


def revisar(material: dict) -> list[str]:
    """Lo que se puede decir de `material` sin bajar nada."""
    errores = []
    for id_, c in material.items():
        que = f"material «{id_}»"
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", id_):
            errores.append(f"{que}: el nombre va en minúsculas, con letras, números y guiones")
        if not isinstance(c, dict) or not tipo_de(c):
            errores.append(f"{que}: lleva una sola de {', '.join(TIPOS)}")
            continue
        tipo = tipo_de(c)
        ref = str(c[tipo])
        if tipo == "clip" and ref.startswith("http") and not ref.lower().split("?")[0].endswith(VIDEO):
            errores.append(f"{que}: `clip` con una URL pide la del archivo de video (.mp4, .webm); de una página no sale. "
                           "Usa una referencia de buscar.py (`mixkit:`, `archive:`, `commons:`, `nasa:`) o `yt:<id>`")
        if tipo == "clip" and ref.startswith("commons:") and not ref.lower().endswith(VIDEO):
            errores.append(f"{que}: «{ref}» es una imagen de Commons: va en `foto`")
        if tipo == "foto" and ref.lower().split("?")[0].endswith(VIDEO):
            errores.append(f"{que}: «{ref}» es un video: va en `clip`")
        if tipo in ("pagina", "post") and not ref.startswith("http"):
            errores.append(f"{que}: `{tipo}` es una URL")
        look = c.get("look")
        if look and look not in (LOOKS_CLIP if tipo == "clip" else LOOKS_FOTO):
            errores.append(f"{que}: no hay look «{look}» (hay: {', '.join(LOOKS_CLIP if tipo == 'clip' else LOOKS_FOTO)})")
        if c.get("foco") and not (isinstance(c["foco"], list) and len(c["foco"]) == 2):
            errores.append(f"{que}: `foco` es [x, y], de 0 a 1 (dónde está lo que importa en la imagen)")
    return errores


def firma(c: dict, dura: float) -> str:
    return hashlib.sha1(json.dumps([c, round(dura * 2) / 2, tamano()], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


def traer(raiz: Path, material: dict, duras: dict[str, float]) -> tuple[dict, list[str]]:
    """
    Todo el material, en paralelo. `duras`: los segundos que cada clip tiene que durar (lo que suman sus momentos).
    Devuelve lo hecho (work/material.json) y lo que falló, todo de una vez.
    """
    destino, crudos = raiz / "public" / "assets" / "m", raiz / "work" / "crudo"
    destino.mkdir(parents=True, exist_ok=True)
    crudos.mkdir(parents=True, exist_ok=True)
    archivo = raiz / "work" / "material.json"
    hecho = json.loads(archivo.read_text(encoding="utf-8")) if archivo.exists() else {}
    for h in hecho.values():
        h.pop("s", None)  # los segundos son de lo que se baja en esta vuelta
    orden = {id_: k for k, id_ in enumerate(material)}
    firmas = {id_: firma(c, duras.get(id_, 0)) for id_, c in material.items()}

    def vale(id_: str) -> bool:
        h = hecho.get(id_)
        return bool(h) and h.get("firma") == firmas[id_] and all((raiz / "public" / h[k]).exists() for k in ("lleno", "tarjeta", "clip", "logo", "pagina") if h.get(k))

    faltan = [id_ for id_ in material if not vale(id_)]
    errores: dict[str, str] = {}
    capturas, trabajos = {}, []
    for id_ in faltan:
        if tipo_de(material[id_]) in ("pagina", "post"):
            (crudos / f"{id_}.png").unlink(missing_ok=True)
            (crudos / f"{id_}.marcas.json").unlink(missing_ok=True)
            try:
                trabajos.append(trabajo_de_captura(id_, material[id_]))
            except Falla as e:
                errores[id_] = str(e)

    de_commons_todos = [str(material[i][t])[8:] for i in faltan for t in ("foto", "clip") if str(material[i].get(t, "")).startswith("commons:")]
    if de_commons_todos:
        commons_de_una(de_commons_todos)

    def uno(id_: str) -> tuple[str, dict | None, str]:
        c, k = material[id_], orden[id_]
        tipo = tipo_de(c)
        inicio = time.time()
        try:
            if tipo == "foto":
                origen = resolver("foto", str(c["foto"]))
                datos = origen.pop("datos", None) or pedir(origen["url"])[0]
                r = {**hacer_foto(id_, c, datos, destino, k), "origen": origen}
            elif tipo == "clip":
                try:
                    origen = resolver("clip", str(c["clip"]))
                except Falla:
                    # Una referencia de NASA puesta tal cual en `ve` puede ser una foto: su id no lo dice.
                    if not str(c["clip"]).startswith("nasa:"):
                        raise
                    origen = resolver("foto", str(c["clip"]))
                    return id_, {**hacer_foto(id_, c, pedir(origen["url"])[0], destino, k), "origen": origen, "tipo": "foto",
                                 "firma": firmas[id_], "s": round(time.time() - inicio, 1)}, ""
                r = {**hacer_clip(id_, c, origen, destino, crudos, max(0.6, duras.get(id_, 1.5)), k), "origen": origen}
            elif tipo == "logo":
                r = hacer_logo(id_, c, destino)
            elif tipo == "archivo":
                r = hacer_archivo(id_, c, destino, crudos, max(0.6, duras.get(id_, 1.5)), k, raiz)
            else:
                return id_, None, ""
            return id_, {**r, "tipo": tipo if tipo != "archivo" else ("clip" if "clip" in r else "foto"), "firma": firmas[id_],
                         "s": round(time.time() - inicio, 1)}, ""
        except Falla as e:
            return id_, None, str(e)
        except Exception as e:  # noqa: BLE001 — una cosa que truena no tumba las demás
            return id_, None, f"{type(e).__name__}: {e}"

    with ThreadPoolExecutor(8) as ex:
        tarea_capturas = ex.submit(capturar, trabajos, crudos)
        for id_, r, error in ex.map(uno, [i for i in faltan if tipo_de(material[i]) not in ("pagina", "post")]):
            if r:
                hecho[id_] = r
            elif error:
                errores[id_] = error
        capturas = tarea_capturas.result()
    for t in trabajos:
        id_ = t["name"]
        try:
            hecho[id_] = {**hacer_captura(id_, material[id_], crudos, destino, capturas.get(id_, "")),
                          "tipo": "post" if "post" in material[id_] else "pagina", "firma": firmas[id_]}
        except Falla as e:
            errores[id_] = str(e)
    hecho = {id_: hecho[id_] for id_ in material if id_ in hecho and id_ not in errores}
    tmp = archivo.with_suffix(".tmp")
    tmp.write_text(json.dumps(hecho, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    os.replace(tmp, archivo)
    return hecho, [f"material «{id_}»: {e}" for id_, e in errores.items()]


def fuentes(raiz: Path, material: dict, hecho: dict) -> list[str]:
    """FUENTES.md: de dónde salió cada cosa, su licencia y lo que el usuario tiene que decidir. Devuelve lo marcado."""
    lineas = ["# Fuentes del material", "",
              "Lo marcado en «Revisar» lo decides tú antes de publicar: el video se entrega para que lo veas, no se sube solo.", "",
              "| Material | Qué es | De dónde | Licencia | Revisar |", "|---|---|---|---|---|"]
    marcados: dict[str, list[str]] = {}
    for id_, c in material.items():
        h = hecho.get(id_)
        if not h:
            continue
        o = h.get("origen", {})
        if o.get("revisar"):
            marcados.setdefault(o["revisar"], []).append(id_)
        lineas.append(f"| {id_} | {h['tipo']} | {o.get('pagina', '')} | {o.get('licencia', '')} | {o.get('revisar', '')} |")
    (raiz / "FUENTES.md").write_text("\n".join(lineas) + "\n", encoding="utf-8", newline="\n")
    # Una línea por motivo, no por cosa: doce fotos de Commons con la misma licencia son un solo aviso.
    return [f"{motivo}: {', '.join(ids)}" for motivo, ids in marcados.items()]


def hoja(raiz: Path, hecho: dict, columnas: int = 6, lado: int = 250) -> Path | None:
    """Todo el material en una sola imagen, cada cosa con su nombre: lo que el agente mira una vez."""
    if not hecho:
        return None
    from PIL import Image, ImageDraw
    filas = -(-len(hecho) // columnas)
    alto = round(lado * 0.62) + 26
    lienzo = Image.new("RGB", (columnas * lado, filas * alto), (24, 24, 26))
    d = ImageDraw.Draw(lienzo)
    for i, (id_, h) in enumerate(hecho.items()):
        x, y = (i % columnas) * lado, (i // columnas) * alto
        try:
            im = Image.open(raiz / "public" / h["tarjeta"]).convert("RGB")
            im.thumbnail((lado - 6, alto - 28))
            lienzo.paste(im, (x + (lado - im.width) // 2, y + 24))
        except Exception:  # noqa: BLE001
            d.text((x + 8, y + 60), "sin imagen", fill=(220, 90, 90))
        d.text((x + 4, y + 5), f"{id_} · {h['tipo']}"[:38], fill=(255, 220, 0))
    salida = raiz / "revision" / "material.jpg"
    salida.parent.mkdir(exist_ok=True)
    lienzo.save(salida, quality=84)
    return salida
