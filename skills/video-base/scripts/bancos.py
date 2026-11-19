"""
Los bancos de material con licencia: de dónde se baja una foto o un clip y con qué derechos queda anotado.

    from bancos import resolver, bajar_a, pedir, Falla

Referencias (las mismas que documenta `video-documental/scripts/buscar.py` y `material.py`):
  foto    `commons:File:Nombre.jpg` · `nasa:<id>` · la URL de la imagen · la URL de la página (su og:image)
  clip    `mixkit:<id>` · `archive:<identificador>` · `commons:File:Nombre.webm` · `nasa:<id>` · `yt:<id>` · una URL .mp4

`resolver(tipo, ref)` devuelve `{"url", "pagina", "licencia", "revisar", ...}`: la dirección de donde bajarlo, la
página de su ficha y la licencia. `revisar` vacío = se puede usar; con texto = hay que comprobar derechos antes de
publicar (clips de YouTube y de dominios ajenos, fotos de páginas). `bajar_a(url, destino)` lo deja en disco sin
bajarlo dos veces. Todo con el agente de contacto que Wikimedia pide y con esperas ante los 429.

Las fuentes: Mixkit (su licencia libre), Wikimedia Commons (la licencia de cada archivo), archive.org (Prelinger y
demás: dominio público o la que diga su ficha), NASA (dominio público). Nada de personas reales generadas: si el
plano necesita gente, se busca material que ya la tenga con su licencia, o se usa `archivo:` del usuario.
"""

import html
import json
import os
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

AGENTE = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
          "Accept-Language": "es,en;q=0.8"}
# Wikimedia pide un agente que diga quién es y dónde encontrarlo; a uno genérico le contesta 429 enseguida.
API = {"User-Agent": os.environ.get("HERMIT_CONTACT_UA") or os.environ.get("EV1_CONTACT_UA") or "Hermit/2.0 (edicion de video)"}


class Falla(Exception):
    """Lo que no salió de una cosa, dicho para que el agente lo arregle en su pedido de material."""


# Wikimedia y Mixkit cortan a quien les pide muchas cosas a la vez (429): Wikimedia, de cinco en cinco y con su agente
# de contacto (a su API se le pregunta todo de una vez, `commons_de_una`); las páginas de Mixkit, de tres en tres.
WIKIMEDIA = threading.Semaphore(5)
MIXKIT = threading.Semaphore(3)
LIBRE = threading.Semaphore(64)


def con_curl(url: str, cabeceras: dict, espera: int) -> bytes | None:
    """La misma página con curl (viene con Windows, Mac y Linux); None si no hay curl o tampoco pasa."""
    try:
        r = subprocess.run(["curl", "-s", "-L", "--max-time", str(espera), "-A", cabeceras.get("User-Agent", ""),
                            "-H", f"Accept-Language: {cabeceras.get('Accept-Language', 'es,en;q=0.8')}", url],
                           capture_output=True, timeout=espera + 5)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 and r.stdout and b"Just a moment" not in r.stdout[:2000] else None


def pedir(url: str, cabeceras: dict = AGENTE, espera: int = 25) -> tuple[bytes, str]:
    """Baja una URL. Si el sitio dice que son demasiadas a la vez (429) o está ocupado (503), espera y lo pide otra vez."""
    wikimedia = "wikimedia.org" in url or "wikipedia.org" in url
    if wikimedia:
        cabeceras = API
    turno = WIKIMEDIA if wikimedia else MIXKIT if "//mixkit.co/" in url else LIBRE
    for vuelta in range(3):
        try:
            with turno, urllib.request.urlopen(urllib.request.Request(url, headers=cabeceras), timeout=espera) as r:
                return r.read(), r.headers.get("content-type", "")
        except urllib.error.HTTPError as e:
            # Cloudflare a veces le pone su «Just a moment…» a Python (por cómo saluda, no por lo que pide) y a curl no:
            # Mixkit lo hizo tras una tarde de búsquedas (11 nov 2026). Antes de darlo por perdido, con curl.
            if e.code in (403, 429, 503) and b"Just a moment" in e.read(2000):
                datos = con_curl(url, cabeceras, espera)
                if datos is not None:
                    return datos, "text/html"
            if e.code in (429, 503) and vuelta < 2:
                time.sleep(min(5.0, float(e.headers.get("Retry-After") or 0) or 2.0 * (vuelta + 1)))
                continue
            raise Falla(f"no bajó {url[:90]} (HTTP {e.code})") from None
        except Exception as e:  # noqa: BLE001
            raise Falla(f"no bajó {url[:90]} ({type(e).__name__}: {e})") from None
    raise Falla(f"no bajó {url[:90]}")


