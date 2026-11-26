"""
El video de misterio y crimen, del proyecto a `out/crimen-<nombre>.mp4`, con el contrato del motor
(`../video-base/MOTOR.md`):

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal] [--nombre <n>]

`--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit; sin ella, el directorio actual.

Lo que el agente deja en el proyecto:
- `fuentes/caso.md`: la cronología comprobada del caso (nombres, fechas y lugares con su fuente).
- `guion.md`: la narración (las líneas en negrita son textos en pantalla, no narración).
- `fuentes/voz/*.wav` (VOZ.md de video-base: ahí la deja `generar_voz`; `public/voz.wav` o `voz.wav` valen como
  rutas viejas), ya masterizada a -14 LUFS, y `public/musica.mp3`
  (o `musica.mp3`, `public/musica.wav`) opcional: el ambiente de tensión a bajo volumen debajo de la voz.
- `escenas.json`: el montaje declarativo — cada escena con la `palabra` del guion donde entra, su `look`
  (el tratamiento de color del estilo: `frio` —el de expediente, el de omisión—, `sepia` o `color`) y su
  `material`, una lista de 1 a 4 cosas que se reparten su tramo en partes iguales:
      {"foto": "<ruta o referencia>"}                        Ken Burns: paneo lento con zoom
      {"clip": "<ruta o referencia>", "desde": 1.5}           video con paneo lento; `desde` es el segundo de entrada
      {"clip": "<ruta o referencia>", "velocidad": 0.6}       `velocidad` estira o apura el clip (0.6 = cámara lenta)
  Sobre todo material van el grano de película y la viñeta del expediente (la firma del estilo). Una escena
  **sin `material`** es una tarjeta sobre fondo negro con el texto del expediente centrado en ámbar (`titular`,
  `\\n` parte renglones): fechas, sellos o una frase que debe leerse sola — solo lleva `titular`. Las
  referencias son las de ../video-base/MATERIAL.md (`mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de
  video); una ruta es un archivo del proyecto — los documentos y recortes de `fuentes/evidencia/` entran así.
  Se bajan una vez y su licencia queda en `FUENTES.md`.
- `portada.png` (opcional en vertical: la pone de primer fotograma).

`--revisa` valida todo en un segundo y sin red ni voz: la forma de `escenas.json`, que cada `palabra` exista
en el guion y vaya en orden, y que cada `foto`/`clip` local exista o sea una referencia bien formada. El resto
— voz, material, la edición de Remotion (el director pone las fotos con paneo, los clips con su velocidad, los
looks de color, el grano y la viñeta del expediente, las tarjetas ámbar y el karaoke Courier Prime con la
palabra activa en ámbar —capas dentro de la composición—), el dron de apertura, la máquina de escribir de las
tarjetas y el whoosh de los cortes, portada y hoja— se cronometra en `revision/tiempos.json`.
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
from bancos import Falla, fuentes_md, revisar_item, traer_items  # noqa: E402
from hermit import duracion, transcribir  # noqa: E402
from momentos import Reloj, anclar, errores_mojibake, hoja, palabras_de, roto, texto_guion, tiempos_de_escenas  # noqa: E402
from subtitulos import ESTILOS as ESTILOS_SUB, grupos_de_lineas, palabras_tiempo  # noqa: E402
from pistas import a_public, duracion_wav, ganancia_musica  # noqa: E402
from comp import FPS  # noqa: E402
import director  # noqa: E402

# `--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit: el proyecto no depende del directorio donde se
# corra; sin ella, el directorio actual.
_args = sys.argv[1:]
_en = _args[_args.index("--en") + 1] if "--en" in _args[:-1] else ""
formato_arg = _args[_args.index("--formato") + 1] if "--formato" in _args[:-1] else None
nombre_arg = _args[_args.index("--nombre") + 1] if "--nombre" in _args[:-1] else None
if ("--formato" in _args and formato_arg is None) or ("--nombre" in _args and nombre_arg is None):
    sys.exit(__doc__)
PROYECTO = Path(_en).resolve() if _en else Path.cwd()
# La carpeta de las skills no es un proyecto: el video no lo vería nadie.
if PROYECTO == SKILL.parent or SKILL.parent in PROYECTO.parents:
    sys.exit(f"{PROYECTO} es la carpeta de las skills: pasa la ruta completa de la línea `Carpeta:`.")
FORMATOS = {"vertical": (1080, 1920), "horizontal": (1920, 1080)}

# El tratamiento de color de cada `look`, como filtro CSS del medio en la edición (director.LOOKS lleva el mismo
# mapa): `frio` el del expediente —colores apagados y fríos, el de omisión—, `sepia` el archivo vintage y
# `color` la imagen tal cual. El grano y la viñeta van siempre sobre el material.
LOOKS = ("frio", "sepia", "color")


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args], check=True)


def leer_escenas() -> tuple[dict, list[str]]:
    """escenas.json de la raíz; devuelve (datos, errores de forma)."""
    archivo = PROYECTO / "escenas.json"
    if not archivo.exists():
        return {}, ["falta escenas.json en la raíz del proyecto"]
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        return {}, [f"escenas.json no es JSON: {e}"]
    if not isinstance(datos, dict):
        return {}, ["escenas.json no es un objeto: lleva `formato` y `escenas`"]
    errores = errores_mojibake(datos)
    formato = datos.get("formato", "vertical")
    if formato not in FORMATOS:
        errores.append(f'formato «{formato}»: va "vertical" u "horizontal"')
    escenas = datos.get("escenas")
    if not isinstance(escenas, list) or not escenas:
        errores.append("no tiene escenas: una lista `escenas`, cada una con `palabra` y `material` o `titular`")
        escenas = []
    for k, e in enumerate(escenas):
        que = f"escena {k + 1}"
        if not isinstance(e, dict):
            errores.append(f"{que}: no es un objeto")
            continue
        if not str(e.get("palabra", "")).strip():
            errores.append(f"{que}: falta `palabra`, las palabras del guion donde entra")
        look = e.get("look")
        if look is not None and look not in LOOKS:
            errores.append(f"{que}: `look` «{look}» no existe: va {', '.join(LOOKS)}")
        titular = e.get("titular")
        if titular is not None and (not isinstance(titular, str) or len(titular) > 120):
            errores.append(f"{que}: `titular` es un texto de hasta 120 caracteres o se quita")
        material = e.get("material")
        if material is None:
            if look is not None:
                errores.append(f"{que}: `look` no aplica en una tarjeta (va sobre fondo negro)")
            if not titular:
                errores.append(f"{que}: sin `material` solo vale una tarjeta: lleva `titular`")
            continue
        if titular is not None:
            errores.append(f"{que}: `titular` solo va en una escena sin `material` (la tarjeta)")
        if not isinstance(material, list) or not material:
            errores.append(f"{que}: `material` es una lista de 1 a 4 cosas (fotos o clips)")
            continue
        if len(material) > 4:
            errores.append(f"{que}: `material` pasa de 4 cosas: reparte el tramo en partes iguales")
        for j, item in enumerate(material):
            if not isinstance(item, dict):
                errores.append(f"{que} material {j + 1}: no es un objeto")
                continue
            revisar_item(PROYECTO, f"{que} material {j + 1}", item, errores, extra={"pie"})
            pie = item.get("pie")
            if pie is not None and (not isinstance(pie, str) or len(pie) > 80):
                errores.append(f"{que} material {j + 1}: `pie` es un texto de hasta 80 caracteres (la leyenda de la foto)")
            if pie is not None and "clip" in item:
                errores.append(f"{que} material {j + 1}: `pie` es la leyenda de una `foto`, no de un `clip`")
            if "clip" in item and item.get("desde") is not None:
                try:
                    if float(item["desde"]) < 0:
                        raise ValueError
                except (TypeError, ValueError):
                    errores.append(f"{que} material {j + 1}: `desde` es un número de segundos ≥ 0")
    return datos, errores


SFX = SKILL / "sfx"


def cues_de(escenas: list[dict]) -> list[tuple[float, object, float]]:
    """Los efectos del expediente, en (segundo, sonido, ganancia), sobrios como el formato: `subtone_1`
    + `riser_1` al abrir, `clicktrain_N` en cada tarjeta (rotando las cuatro muestras), `tick_1` en cada
    escena de material, `swish_1` en cada entrada y cambio, `impact_1` en el cierre. Los usan la mezcla
    ffmpeg de `audio()` y las pistas del monitor de `pistas()`: los mismos tiempos en los dos."""
    cues: list[tuple[float, object, float]] = [(0.0, "subtone_1", 0.10), (0.0, "riser_1", 0.05)]
    n_ta = 0
    for k, e in enumerate(escenas):
        t0, t1 = e["t0"], e["t1"]
        mat = e.get("material") or []
        es_cita = not mat
        if es_cita:
            n_ta += 1
            cues.append((t0, f"clicktrain_{(n_ta - 1) % 4 + 1}", 0.10))
        else:
            cues.append((t0, "swish_1", 0.08))
            cues.append((t0, "tick_1", 0.04))
        if mat:
            slot = (t1 - t0) / len(mat)
            for j in range(1, len(mat)):
                cues.append((t0 + j * slot, "swish_1", 0.05))
    if escenas:
        cues.append((escenas[-1]["t0"], "impact_1", 0.06))
    return cues


def pistas(voz: Path, escenas: list[dict], total: float) -> dict | None:
    """El bloque `sonido` de edicion.json: las pistas del monitor en vivo y de la línea de tiempo —
    la voz, la música en loop a su volumen con el mismo ducking de la mezcla y cada efecto en su
    golpe, cada fuente en `public/sonido/` por `pistas.py` de video-base. El video final no las usa:
    su audio es la mezcla ffmpeg de `audio()`, que es la que se masteriza."""
    total_f = round(total * FPS)
    out: dict = {}
    rel = a_public(voz, "voz", PROYECTO)
    n = round(duracion_wav(PROYECTO / "public" / rel) * FPS)
    out["voz"] = {"src": rel, "desde": 0, "hasta": min(total_f, n), "volumen": 1.0}
    voz_abs = PROYECTO / "public" / rel
    musica = next((PROYECTO / p for p in ["public/musica.mp3", "musica.mp3", "public/musica.wav"]
                   if (PROYECTO / p).exists()), None)
    if musica:
        rel_m = a_public(musica, "musica", PROYECTO)
        out["musica"] = {"src": rel_m, "desde": 0, "hasta": total_f, "volumen": 0.08,
                         "ganancia": ganancia_musica(voz_abs, 0.0, total,
                                                     fundido_in=2.5, fundido_out=3.0)}
    sfx = []
    for t, s, g in cues_de(escenas):
        src = Path(str(s)) if Path(str(s)).is_absolute() or Path(str(s)).exists() else SFX / f"{s}.wav"
        if not src.exists():
            continue
        rel_s = a_public(src, src.stem, PROYECTO)
        n_s = round(duracion_wav(PROYECTO / "public" / rel_s) * FPS)
        desde = max(0, round(t * FPS))
        sfx.append({"src": rel_s, "desde": desde, "hasta": min(total_f, desde + max(1, n_s)), "volumen": g})
    if sfx:
        out["sfx"] = sfx
    return out


def audio(voz: Path, escenas: list[dict], total: float, revision: Path) -> Path:
    """
    La voz con la cama de efectos del expediente y la música de tensión, masterizada a -14 LUFS
    (`public/musica.mp3`, `musica.mp3` o `public/musica.wav`, a bajo volumen con ducking bajo la voz y
    fundidos, como en los demás estilos). Los cues son (tiempo, sonido, ganancia), sobrios como el formato:

    - `subtone_1` + `riser_1` al abrir el video — el dron grave y la subida que pone la atmósfera.
    - `clicktrain_N` al entrar cada tarjeta de expediente — la máquina de escribir de las fechas y sellos,
      rotando las cuatro muestras para que no se note el bucle.
    - `tick_1` al entrar cada escena de material — el tictac bajo de la investigación.
    - `swish_1` al entrar cada escena y, más bajo, en cada cambio de material — el corte seco del expediente.
    - `impact_1` al entrar la última escena — el golpe seco del cierre, cuando caen las preguntas.
    """
    audio_master = revision / "audio_master.wav"
    cues = cues_de(escenas)

    musica = next((PROYECTO / p for p in ["public/musica.mp3", "musica.mp3", "public/musica.wav"]
                   if (PROYECTO / p).exists()), None)
    if not cues and not musica:
        # --pico -1.4: el WAV maestro pide margen para el AAC del mux, que remata el true peak ~0,5 dB en mezclas
        # densas (limitador al techo); con el techo normal (-1) el mp4 salía en -0,8 dBTP y reprobraba.
        subprocess.run(["node", str(BASE / "masterizar.mjs"), str(voz), str(audio_master),
                        "--pico", "-1.4"], check=True)
        return audio_master

    # Cada sonido único es una entrada; sus cues salen por adelay+volume.
    sonidos: list[str] = []

    def indice(sonido) -> int:
        # Devuelve el índice del input en ffmpeg: el 0 es la voz y los sonidos van del 1 en adelante.
        ruta = str(sonido) if Path(str(sonido)).is_absolute() or Path(str(sonido)).exists() else str(SFX / f"{sonido}.wav")
        if ruta not in sonidos:
            sonidos.append(ruta)
        return sonidos.index(ruta) + 1

    por_sonido: dict[int, list[tuple[float, float]]] = {}
    for t, sonido, ganancia in cues:
        por_sonido.setdefault(indice(sonido), []).append((t, ganancia))

    entradas = ["-i", str(voz)]
    idx = 1
    for ruta in sonidos:
        entradas += ["-i", ruta]
        idx += 1
    mus_idx = None
    if musica:
        mus_idx = idx
        entradas += ["-stream_loop", "-1", "-i", str(musica)]

    # La voz alimenta la mezcla y, en paralelo, la clave del compresor lateral de la música.
    partes = []
    voz_mix = "vozm" if musica else "voz"
    if musica:
        partes.append("[0:a]aformat=channel_layouts=stereo,aresample=48000,asplit=2[vozm][vozk]")
        # Música en bucle, baja y con ducking real: el compresor lateral la hunde bajo la voz y la
        # devuelve en las pausas; fundidos de entrada y salida como los del pipeline viejo.
        salida = max(0.0, total - 3.0)
        partes.append(
            f"[{mus_idx}:a]aformat=channel_layouts=stereo,aresample=48000,volume=0.08,"
            f"afade=t=in:st=0:d=2.5,afade=t=out:st={salida:.3f}:d=3[mus]"
        )
        partes.append(
            "[mus][vozk]sidechaincompress=threshold=0.005:ratio=12:attack=0.01:release=0.8:makeup=1[musduck]"
        )
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
    if musica:
        delays.append("[musduck]")

    filtro = ";".join(partes) + f";[{voz_mix}]" + "".join(delays) + \
        f"amix=inputs={len(delays) + 1}:duration=first:normalize=0[a]"
    mezcla = revision / "mezcla.wav"
    ffmpeg(*entradas, "-filter_complex", filtro, "-map", "[a]", str(mezcla))
    subprocess.run(["node", str(BASE / "masterizar.mjs"), str(mezcla), str(audio_master),
                    "--pico", "-1.4"], check=True)
    return audio_master


def main() -> None:
    formato = formato_arg or "vertical"
    if formato not in FORMATOS:
        sys.exit('--formato es "vertical" u "horizontal".')
    # Los valores de las opciones no son argumentos sueltos: un nombre de más es un error del que llama.
    sueltos = {v for v in (_en, formato_arg, nombre_arg) if v}
    if [a for a in _args if not a.startswith("--") and a not in sueltos]:
        sys.exit(__doc__)
    revisa = "--revisa" in _args

    for f in ("fuentes/caso.md", "guion.md", "escenas.json"):
        if not (PROYECTO / f).exists():
            sys.exit(f"✗ Falta {f} en la raíz del proyecto.")
    for f in ("fuentes/caso.md", "guion.md", "escenas.json"):
        if malo := roto((PROYECTO / f).read_text(encoding="utf-8")):
            sys.exit(f"✗ {f} tiene la codificación rota («{malo}»): UTF-8 leído como latin-1; reescríbelo en UTF-8.")

    datos, errores = leer_escenas()
    if datos.get("formato") and not formato_arg:
        formato = datos["formato"]
    if errores:
        sys.exit("✗ escenas.json:\n  " + "\n  ".join(errores))
    escenas = [e for e in (datos.get("escenas") or []) if isinstance(e, dict)]
    if malos := anclar(escenas, palabras_de(texto_guion(PROYECTO)), "el guion")[1]:
        sys.exit("✗ escenas.json:\n  " + "\n  ".join(malos))
    if revisa:
        print("✓ escenas.json bien: ya puedes lanzar hacer.py de fondo")
        return

    ancho, alto = FORMATOS[formato]
    reloj = Reloj(PROYECTO)
    revision = PROYECTO / "revision"
    revision.mkdir(exist_ok=True)
    out_dir = PROYECTO / "out"
    out_dir.mkdir(exist_ok=True)

    # 1. La voz
    reloj.paso("voz…")
    # La voz vive en fuentes/voz/ (VOZ.md: ahí la deja generar_voz), como en el top; public/voz.wav y
    # voz.wav son las rutas viejas que aún se aceptan. Si hay varias, la más reciente es la que se produjo última.
    carpeta_voz = PROYECTO / "fuentes" / "voz"
    voz = None
    if carpeta_voz.is_dir():
        candidatos = [p for p in carpeta_voz.glob("*.wav") if p.is_file()]
        if candidatos:
            voz = max(candidatos, key=lambda p: p.stat().st_mtime)
    if not voz:
        voz = next((PROYECTO / p for p in ["public/voz.wav", "voz.wav"] if (PROYECTO / p).exists()), None)
    if not voz:
        sys.exit("✗ Falta la voz en fuentes/voz/ (VOZ.md de video-base) o en public/voz.wav.")
    total = duracion(voz)
    reloj.nota("voz", f"{total:.1f} s")

    # 2. La transcripción, solo si la voz cambió desde la última vez
    reloj.paso("transcripción…")
    cache = revision / "transcripcion.json"
    if cache.exists() and cache.stat().st_mtime >= voz.stat().st_mtime:
        segmentos = json.loads(cache.read_text(encoding="utf-8"))
        reloj.nota("transcripcion", "la de antes, la voz no cambió")
    else:
        segmentos = transcribir(voz).get("segmentos", [])
        cache.write_text(json.dumps(segmentos, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")

    # 3. Las escenas en la voz: en qué segundo entra cada una
    reloj.paso("escenas…")
    escenas_t = tiempos_de_escenas(escenas, segmentos, total, de="escenas.json")

    # 4. La evidencia de cada escena (una vez por URL; la licencia queda en FUENTES.md)
    reloj.paso("material…")
    mat_dir = PROYECTO / "fuentes" / "evidencia"
    mat_dir.mkdir(parents=True, exist_ok=True)
    registro: dict = {}
    try:
        archivos = [traer_items(PROYECTO, e.get("material") or [], k, mat_dir, registro) for k, e in enumerate(escenas_t)]
    except Falla as f:
        sys.exit(f"✗ {f}")
    fuentes_md(PROYECTO, registro)

    # 5. El audio: voz + el dron de apertura + la máquina de las tarjetas + whoosh de los cortes + música con
    # ducking, masterizado a -14 LUFS. Es el sonido de la edición (public/sonido.wav): Remotion lo lleva en el
    # render y el monitor en vivo lo oye.
    reloj.paso("audio…")
    audio_master = audio(voz, escenas_t, total, revision)
    sonido = PROYECTO / "public" / "sonido.wav"
    if sonido.exists():
        sonido.unlink()
    try:
        os.link(audio_master, sonido)
    except OSError:
        shutil.copy2(audio_master, sonido)

    # 6. La edición: el director pone cada tramo de material (foto con paneo, clip con su velocidad), el look de
    # color de su escena, el grano y la viñeta del expediente, las tarjetas ámbar y el karaoke Courier Prime —
    # capas dentro del video, con los tiempos de palabra de la misma transcripción—, en src/edicion.json.
    # Sin .ass ni post-pase de ffmpeg: out/ queda solo con el mp4 final.
    reloj.paso("edición…")
    # Las palabras entran ya en mayúsculas: el karaoke las pinta así (como el .ass del estilo) y así la medida
    # de grupos_de_lineas es la del texto que se ve — si no, una línea «cabe» en minúsculas y se sale en mayúsculas.
    subs = grupos_de_lineas(
        [(i, f, t.upper()) for i, f, t in palabras_tiempo(segmentos, 0.0)],
        ESTILOS_SUB["crimen"], ancho, alto)
    director.armar(escenas_t, archivos, PROYECTO, ancho, alto, total, audio="sonido.wav", subs=subs,
                   sonido=pistas(voz, escenas_t, total))

    # 7. El render de Remotion, sin audio como en el top: los cuadros de cada clip van ya sacados a imágenes
    # (cuadros_render.cjs, --antes), que es varias veces más rápido que OffthreadVideo cuadro a cuadro. La voz y
    # los efectos (`public/sonido.wav`) entran por ffmpeg, no por el `<Audio>` del render: la mezcla de audio de
    # Remotion es la pieza frágil y el `<Audio>` de la plantilla queda solo para el monitor en vivo. Los
    # subtítulos ya van dentro de la composición (capas del director), así que el mux es el video final:
    # out/ queda solo con él.
    reloj.paso("render…")
    nombre = nombre_arg or re.sub(r"^crimen-", "", PROYECTO.name)
    sin_sonido = out_dir / f"_crimen-{nombre}-video.mp4"
    final = out_dir / f"crimen-{nombre}.mp4"
    subprocess.run(["node", str(BASE / "render.cjs"), str(sin_sonido), "--id=Crimen", "--muted",
                    "--concurrency=66%", "--crf=18", "--x264-preset=veryfast",
                    "--pixel-format=yuv420p", "--color-space=bt709",
                    f"--antes={SKILL / 'scripts' / 'cuadros_render.cjs'}",
                    '--props={"cuadros":true}'], cwd=PROYECTO, check=True)
    ffmpeg("-i", str(sin_sonido), "-i", str(sonido), "-map", "0:v", "-map", "1:a",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
           "-movflags", "+faststart", str(final))
    sin_sonido.unlink()

    # 8. La portada de primer fotograma en vertical (PORTADA.md de video-base)
    portada_img = next((PROYECTO / p for p in ["portada.png", "public/portada.png", "portada/portada.png",
                                              "portada/portada.jpg"] if (PROYECTO / p).exists()), None)
    if alto > ancho and portada_img:
        subprocess.run(["node", str(BASE / "portada.mjs"), str(final), str(portada_img)], check=False)

    # 9. La hoja de cuadros para mirarlo de un vistazo
    reloj.paso("hoja…")
    hoja_png = hoja(final, revision / "hoja.png")
    # La voz vive solo en fuentes/voz/ (como en el top): si se usó una copia vieja de public/ o de la raíz,
    # se muda ahí; si ya estaba en fuentes/voz/, las copias de public/ y de la raíz son duplicados y se borran.
    carpeta_voz.mkdir(parents=True, exist_ok=True)
    if carpeta_voz in voz.parents:
        for viejo in (PROYECTO / "public" / "voz.wav", PROYECTO / "voz.wav"):
            viejo.unlink(missing_ok=True)
    else:
        destino = carpeta_voz / "voz.wav"
        if not destino.exists() or destino.stat().st_mtime < voz.stat().st_mtime:
            try:
                os.replace(voz, destino)
            except OSError:
                shutil.move(str(voz), str(destino))
        else:
            voz.unlink(missing_ok=True)
    # El proyecto entregado queda limpio: la mezcla y la edición ya son el video final (se regeneran en cada
    # corrida), las huellas de dedup ya sirvieron y portada.jpg es el crudo cuando ya está portada.png.
    # node_modules es un enlace compartido: no se cruza.
    for patron in ("mezcla.wav", "audio_master.wav"):
        for f in revision.glob(patron):
            f.unlink(missing_ok=True)
    for archivo_huella in PROYECTO.rglob("*.huella"):
        if "node_modules" not in archivo_huella.parts:
            archivo_huella.unlink(missing_ok=True)
    if (PROYECTO / "portada.png").exists():
        (PROYECTO / "portada.jpg").unlink(missing_ok=True)
    reloj.listo(final, [hoja_png])


if __name__ == "__main__":
    main()
