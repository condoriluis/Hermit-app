"""
El video de top o ranking, del proyecto a `out/top-<nombre>.mp4`, con el contrato del motor
(`../video-base/MOTOR.md`):

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal] [--nombre <n>]

`--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit; sin ella, el directorio actual.

Lo que el agente deja en el proyecto:
- `guion.md`: gancho, la cuenta regresiva y el remate (las líneas en negrita son textos en pantalla, no narración).
- `fuentes/investigacion.md`: de dónde sale cada dato.
- `public/voz.wav` (o `voz.wav`), ya masterizada a -14 LUFS (VOZ.md de video-base), y `public/musica.mp3`
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
material, tarjeta, golpe por puesto, subtítulos karaoke en Anton con la palabra activa amarilla
(`subtitulos.py --estilo top`), portada y hoja— se cronometra en `revision/tiempos.json`.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
SKILL = Path(__file__).resolve().parent.parent
BASE = SKILL.parent / "video-base" / "scripts"
sys.path.insert(0, str(BASE))
from bancos import Falla, fuentes_md, revisar_item, traer_items  # noqa: E402
from hermit import duracion, encoder_video, transcribir  # noqa: E402
from momentos import Reloj, anclar, errores_mojibake, hoja, palabras_de, roto, texto_guion, tiempos_de_escenas  # noqa: E402
from tramos import es_clip, desde_de, render_tarjeta, render_tramo, unir_tramos, velocidad_de  # noqa: E402

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
FPS = 30
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


def escribir_textos(escenas: list[dict], revision: Path, ancho: int, alto: int) -> tuple[dict, str]:
    """
    Un .txt por texto de tarjeta y, por escena, sus drawtext listos: (archivo, tamaño en px, color, y en px).
    El número va en el amarillo del top (#ffe600); el titular, en blanco. Ambos con contorno negro. El tamaño
    escala con el lado menor del cuadro para que se vea igual en vertical y en horizontal.
    """
    carpeta = revision / "txt"
    carpeta.mkdir(parents=True, exist_ok=True)
    fuente = (BASE.parent / "assets" / "fonts" / "Anton-Regular.ttf").as_posix().replace(":", "\\:")
    escala = min(ancho / 1080, alto / 1920)
    salida = {}
    for k, e in enumerate(escenas):
        items = []
        tarjeta = not e.get("material")  # escena de solo tarjeta: los textos van centrados, no arriba
        if e.get("numero"):
            numero = carpeta / f"e{k}-num.txt"
            numero.write_text(f"NÚMERO {e['numero']}", encoding="utf-8")
            items.append((numero.as_posix().replace(":", "\\:"), round(96 * escala), "#ffe600",
                          round(alto * (0.40 if tarjeta else 0.10))))
        if e.get("titular"):
            titular = carpeta / f"e{k}-tit.txt"
            titular.write_text(str(e["titular"]).upper(), encoding="utf-8")
            y = round(alto * (0.50 if e.get("numero") else 0.46)) if tarjeta else round(alto * 0.175)
            items.append((titular.as_posix().replace(":", "\\:"), round(52 * escala), "#ffffff", y))
        salida[k] = items
    return salida, fuente


def visual(escenas: list[dict], archivos: list[list[Path]], textos: dict, fuente: str, ancho: int, alto: int,
           revision: Path) -> Path:
    """
    Cada escena en tramos iguales de su material —foto con paneo Ken Burns, clip con paneo lento— con la tarjeta
    del puesto encima; una escena sin `material` es una tarjeta sobre fondo negro. Los tramos unen en
    visual.mp4 (sin audio: la voz y los golpes van aparte).
    """
    segmentos = []
    k_global = 0
    for k, e in enumerate(escenas):
        dur = e["t1"] - e["t0"]
        suyos = archivos[k]
        items_texto = textos.get(k, [])
        if not suyos:
            salida = revision / f"seg-{k + 1}-tarjeta.mp4"
            render_tarjeta(salida, dur, items_texto, fuente, ancho, alto, FPS)
            segmentos.append(salida)
            k_global += 1
            continue
        slot = dur / len(suyos)
        for j, ruta in enumerate(suyos):
            salida = revision / f"seg-{k + 1}-{j + 1}.mp4"
            extra = [f"drawtext=fontfile='{fuente}':textfile='{ruta_txt}':expansion=none:fontsize={tam_px}:fontcolor={color}:"
                     f"borderw={max(2, round(tam_px * 0.05))}:bordercolor=black:x=(w-text_w)/2:y={y}"
                     for ruta_txt, tam_px, color, y in items_texto]
            item = e["material"][j]
            render_tramo(salida, ruta, slot, es_clip(item), desde_de(item), velocidad_de(item),
                         ancho, alto, FPS, extra, k_global % 2 == 0)
            segmentos.append(salida)
            k_global += 1
    return unir_tramos(segmentos, revision / "visual.mp4")


def audio(voz: Path, escenas: list[dict], revision: Path) -> Path:
    """La voz con el golpe seco al entrar cada puesto de la cuenta regresiva y la música incidental a bajo
    volumen (`public/musica.mp3`, `musica.mp3` o `public/musica.wav`, como en politica), masterizada a -14 LUFS."""
    audio_master = revision / "audio_master.wav"
    puestos = [e["t0"] for e in escenas if e.get("numero")]
    musica = next((PROYECTO / p for p in ["public/musica.mp3", "musica.mp3", "public/musica.wav"]
                   if (PROYECTO / p).exists()), None)
    hay_golpe = bool(puestos) and GOLPE.exists()
    if not hay_golpe and not musica:
        subprocess.run(["node", str(BASE / "masterizar.mjs"), str(voz), str(audio_master)], check=True)
        return audio_master

    entradas = ["-i", str(voz)]
    idx = 1
    golpe_idx = None
    if hay_golpe:
        golpe_idx = idx
        entradas += ["-i", str(GOLPE)]
        idx += 1
    mus_idx = None
    if musica:
        mus_idx = idx
        entradas += ["-stream_loop", "-1", "-i", str(musica)]
    partes = ["[0:a]aformat=channel_layouts=stereo,aresample=48000[voz]"]
    delays = []
    if hay_golpe:
        partes.append(f"[{golpe_idx}:a]asplit={len(puestos)}" + "".join(f"[g{k}]" for k in range(len(puestos))))
        for k, t in enumerate(puestos):
            ms = int(round(t * 1000))
            partes.append(f"[g{k}]adelay={ms}|{ms},volume=0.8[h{k}]")
            delays.append(f"[h{k}]")
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
    voz = next((PROYECTO / p for p in ["public/voz.wav", "voz.wav"] if (PROYECTO / p).exists()), None)
    if not voz:
        sys.exit("✗ Falta el audio en public/voz.wav o voz.wav (VOZ.md de video-base).")
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

    # 5. El visual: tramos con su tarjeta de puesto
    reloj.paso("visual…")
    textos, fuente = escribir_textos(escenas_t, revision, ancho, alto)
    video_crudo = visual(escenas_t, archivos, textos, fuente, ancho, alto, revision)

    # 6. El audio: voz + golpe por puesto, masterizado
    reloj.paso("audio…")
    audio_master = audio(voz, escenas_t, revision)

    # 7. El video base (visual + audio) y los subtítulos karaoke del estilo.
    # subtitulos.py corre ffmpeg con cwd=salida.parent y nombres relativos: el base va en out/, junto a la salida.
    # Con `_` delante no cuenta como video terminado (la etapa «Video» y las Entregas solo ven el final).
    reloj.paso("render…")
    nombre = nombre_arg or re.sub(r"^top-", "", PROYECTO.name)
    base_mp4 = out_dir / f"_top-{nombre}-base.mp4"
    ffmpeg("-i", str(video_crudo), "-i", str(audio_master), "-map", "0:v", "-map", "1:a",
           *encoder_video(18), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(base_mp4))

    reloj.paso("subtítulos…")
    final = out_dir / f"top-{nombre}.mp4"
    subprocess.run([sys.executable, "-I", "-B", "-X", "utf8", str(BASE / "subtitulos.py"),
                    str(base_mp4), str(final), "--estilo", "top", "--formato", formato], check=True)

    # 8. La portada de primer fotograma en vertical (PORTADA.md de video-base)
    portada_img = next((PROYECTO / p for p in ["portada.png", "public/portada.png", "portada/portada.png",
                                              "portada/portada.jpg"] if (PROYECTO / p).exists()), None)
    if alto > ancho and portada_img:
        subprocess.run(["node", str(BASE / "portada.mjs"), str(final), str(portada_img)], check=False)

    # 9. La hoja de cuadros para mirarlo de un vistazo
    reloj.paso("hoja…")
    hoja_png = hoja(final, revision / "hoja.png")
    reloj.listo(final, [hoja_png])


if __name__ == "__main__":
    main()