def pedir_json(url: str):
    return json.loads(pedir(url, API)[0])


def bajar_a(url: str, destino: Path, tope: int = 200_000_000) -> str:
    """Un archivo entero al disco (si ya está, no se baja otra vez). Para si pasa de `tope` bytes."""
    if destino.exists() and destino.stat().st_size > 10_000:
        return str(destino)
    wikimedia = "wikimedia.org" in url
    try:
        with (WIKIMEDIA if wikimedia else LIBRE), urllib.request.urlopen(
                urllib.request.Request(url, headers=API if wikimedia else AGENTE), timeout=60) as r, open(destino, "wb") as f:
            total = 0
            while True:
                trozo = r.read(1 << 20)
                if not trozo:
                    break
                total += len(trozo)
                if total > tope:
                    raise Falla(f"el video pesa más de {tope // 1_000_000} MB: usa otro, o `yt:` con su `desde`")
                f.write(trozo)
    except Falla:
        destino.unlink(missing_ok=True)
        raise
    except Exception as e:  # noqa: BLE001
        destino.unlink(missing_ok=True)
        raise Falla(f"no bajó el video ({type(e).__name__}: {e}): elige otro de busca.jpg") from None
    return str(destino)


def sin_html(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


# ------------------------------------------------------------------ de la referencia a su URL y su licencia
COMMONS: dict[str, dict] = {}


def commons_de_una(titulos: list[str], ancho: int = 2000) -> None:
    """Todos los archivos de Commons que pide el video, en una sola pregunta a su API (de uno en uno contesta 429)."""
    titulos = [t if t.lower().startswith("file:") else "File:" + t for t in dict.fromkeys(titulos)]
    for i in range(0, len(titulos), 40):
        tanda = titulos[i:i + 40]
        try:
            d = pedir_json("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo|videoinfo"
                           f"&iiprop=url|extmetadata|mime&viprop=derivatives&iiurlwidth={ancho}&titles=" + urllib.parse.quote("|".join(tanda)))
        except Falla:
            continue
        q = d.get("query", {})
        nombre = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for pagina in q.get("pages", {}).values():
            COMMONS[nombre.get(pagina.get("title"), pagina.get("title"))] = pagina


def de_commons(titulo: str, ancho: int = 2000) -> dict:
    """Un archivo de Wikimedia Commons: su URL (la imagen, a `ancho` px), su licencia y su autor."""
    if not titulo.lower().startswith("file:"):
        titulo = "File:" + titulo
    if titulo not in COMMONS:
        commons_de_una([titulo], ancho)
    pagina = COMMONS.get(titulo, {})
    if "imageinfo" not in pagina:
        raise Falla(f"Commons no tiene «{titulo}» (cópialo tal cual de buscar.py)")
    ii = pagina["imageinfo"][0]
    meta = ii.get("extmetadata", {})
    licencia = sin_html(meta.get("LicenseShortName", {}).get("value", "")) or "ver ficha"
    autor = sin_html(meta.get("Artist", {}).get("value", ""))[:60]
    es_video = ii.get("mime", "").startswith("video")
    url = ii["url"] if es_video else ii.get("thumburl") or ii["url"]
    if es_video:
        # De un video, la versión de 720 (o la más cercana) que Commons ya tiene hecha: el original pesa cientos de MB.
        versiones = [v for v in (pagina.get("videoinfo") or [{}])[0].get("derivatives", []) if str(v.get("src", "")).endswith((".webm", ".mp4"))]
        if versiones:
            # La más chica de 720 para arriba; si no hay, la más grande de las de abajo.
            url = min(versiones, key=lambda v: ((v.get("height") or 0) < 720, abs((v.get("height") or 0) - 720)))["src"]
    return {"url": url, "bajar": es_video, "pagina": ii.get("descriptionurl", ""),
            "licencia": licencia + (f", {autor}" if autor else ""),
            "revisar": "" if re.search(r"public domain|cc0|pd", licencia, re.I) else "pide crédito en la descripción" if "by" in licencia.lower() else ""}


def de_nasa(id_: str, video: bool) -> dict:
    """Un medio de la biblioteca de NASA (dominio público): la imagen original o su mp4."""
    lista = pedir_json(f"https://images-api.nasa.gov/asset/{urllib.parse.quote(id_)}")["collection"]["items"]
    urls = [i["href"].replace("http://", "https://") for i in lista]
    if video:
        elegidos = [u for u in urls if u.lower().endswith(".mp4")]
        orden = ("~medium.mp4", "~large.mp4", "~orig.mp4", ".mp4")
    else:
        elegidos = [u for u in urls if u.lower().endswith((".jpg", ".jpeg", ".png"))]
        orden = ("~large.jpg", "~orig.jpg", "~medium.jpg", ".jpg", ".png")
    for fin in orden:
        for u in elegidos:
            if u.lower().endswith(fin):
                return {"url": urllib.parse.quote(u, safe=":/~%"), "pagina": f"https://images.nasa.gov/details/{id_}",
                        "licencia": "dominio público (NASA)", "revisar": ""}
    raise Falla(f"NASA no tiene {'video' if video else 'imagen'} en «{id_}»")


def de_archive(ident: str) -> dict:
    """Una película de archive.org: su mp4 más ligero que sirva (los de 512 kb se abren por rangos sin bajar todo)."""
    md = pedir_json(f"https://archive.org/metadata/{urllib.parse.quote(ident)}")
    mp4 = [f for f in md.get("files", []) if f.get("name", "").lower().endswith(".mp4")]
    if not mp4:
        raise Falla(f"archive.org no tiene un mp4 en «{ident}»")
    mp4.sort(key=lambda f: int(f.get("size", 0) or 0))
    # El más chico de 2 MB o más: los `_512kb.mp4` bastan para un plano de un segundo y abren al momento.
    elegido = next((f for f in mp4 if int(f.get("size", 0) or 0) > 2_000_000), mp4[-1])
    licencia = md.get("metadata", {}).get("licenseurl", "")
    return {"url": f"https://archive.org/download/{ident}/{urllib.parse.quote(elegido['name'])}",
            "pagina": f"https://archive.org/details/{ident}",
            "licencia": "dominio público" if "publicdomain" in licencia else licencia or "ver su ficha en archive.org",
            "revisar": "" if "publicdomain" in licencia or "creativecommons" in licencia else "comprobar la licencia en su ficha"}


def de_mixkit(id_: str) -> dict:
    """
    Un clip de Mixkit: el mp4 que su página enlaza (cada clip guarda los suyos en otra ruta, y no todos tienen 1080:
    adivinarla daba 403 en uno de cada tres). `x-<id>` lleva a su página sin saber su título.
    """
    pagina = f"https://mixkit.co/free-stock-video/x-{id_}/"
    # Lo que `buscar.py` ya vio de ese clip (su mp4 chico, en revision/busca.json): así no se abre otra vez su página,
    # que con veinte clips a la vez contestaba 429.
    urls, texto = [], ""
    try:
        visto = json.loads(Path("revision/busca.json").read_text(encoding="utf-8")).get("mixkit", {}).get(str(id_))
        urls = [visto] if visto else []
    except (OSError, ValueError, AttributeError):
        pass
    if not urls:
        try:
            texto = pedir(pagina, espera=15)[0].decode("utf-8", "ignore")
        except Falla:
            texto = ""
        urls = sorted(set(re.findall(rf"https://assets\.mixkit\.co/[^\"' ]*?{id_}[^\"' ]*?\.mp4", texto)))
    if urls:
        # Del que haya, el más grande que exista a su lado: en vertical se recorta al centro y el de 360 no da.
        base = re.sub(r"-(1080|720|360)\.mp4$", "", urls[0])
        for calidad in ("1080", "720", "360"):
            url = f"{base}-{calidad}.mp4"
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={**AGENTE, "Range": "bytes=0-0"}), timeout=8):
                    return {"url": url, "pagina": pagina, "licencia": "Mixkit Free License", "revisar": ""}
            except Exception:  # noqa: BLE001 — ese tamaño no lo tiene
                continue
    raise Falla(f"el clip {id_} de Mixkit no se puede bajar" + (" (su página no enlaza su video)" if texto else "") + ": elige otro de busca.jpg")


