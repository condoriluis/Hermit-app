"""
El anuncio de publicidad, del proyecto a `out/publicidad-<nombre>.mp4`, con el contrato del motor
(`../video-base/MOTOR.md`):

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal] [--nombre <n>]

`--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit; sin ella, el directorio actual.

Lo que el agente deja en el proyecto:
- `guion.md`: lo que se narra; las líneas en negrita son textos en pantalla, no narración.
- `fuentes/investigacion.md`: de dónde sale cada dato y cada claim del anuncio.
- `fuentes/voz/*.wav` (VOZ.md de video-base: ahí la deja `generar_voz`; `public/voz.wav` o `voz.wav` valen como
  rutas viejas), ya masterizada a -14 LUFS, y la música (`public/musica.mp3`, `musica.mp3`,
  `public/musica.wav` o `musica.wav`) según el `sonido` de abajo.
- `publicidad.json`: el montaje declarativo — la anatomía del anuncio. Cada escena lleva su `tipo` y puede
  llevar `titular`, `sub`, `cta`, `oferta` y `material`:
      {"tipo": "gancho",     "palabra": "...", "titular": "...", "material": [...]}
      {"tipo": "problema",   "palabra": "...", "sub": "..."}
      {"tipo": "solucion",   "palabra": "...", "titular": "...", "material": [...]}
      {"tipo": "beneficios", "palabra": "...", "sub": "..."}
      {"tipo": "prueba",     "palabra": "...", "material": [...]}
      {"tipo": "oferta",     "palabra": "...", "oferta": "-30% HOY", "material": [...]}
      {"tipo": "cierre",     "palabra": "..."}
  `tipo` es uno de `gancho`, `problema`, `solucion`, `beneficios`, `prueba`, `oferta` o `cierre` (los del
  medio son flexibles y no todos hacen falta: un anuncio corto combina beats). La primera escena es
  `gancho` y la última `cierre`; el `cierre` es la tarjeta de marca (logo + eslogan + CTA, sale de
  `marca.json`) y no lleva `material`. El `material` es una lista de 1 a 4 cosas que se reparten su tramo
  en partes iguales: `{"foto": "<ruta o referencia>"}` (paneo Ken Burns) o `{"clip": "<ruta o referencia>",
  "desde": <s>, "velocidad": <n>}`. Una escena sin `material` es una tarjeta sobre fondo con los textos
  centrados y el tipo en fantasma. `oferta` es el texto del sticker de precio/descuento (hasta 30
  caracteres) y solo va en escenas `tipo: oferta`. Las referencias son las de
  ../video-base/MATERIAL.md (`mixkit:`, `archive:`, `commons:`, `nasa:` o una URL de video); una ruta es un
  archivo del proyecto — así entran los clips generados en Google Flow, que se guardan en `fuentes/flow/`
  (FLOW.md de video-base). Se bajan una vez y su licencia queda en `FUENTES.md`.
- `sonido` (opcional, "voz" por defecto): quién manda en el audio.
  - `"voz"`: la voz narrada manda y la música, si hay, suena baja debajo.
  - `"ambos"`: la voz narra y la música suena a volumen real debajo (anuncio con locución sobre su canción).
  - `"musica"`: solo la canción (`public/musica.mp3` o `.wav`, obligatoria; no hay voz ni subtítulos de
    karaoke: los textos en pantalla cargan el mensaje). En este modo cada escena lleva `t`, el segundo exacto
    donde entra — los cortes se sincronizan a mano con los golpes de la música — y NO lleva `palabra`.
- `marca.json` (opcional pero el cierre lo agradece): la marca del anuncio — `nombre`, `eslogan`, `cta`,
  `color` (#RRGGBB, para la píldora del CTA y el acento de los subtítulos), `fondo` (#RRGGBB oscuro de la
  tarjeta de marca, por defecto casi negro), `logo` (ruta a un png/jpg/webp del logo oficial, nunca uno
  redibujado por IA) y `sitio`. El `cierre` pisa `eslogan`/`cta` con su `titular`/`cta` propios.
- `portada.png` (opcional en vertical: la pone de primer fotograma).

`--revisa` valida todo en un segundo y sin red ni voz: la forma de `publicidad.json`, la anatomía (gancho
primero, cierre último), el `sonido` y los `t` ordenados, que cada `palabra` exista en el guion y vaya en
orden (o que cada `t` sea un segundo ≥ 0 creciente en modo música), que el logo exista si está declarado, y
que cada `foto`/`clip` local exista o sea una referencia bien formada. El resto — voz, material, la edición
de Remotion (el director pone cada tramo de material, los textos del anuncio que entran en cada corte, la
tarjeta de marca con sus entradas escalonadas y los subtítulos karaoke en Anton con la palabra activa del
color de la marca, todo como capas dentro de la composición, cortados donde empieza la tarjeta de marca; en
modo música no hay), audio, portada y hoja— se cronometra en `revision/tiempos.json`.
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
from bancos import Falla, fuentes_md, revisar_item, traer_items  # noqa: E402
from hermit import duracion, transcribir  # noqa: E402
from momentos import Reloj, anclar, errores_mojibake, hoja, palabras_de, roto, texto_guion, tiempos_de_escenas  # noqa: E402
from pistas import a_public, duracion_wav  # noqa: E402
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
FPS = 30
TIPOS = {"gancho", "problema", "solucion", "beneficios", "prueba", "oferta", "cierre"}
SONIDOS = ("voz", "ambos", "musica")
# Dónde puede estar la música de fondo: la misma lista en `audio` y en el modo `musica`.
PISTAS = ("public/musica.mp3", "musica.mp3", "public/musica.wav", "musica.wav")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args], check=True)


def leer_marca() -> tuple[dict, list[str]]:
    """marca.json de la raíz, si está: la marca del anuncio. Devuelve (datos, errores)."""
    archivo = PROYECTO / "marca.json"
    if not archivo.exists():
        return {}, []
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        return {}, [f"marca.json no es JSON: {e}"]
    errores = errores_mojibake(datos, "marca.json")
    if not isinstance(datos, dict):
        return {}, ["marca.json no es un objeto: lleva `nombre`, `eslogan`, `cta`, `color`…"]
    for campo in ("nombre", "eslogan", "cta", "sitio"):
        if campo in datos and datos[campo] is not None and not isinstance(datos[campo], str):
            errores.append(f"marca.{campo} es texto o se quita")
    for campo in ("color", "fondo"):
        if campo in datos and datos[campo] is not None:
            if not isinstance(datos[campo], str) or not HEX.match(datos[campo]):
                errores.append(f'marca.{campo} es un color #RRGGBB (por ejemplo "#00a3e0") o se quita')
    logo = datos.get("logo")
    if logo is not None:
        if not isinstance(logo, str):
            errores.append("marca.logo es la ruta a un png/jpg/webp del logo oficial")
        else:
            ruta = (PROYECTO / logo).resolve()
            if ruta.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
                errores.append(f"marca.logo ({logo}): va un png, jpg o webp; un svg hay que pasarlo a png")
            elif not ruta.exists():
                errores.append(f"marca.logo apunta a {logo}, que no existe en el proyecto")
    return datos, errores


def leer_publicidad(marca: dict) -> tuple[dict, list[str]]:
    """publicidad.json de la raíz; devuelve (datos, errores de forma y anatomía)."""
    archivo = PROYECTO / "publicidad.json"
    if not archivo.exists():
        return {}, ["falta publicidad.json en la raíz del proyecto"]
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        return {}, [f"publicidad.json no es JSON: {e}"]
    if not isinstance(datos, dict):
        return {}, ["publicidad.json no es un objeto: lleva `formato` y `escenas`"]
    errores = errores_mojibake(datos)
    formato = datos.get("formato", "vertical")
    if formato not in FORMATOS:
        errores.append(f'formato «{formato}»: va "vertical" u "horizontal"')
    sonido = datos.get("sonido", "voz")
    if sonido not in SONIDOS:
        errores.append('`sonido` es "voz" (la voz narra), "ambos" (voz con la música a volumen real) o '
                       '"musica" (solo la canción, escenas cortadas por `t`)')
        sonido = "voz"
    escenas = datos.get("escenas")
    if not isinstance(escenas, list) or not escenas:
        errores.append("no tiene escenas: una lista `escenas` con la anatomía del anuncio")
        escenas = []
    if escenas:
        if len(escenas) < 3 or len(escenas) > 8:
            errores.append(f"tiene {len(escenas)} escenas: un anuncio lleva de 3 a 8")
        tiempos = []
        for k, e in enumerate(escenas):
            que = f"escena {k + 1}"
            if not isinstance(e, dict):
                errores.append(f"{que}: no es un objeto")
                continue
            tipo = e.get("tipo")
            if tipo is not None and tipo not in TIPOS:
                errores.append(f'{que}: `tipo` es uno de {", ".join(sorted(TIPOS))} o se quita')
            # El ancla del tiempo: `palabra` del guion narrado, o `t` (el segundo) en modo música.
            if sonido == "musica":
                if "palabra" in e:
                    errores.append(f"{que}: en sonido \"musica\" el tiempo es `t` (segundos), no `palabra`")
                tt = e.get("t")
                if tt is None:
                    errores.append(f"{que}: falta `t`, el segundo donde entra (los cortes van a los golpes de la música)")
                else:
                    try:
                        if isinstance(tt, bool) or float(tt) < 0:
                            raise ValueError
                        tiempos.append(float(tt))
                    except (TypeError, ValueError):
                        errores.append(f"{que}: `t` es un número de segundos ≥ 0")
            else:
                if "t" in e:
                    errores.append(f"{que}: `t` solo va con sonido \"musica\": aquí el tiempo sale de la `palabra`")
                if not str(e.get("palabra", "")).strip():
                    errores.append(f"{que}: falta `palabra`, las palabras del guion donde entra")
            t = e.get("titular")
            if t is not None and (not isinstance(t, str) or len(t) > 90):
                errores.append(f"{que}: `titular` es un texto de hasta 90 caracteres o se quita")
            s = e.get("sub")
            if s is not None and (not isinstance(s, str) or len(s) > 80):
                errores.append(f"{que}: `sub` es un texto de hasta 80 caracteres o se quita")
            if s is not None and tipo == "cierre":
                errores.append(f"{que}: el cierre no lleva `sub`: es la tarjeta de marca")
            cta = e.get("cta")
            if cta is not None and (not isinstance(cta, str) or len(cta) > 40):
                errores.append(f"{que}: `cta` es un texto de hasta 40 caracteres o se quita")
            if cta is not None and tipo != "cierre":
                errores.append(f"{que}: `cta` solo va en el `cierre` (la llamada a la acción de la tarjeta de marca)")
            oferta = e.get("oferta")
            if oferta is not None:
                if tipo != "oferta":
                    errores.append(f"{que}: `oferta` (el sticker de precio o descuento) solo va en `tipo: oferta`")
                if not isinstance(oferta, str) or not oferta.strip() or len(oferta) > 30:
                    errores.append(f"{que}: `oferta` es el texto del sticker, hasta 30 caracteres (\"-30% HOY\", \"2X1\")")
            material = e.get("material")
            if material is not None:
                if tipo == "cierre":
                    errores.append(f"{que}: el cierre es la tarjeta de marca: no lleva `material`")
                if not isinstance(material, list) or not material:
                    errores.append(f"{que}: `material` es una lista de 1 a 4 cosas (fotos o clips)")
                else:
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
        # La anatomía del anuncio: gancho primero, cierre último, un solo cierre.
        tipos = [e.get("tipo") for e in escenas if isinstance(e, dict)]
        if tipos and tipos[0] != "gancho":
            errores.append('la primera escena es el `gancho`: el anuncio abre con la promesa o el problema en 3 segundos')
        if tipos and tipos[-1] != "cierre":
            errores.append('la última escena es el `cierre`: la tarjeta de marca con logo, eslogan y CTA')
        if "cierre" in tipos[:-1]:
            errores.append("hay un `cierre` antes del final: el anuncio cierra una sola vez, al final")
        # El cierre necesita qué decir: el eslogan de la escena o el de marca.json.
        ultimo = escenas[-1] if escenas and isinstance(escenas[-1], dict) else {}
        if tipos and tipos[-1] == "cierre" and not ultimo.get("titular") and not marca.get("eslogan"):
            errores.append("el cierre no tiene eslogan: pon `titular` en la escena o `eslogan` en marca.json")
        # En modo música los `t` van en orden y sin repetirse: cada escena entra después de la anterior.
        if sonido == "musica" and len(tiempos) == len([e for e in escenas if isinstance(e, dict)]):
            for a, b in zip(tiempos, tiempos[1:]):
                if b <= a:
                    errores.append("los `t` no van en orden: cada escena entra después de la anterior")
                    break
    return datos, errores


def cues_de(escenas_t: list[dict]) -> list[tuple[float, str, float]]:
    """
    Los efectos de sonido del anuncio, en (segundo, wav, volumen): whoosh en el corte de cada escena, click
    en cada corte de material dentro de la escena, un riser antes de la tarjeta de marca, el impacto con su
    subgrave en el cierre y el outro al final. Es la mitad sonora del golpe publicitario: el whoosh marca el
    cambio de beat y el impacto el momento de la marca. Los wavs viven en `sfx/` de la skill.
    """
    cues = []
    for e in escenas_t:
        t0, t1 = float(e["t0"]), float(e["t1"])
        cues.append((t0, "swish_1", 0.16))
        mat = e.get("material") or []
        if mat and e.get("tipo") != "cierre":
            slot = (t1 - t0) / len(mat)
            for j in range(1, len(mat)):
                cues.append((t0 + j * slot, "click_3", 0.26))
    if escenas_t and escenas_t[-1].get("tipo") == "cierre":
        t0 = float(escenas_t[-1]["t0"])
        cues.append((max(0.0, t0 - 0.8), "riser_1", 0.42))
        cues.append((t0, "impact_1", 0.50))
        cues.append((t0 + 0.05, "subboom_1", 0.14))
    if escenas_t:
        cues.append((max(0.0, float(escenas_t[-1]["t1"]) - 0.4), "outro_1", 0.40))
    return [(t, s, g) for t, s, g in cues if (SKILL / "sfx" / f"{s}.wav").exists()]


def audio(voz: Path | None, pista: Path | None, escenas_t: list[dict], revision: Path,
          sonido: str) -> Path:
    """
    El sonido entero del anuncio, masterizado a -14 LUFS en `revision/audio_master.wav`:
    - `voz`: la voz narrada + los efectos + la música incidental a 0,08 debajo (si hay).
    - `ambos`: la voz + los efectos + la música a volumen real (0,25).
    - `musica`: solo la canción + los efectos (los whoosh e impactos marcan los cortes igual).
    """
    audio_master = revision / "audio_master.wav"
    cues = cues_de(escenas_t)
    musica = pista if pista else next((PROYECTO / p for p in PISTAS if (PROYECTO / p).exists()), None)
    if sonido == "musica" and not musica:
        sys.exit('✗ sonido "musica": falta la canción en public/musica.mp3 (o musica.mp3/.wav).')

    # Entrada 0 = lo que manda la duración (la voz, o la canción en modo música); luego la música de
    # fondo si aplica y cada efecto como una entrada con su delay. amix duration=first: manda la primera.
    entradas: list[Path] = []
    if sonido != "musica":
        entradas.append(voz)
    if musica:
        entradas.append(musica)
    entradas += [SKILL / "sfx" / f"{s}.wav" for _, s, _ in cues]

    # Sin música ni efectos posibles (no debería pasar: siempre hay whoosh), la voz sola se masteriza.
    if not cues and (not musica or sonido == "musica"):
        subprocess.run(["node", str(BASE / "masterizar.mjs"), str(entradas[0]), str(audio_master)],
                       check=True)
        return audio_master

    partes, mix = [], []
    idx = 0
    if sonido != "musica":
        partes.append(f"[{idx}:a]aformat=channel_layouts=stereo,aresample=48000[voz]")
        mix.append("[voz]")
        idx += 1
    if musica:
        vol = "1.0" if sonido == "musica" else ("0.08" if sonido == "voz" else "0.25")
        partes.append(f"[{idx}:a]volume={vol},aformat=channel_layouts=stereo,aresample=48000[mus]")
        mix.append("[mus]")
        idx += 1
    for k, (t, s, g) in enumerate(cues):
        partes.append(f"[{idx}:a]aformat=channel_layouts=stereo,"
                      f"adelay={int(round(t * 1000))}|{int(round(t * 1000))},volume={g}[s{k}]")
        mix.append(f"[s{k}]")
        idx += 1
    partes.append("".join(mix) + f"amix=inputs={len(mix)}:duration=first:normalize=0[aout]")
    mezcla = revision / "mezcla.wav"
    ffmpeg(*sum((["-i", str(p)] for p in entradas), []),
           "-filter_complex", ";".join(partes), "-map", "[aout]", str(mezcla))
    subprocess.run(["node", str(BASE / "masterizar.mjs"), str(mezcla), str(audio_master)], check=True)
    return audio_master


def pistas(voz: Path | None, pista: Path | None, escenas_t: list[dict], total: float,
           sonido: str) -> dict | None:
    """
    Las pistas del sonido para el monitor en vivo y la línea de tiempo (`sonido` de edicion.json): la voz,
    la música y cada efecto en su golpe, cada fuente en `public/sonido/` por `pistas.py` de video-base, con
    los mismos tiempos y volúmenes que la mezcla ffmpeg de `audio()`. El video final no las usa —su audio es
    `public/sonido.wav`—: los `<Audio>` solo viven en el Player del monitor.
    """
    total_f = round(total * FPS)
    out: dict = {}
    if sonido != "musica" and voz:
        rel = a_public(voz, "voz", PROYECTO)
        n = round(duracion_wav(PROYECTO / "public" / rel) * FPS)
        out["voz"] = {"src": rel, "desde": 0, "hasta": min(total_f, n), "volumen": 1.0}
    musica = pista if pista else next((PROYECTO / p for p in PISTAS if (PROYECTO / p).exists()), None)
    if musica:
        rel = a_public(musica, "musica", PROYECTO)
        n = round(duracion_wav(PROYECTO / "public" / rel) * FPS)
        vol = 1.0 if sonido == "musica" else (0.08 if sonido == "voz" else 0.25)
        out["musica"] = {"src": rel, "desde": 0, "hasta": min(total_f, n), "volumen": vol}
    sfx = []
    for t, s, g in cues_de(escenas_t):
        src = SKILL / "sfx" / f"{s}.wav"
        rel = a_public(src, s, PROYECTO)
        n = round(duracion_wav(PROYECTO / "public" / rel) * FPS)
        desde = max(0, round(t * FPS))
        sfx.append({"src": rel, "desde": desde, "hasta": min(total_f, desde + max(1, n)), "volumen": g})
    if sfx:
        out["sfx"] = sfx
    return out or None


def tiempos_de_t(escenas: list[dict], total: float) -> list[dict]:
    """
    Los segundos de cada escena en modo `musica`: la escena entra en su `t` y dura hasta la `t` de la
    siguiente o el final de la canción. Sale con `t0`/`t1` puestos (los `t` van en orden, ya validado).
    """
    salida = []
    for k, e in enumerate(escenas):
        t0 = min(max(float(e["t"]), 0.0), total)
        salida.append({**e, "t0": t0})
    for k, e in enumerate(salida):
        e["t1"] = salida[k + 1]["t0"] if k + 1 < len(salida) else total
        if e["t1"] - e["t0"] < 0.3:
            e["t1"] = e["t0"] + 0.3
    return salida


def main() -> None:
    formato = formato_arg or "vertical"
    if formato not in FORMATOS:
        sys.exit('--formato es "vertical" u "horizontal".')
    # Los valores de las opciones no son argumentos sueltos: un nombre de más es un error del que llama.
    sueltos = {v for v in (_en, formato_arg, nombre_arg) if v}
    if [a for a in _args if not a.startswith("--") and a not in sueltos]:
        sys.exit(__doc__)
    revisa = "--revisa" in _args

    marca, errores_marca = leer_marca()
    datos, errores = leer_publicidad(marca)
    if datos.get("formato") and not formato_arg:
        formato = datos["formato"]
    errores += errores_marca
    if errores:
        sys.exit("✗ publicidad.json:\n  " + "\n  ".join(errores))
    for f in ("guion.md", "publicidad.json"):
        if not (PROYECTO / f).exists():
            sys.exit(f"✗ Falta {f} en la raíz del proyecto.")
    for f in ("guion.md", "publicidad.json"):
        if malo := roto((PROYECTO / f).read_text(encoding="utf-8")):
            sys.exit(f"✗ {f} tiene la codificación rota («{malo}»): UTF-8 leído como latin-1; reescríbelo en UTF-8.")
    escenas = [e for e in (datos.get("escenas") or []) if isinstance(e, dict)]
    sonido = datos.get("sonido", "voz")
    # En modo música no hay voz que anclar: los `t` mandan (ya validados en orden). Con voz, cada escena se
    # ubica en la palabra del guion que la narración dice.
    if sonido != "musica" and (malos := anclar(escenas, palabras_de(texto_guion(PROYECTO)), "el guion")[1]):
        sys.exit("✗ publicidad.json:\n  " + "\n  ".join(malos))
    if revisa:
        print("✓ publicidad.json bien: ya puedes lanzar hacer.py de fondo")
        return

    ancho, alto = FORMATOS[formato]
    reloj = Reloj(PROYECTO)
    revision = PROYECTO / "revision"
    revision.mkdir(exist_ok=True)
    out_dir = PROYECTO / "out"
    out_dir.mkdir(exist_ok=True)

    # 1-3. El audio que manda y los tiempos de las escenas
    voz = pista = None
    if sonido == "musica":
        reloj.paso("música…")
        pista = next((PROYECTO / p for p in PISTAS if (PROYECTO / p).exists()), None)
        if not pista:
            sys.exit('✗ sonido "musica": falta la canción en public/musica.mp3 (o musica.mp3/.wav).')
        total = duracion(pista)
        reloj.nota("musica", f"{total:.1f} s")
        for k, e in enumerate(escenas):
            if float(e["t"]) >= total:
                sys.exit(f"✗ escena {k + 1}: `t` {e['t']} pasa del final de la música ({total:.1f} s)")
        reloj.paso("escenas…")
        escenas_t = tiempos_de_t(escenas, total)
        segmentos = []
    else:
        # 1. La voz
        reloj.paso("voz…")
        # La voz vive en fuentes/voz/ (VOZ.md: ahí la deja generar_voz), como en el top y el documental;
        # public/voz.wav y voz.wav son las rutas viejas que aún se aceptan. Si hay varias, la más reciente.
        carpeta_voz = PROYECTO / "fuentes" / "voz"
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
        escenas_t = tiempos_de_escenas(escenas, segmentos, total, de="publicidad.json")

    # 4. El material de cada escena (una vez por URL; la licencia queda en FUENTES.md). El cierre no lleva.
    reloj.paso("material…")
    mat_dir = PROYECTO / "fuentes" / "material"
    mat_dir.mkdir(parents=True, exist_ok=True)
    registro: dict = {}
    try:
        archivos = [traer_items(PROYECTO, e.get("material") or [], k, mat_dir, registro)
                    if e.get("tipo") != "cierre" else [] for k, e in enumerate(escenas_t)]
    except Falla as f:
        sys.exit(f"✗ {f}")
    fuentes_md(PROYECTO, registro)

    # 5. El audio: la voz con su música (o solo la canción), masterizado. Es el sonido de la edición
    # (public/sonido.wav): Remotion lo lleva en el monitor en vivo y el mux lo pone en el mp4 final.
    reloj.paso("audio…")
    audio_master = audio(voz, pista, escenas_t, revision, sonido)
    sonido_wav = PROYECTO / "public" / "sonido.wav"
    if sonido_wav.exists():
        sonido_wav.unlink()
    try:
        os.link(audio_master, sonido_wav)
    except OSError:
        shutil.copy2(audio_master, sonido_wav)

    # La piel del estilo: el proyecto lleva su copia de assets/ en public/assets/pub/ (la puso nuevo.py);
    # se refresca desde la skill por si mejoró después — si no, la edición sale con piezas viejas, sin las
    # nuevas o con fuentes que ya no están (@font-face caería al fallback).
    for nombre in ("tokens.css",):
        src, dst = SKILL / "assets" / nombre, PROYECTO / "public" / "assets" / "pub" / nombre
        if src.exists() and (not dst.exists() or dst.read_bytes() != src.read_bytes()):
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    fuentes_src = SKILL / "assets" / "fonts"
    fuentes_dst = PROYECTO / "public" / "assets" / "pub" / "fonts"
    if fuentes_src.is_dir():
        fuentes_dst.mkdir(parents=True, exist_ok=True)
        for f in fuentes_src.iterdir():
            if f.is_file() and (not (fuentes_dst / f.name).exists()
                                or (fuentes_dst / f.name).read_bytes() != f.read_bytes()):
                shutil.copy2(f, fuentes_dst / f.name)

    # 6. La edición: el director pone cada tramo de material (foto con paneo, clip con su velocidad), los
    # textos del anuncio que entran en cada corte, la tarjeta de marca del cierre con sus entradas
    # escalonadas, las escenas y —con voz— los subtítulos karaoke (capas dentro del video, con los tiempos
    # de palabra de la misma transcripción, cortados donde empieza la tarjeta de marca) en
    # src/edicion.json. Sin .ass ni post-pase de ffmpeg: out/ queda solo con el mp4 final.
    reloj.paso("edición…")
    subs = None
    if sonido != "musica":
        palabras = palabras_tiempo(segmentos, 0.0)
        # El karaoke llega hasta donde empieza la tarjeta de marca: sobre ella caería encima del logo y el CTA.
        if escenas_t and escenas_t[-1].get("tipo") == "cierre" and escenas_t[-1].get("t0"):
            palabras = [p for p in palabras if p[0] < escenas_t[-1]["t0"]]
        subs = grupos_de_lineas(palabras, ESTILOS_SUB["top"], ancho, alto)
    director.armar(escenas_t, archivos, PROYECTO, ancho, alto, total, marca=marca,
                   audio="sonido.wav", subs=subs, sonido=pistas(voz, pista, escenas_t, total, sonido))

    # 7. El render de Remotion, sin audio como en el top y el documental: los cuadros de cada clip van ya
    # sacados a imágenes (cuadros_render.cjs, --antes), que es varias veces más rápido que OffthreadVideo
    # cuadro a cuadro. El sonido (`public/sonido.wav`) entra por ffmpeg, no por el `<Audio>` del render —que
    # queda solo para el monitor en vivo—: el mux es el video final y out/ queda solo con él.
    reloj.paso("render…")
    nombre = nombre_arg or re.sub(r"^publicidad-", "", PROYECTO.name)
    sin_sonido = out_dir / f"_publicidad-{nombre}-video.mp4"
    final = out_dir / f"publicidad-{nombre}.mp4"
    subprocess.run(["node", str(BASE / "render.cjs"), str(sin_sonido), "--id=Publicidad", "--muted",
                    "--concurrency=66%", "--crf=18", "--x264-preset=veryfast",
                    "--pixel-format=yuv420p", "--color-space=bt709",
                    f"--antes={SKILL / 'scripts' / 'cuadros_render.cjs'}",
                    '--props={"cuadros":true}'], cwd=PROYECTO, check=True)
    ffmpeg("-i", str(sin_sonido), "-i", str(sonido_wav), "-map", "0:v", "-map", "1:a",
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
    # La voz vive solo en fuentes/voz/ (como en el top y el documental): si se usó una copia vieja de
    # public/ o de la raíz, se muda ahí; si ya estaba en fuentes/voz/, las copias son duplicados y se borran.
    if sonido != "musica":
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
    # El proyecto entregado queda limpio: las mezclas ya son el video final (se regeneran en cada corrida),
    # las huellas de dedup ya sirvieron y portada.jpg es el crudo cuando ya está portada.png. Los patrones de
    # los tramos del pipeline viejo también se barren por si el proyecto venía de antes. node_modules es un
    # enlace compartido: no se cruza.
    for patron in ("seg-*.mp4", "visual.mp4", "mezcla.wav", "audio_master.wav", "concat.txt"):
        for f in revision.glob(patron):
            f.unlink(missing_ok=True)
    for carpeta_txt in ("txt", "cierre-txt"):
        if (revision / carpeta_txt).is_dir():
            shutil.rmtree(revision / carpeta_txt)
    for archivo_huella in PROYECTO.rglob("*.huella"):
        if "node_modules" not in archivo_huella.parts:
            archivo_huella.unlink(missing_ok=True)
    if (PROYECTO / "portada.png").exists():
        (PROYECTO / "portada.jpg").unlink(missing_ok=True)
    reloj.listo(final, [hoja_png])


if __name__ == "__main__":
    main()
