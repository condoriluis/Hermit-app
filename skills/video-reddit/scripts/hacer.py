"""
El video de historia de Reddit, del proyecto a `out/reddit-<nombre>.mp4`, con el contrato del motor
(`../video-base/MOTOR.md`):

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal] [--nombre <n>]

Lo que el agente deja en el proyecto:
- `post.json` (o `fuentes/tema/post.md`): datos del post (subreddit, autor, tiempo, titulo, votos, comentarios).
- `guion.md`: relato completo narrado.
- `material.json` con `{"fondo": "<referencia>"}` o `public/fondo.mp4`.
- `fuentes/voz/*.wav` (o `public/voz.wav` / `voz.wav`).
- `public/musica.mp3` (opcional).

`--revisa` valida todo en un segundo y sin red ni voz.
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
SKILL = Path(__file__).resolve().parent.parent
BASE = SKILL.parent / "video-base" / "scripts"
sys.path.insert(0, str(BASE))
sys.path.insert(0, str(SKILL / "components"))
sys.path.insert(0, str(SKILL / "scripts"))

from bancos import Falla, bajar_a, resolver  # noqa: E402
from hermit import duracion, transcribir  # noqa: E402
from momentos import Reloj, hoja, roto  # noqa: E402
from subtitulos import ESTILOS as ESTILOS_SUB, grupos_de_lineas, palabras_tiempo  # noqa: E402
from pistas import a_public, duracion_wav, ganancia_musica  # noqa: E402
from comp import FPS  # noqa: E402
import director  # noqa: E402

_args = sys.argv[1:]
_en = _args[_args.index("--en") + 1] if "--en" in _args[:-1] else ""
formato_arg = _args[_args.index("--formato") + 1] if "--formato" in _args[:-1] else None
nombre_arg = _args[_args.index("--nombre") + 1] if "--nombre" in _args[:-1] else None
PROYECTO = Path(_en).resolve() if _en else Path.cwd()

if PROYECTO == SKILL.parent or SKILL.parent in PROYECTO.parents:
    sys.exit(f"{PROYECTO} es la carpeta de las skills: pasa la ruta completa de la línea `Carpeta:`.")

FORMATOS = {"vertical": (1080, 1920), "horizontal": (1920, 1080)}
REFERENCIAS = ("mixkit:", "archive:", "commons:", "nasa:", "yt:")
REF_VIDEO = re.compile(r"^https?://\S+\.(mp4|webm|mov|m4v)(\?|$)", re.I)
SFX = SKILL / "sfx"
T_TARJETA = 3.0  # segundos que dura la tarjeta de Reddit; los cues de sonido y la tarjeta lo comparten


def primer(*partes: str) -> Path | None:
    return next((PROYECTO / p for p in partes if (PROYECTO / p).exists()), None)


def leer_post() -> tuple[dict, list[str]]:
    errores = []
    post_file = primer("post.json", "fuentes/tema/post.json")
    if post_file:
        try:
            datos = json.loads(post_file.read_text(encoding="utf-8-sig"))
        except Exception as e:
            return {}, [f"post.json no es un JSON válido ({e})"]
    else:
        post_md = primer("fuentes/tema/post.md", "post.md")
        if post_md:
            txt = post_md.read_text(encoding="utf-8", errors="replace")
            lineas = [ln.strip() for ln in txt.splitlines() if ln.strip()]
            titulo = lineas[0].lstrip("# ").strip() if lineas else "Historia de Reddit"
            datos = {
                "subreddit": "r/AskReddit",
                "autor": "u/RedditUser",
                "tiempo": "hace 4 h",
                "titulo": titulo,
                "votos": "14.2k",
                "comentarios": "1.8k"
            }
        else:
            errores.append("falta post.json (o fuentes/tema/post.md)")
            return {}, errores

    if not datos.get("titulo"):
        errores.append("post.json debe incluir al menos `titulo`")
    return datos, errores


def leer_material() -> tuple[dict, list[str]]:
    archivo = PROYECTO / "material.json"
    if not archivo.exists():
        if primer("public/fondo.mp4", "fondo.mp4"):
            return {"fondo": "public/fondo.mp4"}, []
        return {}, ["falta material.json con {\"fondo\": \"<referencia>\"} o public/fondo.mp4"]
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except Exception as e:
        return {}, [f"material.json no es un JSON válido ({e})"]
    fondo = datos.get("fondo")
    if not fondo:
        return {}, ["material.json lleva clave `fondo`"]
    if not (str(fondo).startswith(REFERENCIAS) or REF_VIDEO.match(str(fondo)) or primer(str(fondo))):
        return {}, [f"«{fondo}» no es una referencia de video válida (mixkit:, archive:, commons:, nasa:, yt: o URL)"]
    return datos, []


def traer_fondo(material: dict, reloj: Reloj) -> Path:
    ref = str(material.get("fondo") or "")
    local = primer(ref, "public/fondo.mp4", "fondo.mp4")
    destino = PROYECTO / "public" / "fondo.mp4"
    if local and local.exists() and local != destino:
        destino.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(local, destino)
        except OSError:
            shutil.copy2(local, destino)
        return destino
    if destino.exists() and not ref.startswith(REFERENCIAS):
        return destino

    reloj.paso(f"fondo: {ref}")
    try:
        origen = resolver("clip", ref)
    except Falla as e:
        sys.exit(f"✗ fondo: {e}")

    sello = PROYECTO / "work" / "fondo.json"
    try:
        previo = json.loads(sello.read_text(encoding="utf-8"))
    except Exception:
        previo = {}

    if previo.get("url") == origen["url"] and destino.exists():
        print("  el fondo ya está bajado: no se repite")
    else:
        destino.parent.mkdir(parents=True, exist_ok=True)
        try:
            bajar_a(origen["url"], destino)
        except Falla as e:
            sys.exit(f"✗ fondo: {e}")
        sello.parent.mkdir(parents=True, exist_ok=True)
        sello.write_text(json.dumps({"ref": ref, "url": origen["url"]}, ensure_ascii=False), encoding="utf-8")

    fuentes = ["# Fuentes", "", "| Archivo | Fuente | Licencia | Revisar derechos |", "|---|---|---|---|"]
    fuentes.append(f"| `public/fondo.mp4` | {origen.get('pagina', ref)} | {origen.get('licencia', '')} | {origen.get('revisar') or '—'} |")
    (PROYECTO / "FUENTES.md").write_text("\n".join(fuentes) + "\n", encoding="utf-8")
    return destino


def cues(duracion_total: float, t_tarjeta: float = T_TARJETA) -> list[tuple[float, str, float]]:
    """Los efectos del formato, en (segundo, nombre en sfx/, volumen): pop al aparecer la tarjeta,
    upvote a mitad de su lectura, whoosh al salir y outro hacia el final. Los usan la mezcla ffmpeg
    de `audio()` y las pistas del monitor de `pistas()` — los mismos tiempos en los dos."""
    cues: list[tuple[float, str, float]] = []
    # Cues amarrados a la tarjeta: pop al aparecer, upvote a mitad de la lectura, whoosh al salir.
    cues.append((0.05, "pop", 0.35))
    cues.append((t_tarjeta * 0.45, "upvote", 0.40))
    cues.append((t_tarjeta - 0.4, "whoosh", 0.30))
    # Outro final si dura más de 5s
    if duracion_total > 5.0:
        cues.append((max(0.0, duracion_total - 0.6), "outro", 0.35))
    return cues


def pistas(voz: Path, duracion_total: float, t_tarjeta: float = T_TARJETA) -> dict | None:
    """El bloque `sonido` de edicion.json: las pistas del monitor en vivo y de la línea de tiempo —
    la voz, la música en loop a su volumen con el mismo ducking de la mezcla y cada efecto en su
    golpe, cada fuente en `public/sonido/` por `pistas.py` de video-base. El video final no las usa:
    su audio es la mezcla ffmpeg de `audio()`, que es la que se masteriza."""
    total_f = round(duracion_total * FPS)
    dur = duracion_total
    out: dict = {}
    rel = a_public(voz, "voz", PROYECTO)
    n = round(duracion_wav(PROYECTO / "public" / rel) * FPS)
    out["voz"] = {"src": rel, "desde": 0, "hasta": min(total_f, n), "volumen": 1.0}
    voz_abs = PROYECTO / "public" / rel
    musica = primer("public/musica.mp3", "musica.mp3", "public/musica.wav")
    if musica:
        rel_m = a_public(musica, "musica", PROYECTO)
        out["musica"] = {"src": rel_m, "desde": 0, "hasta": total_f, "volumen": 0.10,
                         "ganancia": ganancia_musica(voz_abs, 0.0, dur,
                                                     fundido_in=1.0, fundido_out=1.5)}
    sfx = []
    for t, s, g in cues(duracion_total, t_tarjeta):
        src = SFX / f"{s}.wav"
        if not src.exists():
            continue
        rel_s = a_public(src, s, PROYECTO)
        n_s = round(duracion_wav(PROYECTO / "public" / rel_s) * FPS)
        desde = max(0, round(t * FPS))
        sfx.append({"src": rel_s, "desde": desde, "hasta": min(total_f, desde + max(1, n_s)), "volumen": g})
    if sfx:
        out["sfx"] = sfx
    return out


def audio(voz: Path, duracion_total: float, revision: Path, t_tarjeta: float = T_TARJETA) -> Path:
    audio_master = revision / "audio_master.wav"
    cues_lista = cues(duracion_total, t_tarjeta)

    musica = primer("public/musica.mp3", "musica.mp3", "public/musica.wav")
    if not cues_lista and not musica:
        subprocess.run(["node", str(BASE / "masterizar.mjs"), str(voz), str(audio_master)], check=True)
        return audio_master

    sonidos: list[str] = []

    def indice(sonido: str) -> int:
        p = SFX / f"{sonido}.wav"
        ruta = str(p) if p.exists() else str(sonido)
        if ruta not in sonidos:
            sonidos.append(ruta)
        return sonidos.index(ruta) + 1

    por_sonido: dict[int, list[tuple[float, float]]] = {}
    for t, son, gan in cues_lista:
        por_sonido.setdefault(indice(son), []).append((t, gan))

    entradas = ["-i", str(voz)]
    for ruta in sonidos:
        entradas.extend(["-i", ruta])

    mus_idx = None
    if musica:
        mus_idx = len(sonidos) + 1
        entradas.extend(["-stream_loop", "-1", "-i", str(musica)])

    # La voz alimenta la mezcla y, en paralelo, la clave del compresor lateral de la música.
    partes = []
    voz_mix = "vozm" if musica else "voz"
    if musica:
        partes.append("[0:a]aformat=channel_layouts=stereo,aresample=48000,asplit=2[vozm][vozk]")
    else:
        partes.append("[0:a]aformat=channel_layouts=stereo,aresample=48000[voz]")
    delays = []
    for i, suyos in por_sonido.items():
        n = len(suyos)
        partes.append(f"[{i}:a]asplit={n}" + "".join(f"[s{i}_{k}]" for k in range(n)))
        for k, (t, ganancia) in enumerate(suyos):
            ms = int(round(t * 1000))
            partes.append(f"[s{i}_{k}]adelay={ms}|{ms},volume={ganancia}[h{i}_{k}]")
            delays.append(f"[h{i}_{k}]")

    if mus_idx is not None:
        # Música en bucle, baja y con ducking real: el compresor lateral la hunde bajo la voz
        # y la devuelve en las pausas; fundidos de entrada y salida para que no corte en seco.
        salida = max(0.0, duracion_total - 1.5)
        partes.append(
            f"[{mus_idx}:a]aformat=channel_layouts=stereo,aresample=48000,volume=0.10,"
            f"afade=t=in:st=0:d=1.0,afade=t=out:st={salida:.3f}:d=1.5[mus]"
        )
        partes.append(
            "[mus][vozk]sidechaincompress=threshold=0.005:ratio=12:attack=0.01:release=0.8:makeup=1[musduck]"
        )
        delays.append("[musduck]")

    filtro = ";".join(partes) + f";[{voz_mix}]" + "".join(delays) + f"amix=inputs={len(delays) + 1}:duration=first:normalize=0[a]"
    mezcla = revision / "mezcla.wav"
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *entradas, "-filter_complex", filtro, "-map", "[a]", str(mezcla)], check=True)
    subprocess.run(["node", str(BASE / "masterizar.mjs"), str(mezcla), str(audio_master)], check=True)
    return audio_master


def main() -> None:
    revisa = "--revisa" in _args
    formato = formato_arg or "vertical"
    if formato not in FORMATOS:
        sys.exit('formato debe ser "vertical" u "horizontal".')

    errores = []
    post, err_post = leer_post()
    errores.extend(err_post)
    material, err_mat = leer_material()
    errores.extend(err_mat)

    if not primer("guion.md"):
        errores.append("falta guion.md")
    else:
        if malo := roto((PROYECTO / "guion.md").read_text(encoding="utf-8", errors="replace")):
            errores.append(f"guion.md tiene codificación rota («{malo}»)")

    # Búsqueda de voz
    carpeta_voz = PROYECTO / "fuentes" / "voz"
    voz = None
    if carpeta_voz.is_dir():
        candidatos = [p for p in carpeta_voz.glob("*.wav") if p.is_file()]
        if candidatos:
            voz = max(candidatos, key=lambda p: p.stat().st_mtime)
    if not voz:
        voz = primer("public/voz.wav", "voz.wav")
    if not voz:
        errores.append("falta la voz en fuentes/voz/*.wav o public/voz.wav")

    if errores:
        for e in errores:
            print(f"✗ {e}")
        sys.exit(1)

    if revisa:
        print("✓ revisión: el proyecto de Reddit está completo y listo")
        return

    ancho, alto = FORMATOS[formato]
    reloj = Reloj(PROYECTO)
    revision = PROYECTO / "revision"
    revision.mkdir(exist_ok=True)
    out_dir = PROYECTO / "out"
    out_dir.mkdir(exist_ok=True)

    # 1. Fondo
    fondo_archivo = traer_fondo(material, reloj)
    fondo_dur = duracion(fondo_archivo)

    # 2. Voz
    reloj.paso("voz…")
    total = duracion(voz)
    reloj.nota("voz", f"{total:.1f} s")

    # 3. Transcripción
    reloj.paso("transcripción…")
    cache = revision / "transcripcion.json"
    if cache.exists() and cache.stat().st_mtime >= voz.stat().st_mtime:
        segmentos = json.loads(cache.read_text(encoding="utf-8"))
    else:
        segmentos = transcribir(voz).get("segmentos", [])
        cache.write_text(json.dumps(segmentos, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")

    # 4. Audio profesional con cues y masterización
    reloj.paso("audio…")
    audio_master = audio(voz, total, revision, t_tarjeta=T_TARJETA)
    sonido = PROYECTO / "public" / "sonido.wav"
    if sonido.exists():
        sonido.unlink()
    try:
        os.link(audio_master, sonido)
    except OSError:
        shutil.copy2(audio_master, sonido)

    # La piel del estilo: el proyecto lleva su copia de assets/ en public/assets/reddit/ (la puso nuevo.py);
    # se refresca desde la skill por si mejoró después — si no, la edición sale con piezas viejas, sin las
    # nuevas o con fuentes que ya no están (@font-face caería al fallback).
    for nombre in ("tokens.css",):
        src, dst = SKILL / "assets" / nombre, PROYECTO / "public" / "assets" / "reddit" / nombre
        if src.exists() and (not dst.exists() or dst.read_bytes() != src.read_bytes()):
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    fuentes_src = SKILL / "assets" / "fonts"
    fuentes_dst = PROYECTO / "public" / "assets" / "reddit" / "fonts"
    if fuentes_src.is_dir():
        fuentes_dst.mkdir(parents=True, exist_ok=True)
        for f in fuentes_src.iterdir():
            if f.is_file() and (not (fuentes_dst / f.name).exists()
                                or (fuentes_dst / f.name).read_bytes() != f.read_bytes()):
                shutil.copy2(f, fuentes_dst / f.name)

    # 5. Edición y subtítulos
    reloj.paso("edición…")
    # Las líneas se agrupan midiendo con el tamaño MÁS GRANDE que el karaoke llega a renderizar
    # (el centro va al 108% del normal): si se midiera al tamaño chico, las líneas del centro se
    # saldrían del cuadro y cortarían palabras en los bordes.
    estilo_sub = dict(ESTILOS_SUB["varela"])
    letra_centro = min(ancho, alto) * 0.072 * 1.08
    if alto > ancho:
        estilo_sub["tam_v"] = letra_centro / ancho
    else:
        estilo_sub["tam_h"] = letra_centro / ancho
    # Las palabras van en mayúsculas ANTES de agrupar: el karaoke las pinta en mayúsculas y la
    # mayúscula es ~25 % más ancha — medir el texto original haría desbordar las líneas.
    subs = grupos_de_lineas(
        [(ini, fin, texto.upper()) for ini, fin, texto in palabras_tiempo(segmentos, 0.0)],
        estilo_sub, ancho, alto,
    )
    director.armar(
        post=post,
        fondo_src="fondo.mp4",
        fondo_dur=fondo_dur,
        proyecto=PROYECTO,
        ancho=ancho,
        alto=alto,
        total=total,
        audio="sonido.wav",
        subs=subs,
        t_tarjeta=T_TARJETA,
        sonido=pistas(voz, total, t_tarjeta=T_TARJETA),
    )

    # 6. Render Remotion
    reloj.paso("render…")
    nombre = nombre_arg or re.sub(r"^reddit-", "", PROYECTO.name)
    sin_sonido = out_dir / f"_reddit-{nombre}-video.mp4"
    final = out_dir / f"reddit-{nombre}.mp4"

    subprocess.run([
        "node", str(BASE / "render.cjs"), str(sin_sonido), "--id=Reddit", "--muted",
        "--concurrency=66%", "--crf=18", "--x264-preset=veryfast",
        "--pixel-format=yuv420p", "--color-space=bt709",
        f"--antes={SKILL / 'scripts' / 'cuadros_render.cjs'}",
        '--props={"cuadros":true}',
    ], cwd=PROYECTO, check=True)

    subprocess.run([
        "ffmpeg", "-nostdin", "-y", "-v", "error",
        "-i", str(sin_sonido), "-i", str(sonido),
        "-map", "0:v", "-map", "1:a",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", str(final),
    ], check=True)
    sin_sonido.unlink(missing_ok=True)

    # 7. Portada de primer fotograma en vertical
    portada_img = primer("portada.png", "public/portada.png", "portada/portada.png")
    if alto > ancho and portada_img:
        subprocess.run(["node", str(BASE / "portada.mjs"), str(final), str(portada_img)], check=False)

    # 8. Hoja de cuadros de revisión
    reloj.paso("hoja…")
    hoja_png = hoja(final, revision / "hoja.png")

    # 9. Limpieza estricta de proyecto entregado
    carpeta_voz.mkdir(parents=True, exist_ok=True)
    if carpeta_voz in voz.parents:
        for viejo in (PROYECTO / "public" / "voz.wav", PROYECTO / "voz.wav"):
            viejo.unlink(missing_ok=True)
    else:
        destino_voz = carpeta_voz / "voz.wav"
        if not destino_voz.exists() or destino_voz.stat().st_mtime < voz.stat().st_mtime:
            shutil.move(str(voz), str(destino_voz))
        else:
            voz.unlink(missing_ok=True)

    for patron in ("mezcla.wav", "audio_master.wav"):
        for f in revision.glob(patron):
            f.unlink(missing_ok=True)
    for f in PROYECTO.rglob("*.huella"):
        if "node_modules" not in f.parts:
            f.unlink(missing_ok=True)
    if (PROYECTO / "portada.png").exists():
        (PROYECTO / "portada.jpg").unlink(missing_ok=True)

    reloj.listo(final, [hoja_png])


if __name__ == "__main__":
    main()