def de_pagina(url: str) -> dict:
    """La foto que una página da para compartirse (og:image)."""
    datos, tipo = pedir(url)
    dominio = urllib.parse.urlparse(url).netloc.removeprefix("www.")
    if "html" not in tipo:
        return {"url": url, "datos": datos, "pagina": url, "licencia": f"de {dominio}", "revisar": f"foto de {dominio}: confirma que puedes usarla"}
    pagina = datos.decode("utf-8", errors="replace")
    m = re.search(r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)(?::src)?["\'][^>]*content=["\']([^"\']+)', pagina, re.I) or re.search(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\'](?:og:image|twitter:image)', pagina, re.I)
    if not m:
        raise Falla("la página no trae foto para compartir (og:image): da la URL de la imagen, o captúrala con `pagina`")
    return {"url": urllib.parse.urljoin(url, html.unescape(m.group(1))), "pagina": url, "licencia": f"de {dominio}",
            "revisar": f"foto de {dominio}: confirma que puedes usarla"}


def resolver(tipo: str, ref: str) -> dict:
    """De dónde se baja una foto o un clip, con su licencia."""
    video = tipo == "clip"
    if ref.startswith("commons:"):
        return de_commons(ref[8:])
    if ref.startswith("nasa:"):
        return de_nasa(ref[5:], video)
    if ref.startswith("archive:"):
        return de_archive(ref[8:])
    if ref.startswith("mixkit:"):
        return de_mixkit(ref[7:])
    if ref.startswith("yt:"):
        return {"url": ref, "pagina": f"https://www.youtube.com/watch?v={ref[3:]}", "licencia": "de su canal de YouTube",
                "revisar": "clip de YouTube: sus derechos son del canal (uso como comentario o cita)"}
    if not ref.startswith("http"):
        raise Falla(f"«{ref}» no es una referencia: una URL o `commons:`, `nasa:`, `archive:`, `mixkit:`" + (", `yt:`" if video else ""))
    if video:
        dominio = urllib.parse.urlparse(ref).netloc.removeprefix("www.")
        return {"url": ref, "pagina": ref, "licencia": f"de {dominio}", "revisar": f"clip de {dominio}: confirma que puedes usarlo"}
    return de_pagina(ref)


