"""
El video motivacional, del proyecto a `out/motivacional-<nombre>.mp4`, con el contrato del motor
(`../video-base/MOTOR.md`):

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal] [--nombre <n>]

`--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit; sin ella, el directorio actual.

Lo que el agente deja en el proyecto:
- `guion.md`: la narración (las líneas en negrita son textos en pantalla, no narración).
- `fuentes/tema.md` o `fuentes/investigacion.md`: de dónde sale cada idea.
- `public/voz.wav` (o `voz.wav`), ya masterizada a -14 LUFS (VOZ.md de video-base), y `public/musica.mp3`
  (o `musica.mp3`, `public/musica.wav`) opcional: entra y sale con fundido, a bajo volumen debajo de la voz.
- `escenas.json`: el montaje declarativo — cada escena con la `palabra` del guion donde entra, su `look`
  (el tratamiento de color del estilo) y su `material`, una lista de 1 a 4 cosas que se reparten su tramo
  en partes iguales:
      {"foto": "<ruta o referencia>"}                        Ken Burns: paneo lento con zoom
      {"clip": "<ruta o referencia>", "desde": 1.5}           video con paneo lento; `desde` es el segundo de entrada
      {"clip": "<ruta o referencia>", "velocidad": 0.6}       `velocidad` estira o apura el clip (0.6 = cámara lenta)
  `look`: `bn` (blanco y negro de contraste), `desaturado` (el de serie: colores apagados, contraste alto;
  es el de omisión), `color` (sin tratar). Una escena **sin `material`** es una tarjeta sobre fondo negro con
  la cita centrada (`titular`, `\\n` parte renglones): solo lleva `titular`. Las referencias son las de
  ../video-base/MATERIAL.md (`mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de video); una ruta es un
  archivo del proyecto. Se bajan una vez y su licencia queda en `FUENTES.md`.
- `portada.png` (opcional en vertical: la pone de primer fotograma).

`--revisa` valida todo en un segundo y sin red ni voz: la forma de `escenas.json`, que cada `palabra` exista
en el guion y vaya en orden, y que cada `foto`/`clip` local exista o sea una referencia bien formada. El resto
— voz, material, look, música, subtítulos karaoke en Bebas Neue (`subtitulos.py --estilo minimal`), portada y
hoja— se cronometra en `revision/tiempos.json`.
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
# El tratamiento de color de cada `look`, como filtros ffmpeg encadenados tras el paneo. El desaturado es el
# de serie (la esencia: imágenes desaturadas con alto contraste); `color` deja la imagen tal cual.
LOOKS = {
    "bn": "hue=s=0,eq=contrast=1.15:brightness=-0.02",
    "desaturado": "eq=saturation=0.45:contrast=1.2:brightness=-0.04",
    "color": "",
}
LOOK_POR_DEFECTO = "desaturado"
FUENTE_TARJETA = "BebasNeue-Regular.ttf"
TAM_TARJETA = 0.06  # alto de la letra de la tarjeta como fracción del ancho (65 px en 1080)


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
            revisar_item(PROYECTO, f"{que} material {j + 1}", item, errores)
            if "clip" in item and item.get("desde") is not None:
                try:
                    if float(item["desde"]) < 0:
                        raise ValueError
                except (TypeError, ValueError):
                    errores.append(f"{que} material {j + 1}: `desde` es un número de segundos ≥ 0")
    return datos, errores


def escribir_tarjetas(escenas: list[dict], revision: Path, ancho: int) -> tuple[dict, str]:
    """
    Un .txt por renglón de cada tarjeta (`titular`, `\\n` lo parte) y sus drawtext listos en columna desde y=0:
    k → (items, alto del bloque en px). El centrado vertical lo hace `visual` y el horizontal `render_tarjeta`.
    La letra es la Bebas Neue del estilo.
    """
    carpeta = revision / "txt"
    carpeta.mkdir(parents=True, exist_ok=True)
    fuente = (BASE.parent / "assets" / "fonts" / FUENTE_TARJETA).as_posix().replace(":", "\\:")
    tam = round(TAM_TARJETA * ancho)
    paso = round(tam * 1.28)
    salida = {}
    for k, e in enumerate(escenas):
        if e.get("material") or not e.get("titular"):
            continue
        lineas = [l.strip() for l in str(e["titular"]).split("\n") if l.strip()]
        items = []
        for i, linea in enumerate(lineas):
            txt = carpeta / f"e{k}-t{i}.txt"
            txt.write_text(linea, encoding="utf-8")
            items.append((txt.as_posix().replace(":", "\\:"), tam, "#ffffff", i * paso))
        salida[k] = (items, len(lineas) * paso)
    return salida, fuente


def visual(escenas: list[dict], archivos: list[list[Path]], tarjetas: dict, fuente: str,
           ancho: int, alto: int, revision: Path) -> Path:
    """
    Cada escena en tramos iguales de su material con su `look` (el tratamiento de color del estilo); una escena
    sin `material` es una tarjeta sobre fondo negro con la cita centrada. Los tramos unen en visual.mp4
    (sin audio: la voz y la música van aparte).
    """
    segmentos = []
    k_tramo = 0
    for k, e in enumerate(escenas):
        dur = e["t1"] - e["t0"]
        suyos = archivos[k]
        if not suyos:
            salida = revision / f"seg-{k + 1}-tarjeta.mp4"
            bloque = tarjetas.get(k)
            if bloque:
                items, alto_bloque = bloque
                y0 = max(round((alto - alto_bloque) / 2), 0)
                items = [(r, t, c, y + y0) for r, t, c, y in items]
            else:
                items = []
            render_tarjeta(salida, dur, items, fuente, ancho, alto, FPS)
            segmentos.append(salida)
            k_tramo += 1
            continue
        look = LOOKS.get(e.get("look") or LOOK_POR_DEFECTO, "")
        extra = [look] if look else []
        slot = dur / len(suyos)
        for j, ruta in enumerate(suyos):
            salida = revision / f"seg-{k + 1}-{j + 1}.mp4"
            item = e["material"][j]
            render_tramo(salida, ruta, slot, es_clip(item), desde_de(item), velocidad_de(item),
                         ancho, alto, FPS, extra, k_tramo % 2 == 0)
            segmentos.append(salida)
            k_tramo += 1
    return unir_tramos(segmentos, revision / "visual.mp4")


def audio(voz: Path, total: float, revision: Path) -> Path:
    """La voz con la música incidental debajo —entra y sale con fundido—, masterizada a -14 LUFS."""
    audio_master = revision / "audio_master.wav"
    musica = next((PROYECTO / p for p in ["public/musica.mp3", "musica.mp3", "public/musica.wav"]
                   if (PROYECTO / p).exists()), None)
    if not musica:
        subprocess.run(["node", str(BASE / "masterizar.mjs"), str(voz), str(audio_master)], check=True)
        return audio_master
    fundidos = ""
    if total > 6:
        fundidos = f",afade=t=in:st=0:d=2.5,afade=t=out:st={max(total - 3, 0):.3f}:d=3"
    mezcla = revision / "mezcla.wav"
    ffmpeg("-i", str(voz), "-stream_loop", "-1", "-i", str(musica), "-filter_complex",
           "[0:a]aformat=channel_layouts=stereo,aresample=48000[voz];"
           f"[1:a]volume=0.08{fundidos},aformat=channel_layouts=stereo[bg];"
           "[voz][bg]amix=inputs=2:duration=first:normalize=0[a]",
           "-map", "[a]", str(mezcla))
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

    for f in ("guion.md", "escenas.json"):
        if not (PROYECTO / f).exists():
            sys.exit(f"✗ Falta {f} en la raíz del proyecto.")
    for f in ("guion.md", "escenas.json"):
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

    # 3. Las escenas en la voz: en qué segundo entra cada una
    reloj.paso("escenas…")
    escenas_t = tiempos_de_escenas(escenas, segmentos, total, de="escenas.json")

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

    # 5. El visual: tramos con su look, o la tarjeta sola
    reloj.paso("visual…")
    tarjetas, fuente = escribir_tarjetas(escenas_t, revision, ancho)
    video_crudo = visual(escenas_t, archivos, tarjetas, fuente, ancho, alto, revision)

    # 6. El audio: voz + música con fundidos, masterizado
    reloj.paso("audio…")
    audio_master = audio(voz, total, revision)

    # 7. El video base (visual + audio) y los subtítulos del estilo.
    # subtitulos.py corre ffmpeg con cwd=salida.parent y nombres relativos: el base va en out/, junto a la salida.
    # Con `_` delante no cuenta como video terminado (la etapa «Video» y las Entregas solo ven el final).
    reloj.paso("render…")
    nombre = nombre_arg or re.sub(r"^motivacional-", "", PROYECTO.name)
    base_mp4 = out_dir / f"_motivacional-{nombre}-base.mp4"
    ffmpeg("-i", str(video_crudo), "-i", str(audio_master), "-map", "0:v", "-map", "1:a",
           *encoder_video(18), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(base_mp4))

    reloj.paso("subtítulos…")
    final = out_dir / f"motivacional-{nombre}.mp4"
    subprocess.run([sys.executable, "-I", "-B", "-X", "utf8", str(BASE / "subtitulos.py"),
                    str(base_mp4), str(final), "--estilo", "minimal", "--formato", formato], check=True)

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
