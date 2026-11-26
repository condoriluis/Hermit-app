"""
El video de top o ranking, del proyecto a `out/top-<nombre>.mp4`, con el contrato del motor
(`../video-base/MOTOR.md`):

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal] [--nombre <n>]

`--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit; sin ella, el directorio actual.

Lo que el agente deja en el proyecto:
- `guion.md`: gancho, la cuenta regresiva y el remate (las líneas en negrita son textos en pantalla, no narración).
- `fuentes/investigacion.md`: de dónde sale cada dato.
- `fuentes/voz/*.wav` (VOZ.md de video-base: ahí la deja `generar_voz`; `public/voz.wav` o `voz.wav` valen como
  rutas viejas), ya masterizada a -14 LUFS, y `public/musica.mp3`
  (o `musica.mp3`, `public/musica.wav`) opcional, a bajo volumen debajo de la voz.
- `top.json`: el montaje declarativo — cada escena con la `palabra` del guion donde entra, su `titular`, su
  `numero` (la cuenta regresiva: enteros que bajan de a uno hasta 1, con la tarjeta "NÚMERO N" y el golpe seco)
  y su `material`, una lista de 2 a 4 cosas que se reparten su tramo en partes iguales:
      {"foto": "<ruta o referencia>"}                        Ken Burns: paneo lento con zoom
      {"clip": "<ruta o referencia>", "desde": 1.5}           video con paneo lento; `desde` es el segundo de entrada
      {"clip": "<ruta o referencia>", "velocidad": 0.6}       `velocidad` estira o apura el clip (0.6 = cámara lenta)
  Una escena sin `material` es una tarjeta sobre fondo negro (título del video, cierre de interacción): solo
  lleva `numero` y/o `titular`. Las referencias son las de ../video-base/MATERIAL.md (`mixkit:`, `archive:`,
  `commons:`, `nasa:` o una URL de video); una ruta es un archivo del proyecto (por ejemplo
  `fuentes/material/05a.jpg`). Se bajan una vez y su licencia queda en `FUENTES.md`.
- `portada.png` (opcional en vertical: la pone de primer fotograma).

`--revisa` valida todo en un segundo y sin red ni voz: la forma de `top.json`, que cada `palabra` exista en el
guion y vaya en orden, y que cada `foto`/`clip` local exista o sea una referencia bien formada. El resto — voz,
material, la edición de Remotion (el director pone las fotos con paneo, los clips con su velocidad, las tarjetas
«NÚMERO N» y los titulares con su entrada), los golpes por puesto, los subtítulos karaoke en Anton con la palabra
activa amarilla —capas dentro de la composición, como en el documental—, portada y hoja— se cronometra en
`revision/tiempos.json`.
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
from pistas import a_public, duracion_wav  # noqa: E402
from hermit import duracion, transcribir  # noqa: E402
from momentos import Reloj, anclar, errores_mojibake, hoja, palabras_de, roto, texto_guion, tiempos_de_escenas  # noqa: E402
from subtitulos import ESTILOS as ESTILOS_SUB, grupos_de_lineas, palabras_tiempo  # noqa: E402
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
GOLPE = BASE.parent / "assets" / "sfx" / "golpe.wav"


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args], check=True)


def leer_top() -> tuple[dict, list[str]]:
    """top.json de la raíz; devuelve (datos, errores de forma)."""
    archivo = PROYECTO / "top.json"
    if not archivo.exists():
        return {}, ["falta top.json en la raíz del proyecto"]
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        return {}, [f"top.json no es JSON: {e}"]
    if not isinstance(datos, dict):
        return {}, ["top.json no es un objeto: lleva `formato` y `escenas`"]
    errores = errores_mojibake(datos)
    formato = datos.get("formato", "vertical")
    if formato not in FORMATOS:
        errores.append(f'formato «{formato}»: va "vertical" u "horizontal"')
    escenas = datos.get("escenas")
    if not isinstance(escenas, list) or not escenas:
        errores.append("no tiene escenas: una lista `escenas`, cada una con `palabra`, `titular` y `material`")
        escenas = []
    for k, e in enumerate(escenas):
        que = f"escena {k + 1}"
        if not isinstance(e, dict):
            errores.append(f"{que}: no es un objeto")
            continue
        if not str(e.get("palabra", "")).strip():
            errores.append(f"{que}: falta `palabra`, las palabras del guion donde entra")
        numero = e.get("numero")
        if numero is not None and (not isinstance(numero, int) or isinstance(numero, bool) or numero < 1):
            errores.append(f"{que}: `numero` es un entero ≥ 1 (el puesto de la cuenta regresiva) o se quita")
        t = e.get("titular")
        if t is not None and (not isinstance(t, str) or len(t) > 90):
            errores.append(f"{que}: `titular` es un texto de hasta 90 caracteres o se quita")
        material = e.get("material")
        if material is None:
            if not e.get("numero") and not e.get("titular"):
                errores.append(f"{que}: sin `material` solo vale una tarjeta: lleva `numero` o `titular`")
            continue
        if not isinstance(material, list) or not material:
            errores.append(f"{que}: `material` es una lista de 2 a 4 cosas (fotos o clips)")
            continue
        if len(material) > 4:
            errores.append(f"{que}: `material` pasa de 4 cosas: reparte el tramo en partes iguales")
        for j, item in enumerate(material):
            if not isinstance(item, dict):
                errores.append(f"{que} material {j + 1}: no es un objeto")
                continue
            revisar_item(PROYECTO, f"{que} material {j + 1}", item, errores)
            if "clip" in item and item.get("desde") is not None:
                try:
                    if float(item["desde"]) < 0:
                        raise ValueError
                except (TypeError, ValueError):
                    errores.append(f"{que} material {j + 1}: `desde` es un número de segundos ≥ 0")
    # La cuenta regresiva es el formato: `numero` baja de a uno hasta 1, sin huecos ni repeticiones.
    numeros = [e["numero"] for e in escenas if isinstance(e, dict)
               and isinstance(e.get("numero"), int) and not isinstance(e.get("numero"), bool)]
    if not numeros:
        errores.append("ninguna escena lleva `numero`: la cuenta regresiva es el formato del top")
    else:
        for a, b in zip(numeros, numeros[1:]):
            if b != a - 1:
                errores.append(f"la cuenta salta de {a} a {b}: baja de a uno (…4, 3, 2, 1)")
                break
        if numeros[-1] != 1:
            errores.append(f"la cuenta termina en {numeros[-1]}: el último puesto es el número 1")
    return datos, errores


SFX = SKILL / "sfx"


def cues(escenas: list[dict]) -> list[tuple[float, object, float]]:
    """Los momentos del kit del formato top, en segundos del video (los usa la mezcla final y las pistas
    del monitor, que se calculan de los mismos tiempos):

    - `swish_1` al empezar cada escena (el whoosh del corte de puesto).
    - `click_3` en cada cambio de material dentro de la escena.
    - `riser_1` antes del número 1 y `subboom_1` con su golpe — el payoff se prepara y aterriza.
    - `golpe.wav` (video-base) al entrar cada puesto — el mismo t0 del slam del número en la edición.
    - `outro_1` hacia el cierre.
    """
    cues: list[tuple[float, object, float]] = []
    for e in escenas:
        t0, t1 = e["t0"], e["t1"]
        mat = e.get("material") or []
        cues.append((t0, "swish_1", 0.16))
        if mat:
            slot = (t1 - t0) / len(mat)
            for j in range(1, len(mat)):
                cues.append((t0 + j * slot, "click_3", 0.26))
        if e.get("numero") == 1:
            cues.append((max(0.0, t0 - 0.8), "riser_1", 0.42))
            cues.append((t0, "subboom_1", 0.14))
    for t in [e["t0"] for e in escenas if e.get("numero")]:
        cues.append((t, GOLPE, 0.8))
    if escenas:
        cues.append((max(0.0, escenas[-1]["t1"] - 0.4), "outro_1", 0.4))
    return cues


def musica() -> Path | None:
    """La música incidental del proyecto: `public/musica.mp3`, `musica.mp3` o `public/musica.wav`."""
    return next((PROYECTO / p for p in ["public/musica.mp3", "musica.mp3", "public/musica.wav"]
                 if (PROYECTO / p).exists()), None)


def pistas(voz: Path, escenas: list[dict], total: float) -> dict:
    """El bloque `sonido` de edicion.json: las pistas del monitor en vivo y de la línea de tiempo — la voz,
    la música en loop a su volumen y cada efecto en su golpe, cada fuente en `public/sonido/` como WAV.
    El video final no las usa: su audio es la mezcla ffmpeg de `audio()`, que es la que se masteriza."""
    fps = 30  # el de la composición (comp.py)
    tope = round(total * fps)
    sonido: dict = {"voz": {"src": a_public(voz, "voz", PROYECTO), "desde": 0, "hasta": tope, "volumen": 1.0}}
    if (mus := musica()) is not None:
        sonido["musica"] = {"src": a_public(mus, "musica", PROYECTO), "volumen": 0.08}
    por_archivo: dict[str, list[tuple[float, float]]] = {}
    for t, s, g in cues(escenas):
        ruta = str(s) if Path(str(s)).is_absolute() or Path(str(s)).exists() else str(SFX / f"{s}.wav")
        por_archivo.setdefault(ruta, []).append((t, g))
    if por_archivo:
        sonido["sfx"] = []
        for ruta, suyos in por_archivo.items():
            rel = a_public(Path(ruta), Path(ruta).stem, PROYECTO)
            n = max(1, round(duracion_wav(PROYECTO / "public" / rel) * fps))
            for t, g in suyos:
                desde = max(0, int(round(t * fps)))
                sonido["sfx"].append({"src": rel, "desde": desde, "hasta": min(tope, desde + n), "volumen": g})
    return sonido


def audio(voz: Path, escenas: list[dict], revision: Path) -> Path:
    """
    La voz con la cama de efectos del formato top, masterizada a -14 LUFS (`public/musica.mp3`, `musica.mp3` o
    `public/musica.wav` a bajo volumen, como en politica). Es el audio del video final: la mezcla de Remotion
    es la pieza frágil (reel-collage la documenta fallando), así que el render va `--muted` y esto entra por
    ffmpeg. Las pistas del monitor en vivo y de la línea de tiempo son las de `pistas()`, calculadas de los
    mismos `cues()`.
    """
    audio_master = revision / "audio_master.wav"
    todos = cues(escenas)
    mus = musica()
    if not todos and not mus:
        subprocess.run(["node", str(BASE / "masterizar.mjs"), str(voz), str(audio_master)], check=True)
        return audio_master

    # Cada sonido único es una entrada; sus cues salen por adelay+volume como el golpe ya lo hacía.
    sonidos: list[str] = []

    def indice(sonido) -> int:
        # Devuelve el índice del input en ffmpeg: el 0 es la voz y los sonidos van del 1 en adelante.
        ruta = str(sonido) if Path(str(sonido)).is_absolute() or Path(str(sonido)).exists() else str(SFX / f"{sonido}.wav")
        if ruta not in sonidos:
            sonidos.append(ruta)
        return sonidos.index(ruta) + 1

    por_sonido: dict[int, list[tuple[float, float]]] = {}
    for t, sonido, ganancia in todos:
        por_sonido.setdefault(indice(sonido), []).append((t, ganancia))

    entradas = ["-i", str(voz)]
    idx = 1
    for ruta in sonidos:
        entradas += ["-i", ruta]
        idx += 1
    mus_idx = None
    if mus is not None:
        mus_idx = idx
        entradas += ["-stream_loop", "-1", "-i", str(mus)]

    partes = ["[0:a]aformat=channel_layouts=stereo,aresample=48000[voz]"]
    delays = []
    for i, suyos in por_sonido.items():
        n = len(suyos)
        partes.append(f"[{i}:a]asplit={n}" + "".join(f"[s{i}_{k}]" for k in range(n)))
        for k, (t, ganancia) in enumerate(suyos):
            ms = int(round(t * 1000))
            partes.append(f"[s{i}_{k}]adelay={ms}|{ms},volume={ganancia}[h{i}_{k}]")
            delays.append(f"[h{i}_{k}]")
    if mus_idx is not None:
        partes.append(f"[{mus_idx}:a]volume=0.08,aformat=channel_layouts=stereo[bg]")
        delays.append("[bg]")
    filtro = ";".join(partes) + ";[voz]" + "".join(delays) + \
        f"amix=inputs={len(delays) + 1}:duration=first:normalize=0[a]"
    mezcla = revision / "mezcla.wav"
    ffmpeg(*entradas, "-filter_complex", filtro, "-map", "[a]", str(mezcla))
    subprocess.run(["node", str(BASE / "masterizar.mjs"), str(mezcla), str(audio_master)], check=True)
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

    for f in ("guion.md", "top.json"):
        if not (PROYECTO / f).exists():
            sys.exit(f"✗ Falta {f} en la raíz del proyecto.")
    for f in ("guion.md", "top.json"):
        if malo := roto((PROYECTO / f).read_text(encoding="utf-8")):
            sys.exit(f"✗ {f} tiene la codificación rota («{malo}»): UTF-8 leído como latin-1; reescríbelo en UTF-8.")

    datos, errores = leer_top()
    if datos.get("formato") and not formato_arg:
        formato = datos["formato"]
    if errores:
        sys.exit("✗ top.json:\n  " + "\n  ".join(errores))
    escenas = [e for e in (datos.get("escenas") or []) if isinstance(e, dict)]
    if malos := anclar(escenas, palabras_de(texto_guion(PROYECTO)), "el guion")[1]:
        sys.exit("✗ top.json:\n  " + "\n  ".join(malos))
    if revisa:
        print("✓ top.json bien: ya puedes lanzar hacer.py de fondo")
        return

    ancho, alto = FORMATOS[formato]
    reloj = Reloj(PROYECTO)
    revision = PROYECTO / "revision"
    revision.mkdir(exist_ok=True)
    out_dir = PROYECTO / "out"
    out_dir.mkdir(exist_ok=True)

    # 1. La voz
    reloj.paso("voz…")
    # La voz vive en fuentes/voz/ (VOZ.md: ahí la deja generar_voz), como en el documental; public/voz.wav y
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

    # 3. Las escenas en la voz: en qué segundo entra cada puesto
    reloj.paso("escenas…")
    escenas_t = tiempos_de_escenas(escenas, segmentos, total, de="top.json")

    # 4. El material de cada escena (una vez por URL; la licencia queda en FUENTES.md)
    reloj.paso("material…")
    mat_dir = PROYECTO / "fuentes" / "material"
    mat_dir.mkdir(parents=True, exist_ok=True)
    registro: dict = {}
    try:
        archivos = [traer_items(PROYECTO, e.get("material") or [], k, mat_dir, registro) for k, e in enumerate(escenas_t)]
    except Falla as f:
        sys.exit(f"✗ {f}")
    fuentes_md(PROYECTO, registro)

    # 5. El audio del video final: voz + golpe por puesto + música incidental, masterizado a -14 LUFS
    # (public/sonido.wav). Entra por ffmpeg en el mux del paso 7; el monitor en vivo y la línea de tiempo
    # llevan las pistas de `pistas()` (paso 6), calculadas de los mismos cues.
    reloj.paso("audio…")
    audio_master = audio(voz, escenas_t, revision)
    sonido = PROYECTO / "public" / "sonido.wav"
    if sonido.exists():
        sonido.unlink()
    try:
        os.link(audio_master, sonido)
    except OSError:
        shutil.copy2(audio_master, sonido)

    # 6. La edición: el director pone cada tramo de material (foto con paneo, clip con su velocidad), los textos
    # del puesto con su entrada, las escenas y los subtítulos karaoke —capas dentro del video, como en el
    # documental, con los tiempos de palabra de la misma transcripción—, en src/edicion.json. Sin .ass ni
    # post-pase de ffmpeg: out/ queda solo con el mp4 final. El bloque `sonido` son las pistas del monitor en
    # vivo y de la línea de tiempo (la voz, la música y cada efecto por separado); el audio del video final
    # es la mezcla de arriba, que entra por ffmpeg en el mux.
    reloj.paso("edición…")
    subs = grupos_de_lineas(palabras_tiempo(segmentos, 0.0), ESTILOS_SUB["top"], ancho, alto)
    edicion = director.armar(escenas_t, archivos, PROYECTO, ancho, alto, total, audio=None, subs=subs)
    edicion["sonido"] = pistas(voz, escenas_t, total)
    (PROYECTO / "src" / "edicion.json").write_text(json.dumps(edicion, ensure_ascii=False), encoding="utf-8")

    # 7. El render de Remotion, sin audio como en el documental: los cuadros de cada clip van ya sacados a imágenes
    # (cuadros_render.cjs, --antes), que es varias veces más rápido que OffthreadVideo cuadro a cuadro. La voz y los
    # efectos (`public/sonido.wav`) entran por ffmpeg, no por el `<Audio>` del render: la mezcla de audio de
    # Remotion es la pieza frágil (reel-collage la documenta fallando y El Diff la dejó por @remotion/media), y los
    # `<Audio>` de la plantilla quedan solo para el monitor en vivo, con las pistas del bloque `sonido`. Los
    # subtítulos ya van dentro de la composición (capas del director), así que el mux es el video final: out/
    # queda solo con él.
    reloj.paso("render…")
    nombre = nombre_arg or re.sub(r"^top-", "", PROYECTO.name)
    sin_sonido = out_dir / f"_top-{nombre}-video.mp4"
    final = out_dir / f"top-{nombre}.mp4"
    subprocess.run(["node", str(BASE / "render.cjs"), str(sin_sonido), "--id=Top", "--muted",
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
    # La voz vive solo en fuentes/voz/ (como en el documental): si se usó una copia vieja de public/ o de la raíz,
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