# ------------------------------------------------------------------ el material de una escena, ya en disco
REFERENCIAS = ("mixkit:", "archive:", "commons:", "nasa:", "http", "yt:")
VIDEO_EXT = re.compile(r"\.(mp4|webm|mov|m4v|ogv)(\?|$)", re.I)


def es_local(ref: str) -> bool:
    """Una ruta del proyecto (no una referencia de banco ni una URL)."""
    return not ref.startswith(REFERENCIAS)


def traer_items(proyecto: Path, items: list[dict], k: int, destino: Path, registro: dict) -> list[Path]:
    """
    Los `material` de una escena (`{"foto": …}`/`{"clip": …}`) ya en disco, en el mismo orden: una ruta del
    proyecto se usa tal cual; una referencia se baja con `resolver`/`bajar_a`/`pedir` (una vez por URL) y deja
    su licencia en `registro` para `fuentes_md`. `k` numera la escena para nombrar los archivos.
    Lanza `Falla` con el contexto de qué cosa falló.
    """
    archivos = []
    for j, item in enumerate(items):
        tipo = "foto" if "foto" in item else "clip"
        ref = str(item[tipo]).strip()
        ident = f"e{k + 1}-{j + 1}"
        if es_local(ref):
            archivos.append(proyecto / ref)
            continue
        try:
            origen = resolver(tipo, ref)
            if tipo == "clip":
                url = origen["url"]
                if url.startswith("yt:"):
                    raise Falla("YouTube no entra por aquí: usa los bancos o una URL directa")
                salida = destino / f"{ident}{Path(url.split('?')[0]).suffix or '.mp4'}"
                bajar_a(url, salida)
            else:
                datos = origen.pop("datos", None) or pedir(origen["url"])[0]
                url = origen["url"]
                ext = Path(url.split("?")[0]).suffix or ".jpg"
                salida = destino / f"{ident}{ext if ext.lower() in ('.jpg', '.jpeg', '.png', '.webp') else '.jpg'}"
                salida.write_bytes(datos)
        except Falla as e:
            raise Falla(f"escena {k + 1} material {j + 1} ({ref}): {e}") from None
        registro[ident] = {"tipo": tipo, "ref": ref,
                           **{x: origen.get(x) for x in ("pagina", "licencia", "revisar")}}
        archivos.append(salida)
    return archivos


def fuentes_md(proyecto: Path, registro: dict) -> None:
    """FUENTES.md: la tabla de licencias de lo que se bajó de los bancos (las rutas del usuario no se anotan)."""
    bajados = {k: v for k, v in registro.items() if v.get("licencia")}
    if not bajados:
        return
    lineas = ["# Fuentes", "", "| Material | Fuente | Licencia | Revisar derechos |", "|---|---|---|---|"]
    for k, v in bajados.items():
        lineas.append(f"| `{k}` ({v['tipo']}) | {v.get('pagina') or v['ref']} | {v.get('licencia', '')} | "
                      f"{v.get('revisar') or '—'} |")
    (proyecto / "FUENTES.md").write_text("\n".join(lineas) + "\n", encoding="utf-8")


def revisar_item(proyecto: Path, que: str, item: dict, errores: list[str]) -> None:
    """
    La forma de un `{"foto": …}` o `{"clip": …}` de una escena de `top.json`/`escenas.json`; lo que no se puede
    saber sin red queda para la corrida. `que` nombra el item («escena 2 material 1») para el mensaje de error.
    """
    tipos = [t for t in ("foto", "clip") if t in item]
    if len(tipos) != 1:
        errores.append(f"{que}: lleva una sola de `foto` o `clip`")
        return
    sobran = set(item) - {"foto", "clip", "desde", "velocidad"}
    if sobran:
        errores.append(f"{que}: clave(s) que no van: {', '.join(sorted(sobran))} "
                       "(solo `foto`/`clip`, `desde` y `velocidad` en un clip)")
    tipo, ref = tipos[0], str(item[tipos[0]] or "").strip()
    if tipo == "foto" and "velocidad" in item:
        errores.append(f"{que}: `velocidad` solo va en un `clip` (la foto ya tiene su paneo)")
    if "velocidad" in item:
        try:
            if not 0 < float(item["velocidad"]) <= 2:
                raise ValueError
        except (TypeError, ValueError):
            errores.append(f"{que}: `velocidad` es un número de 0 a 2 (0.6 = cámara lenta)")
    if not ref:
        errores.append(f"{que}: `{tipo}` vacío")
        return
    if es_local(ref):
        if not (proyecto / ref).is_file():
            errores.append(f"{que}: no está el archivo {ref} (relativo a la raíz del proyecto)")
        return
    if ref.startswith("yt:"):
        errores.append(f"{que}: «{ref}» es de YouTube: usa los bancos (mixkit:, archive:, commons:, nasa:) "
                       "o una URL directa, con su licencia en FUENTES.md")
    elif tipo == "clip" and ref.lower().startswith("commons:") and not VIDEO_EXT.search(ref):
        errores.append(f"{que}: «{ref}» es una imagen de Commons: un `clip` pide un video (…webm/.mp4)")
    elif tipo == "clip" and ref.startswith("http") and not VIDEO_EXT.search(ref):
        errores.append(f"{que}: «{ref}» no parece un video (.mp4/.webm): da la URL del archivo")
