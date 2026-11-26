"""
El video de «Política sin filtro», del proyecto a `out/politica-<nombre>.mp4`, con el contrato del motor
(`../video-base/MOTOR.md`):

    python -I -B -X utf8 <skill>/scripts/hacer.py [--en <carpeta>] [--revisa] [--formato vertical|horizontal] [--nombre <n>]

`--en <carpeta>` es la ruta completa de la línea `Carpeta:` de Hermit; sin ella, el directorio actual.

Lo que el agente deja en el proyecto:
- `fuentes/caso.md`: los hechos, cifras oficiales y citas que respaldan el análisis.
- `guion.md`: la narración en los 5 bloques del formato (las líneas en negrita son textos en pantalla, no narración).
- `fuentes/voz/*.wav` (VOZ.md de video-base: ahí la deja `generar_voz`; `public/voz.wav` o `voz.wav` valen como
  rutas viejas), ya masterizada a -14 LUFS, y `public/musica.mp3`
  (o `musica.mp3`, `public/musica.wav`) opcional: la música incidental de tensión a bajo volumen.
- `montaje.json`: el montaje declarativo — cada escena con la `palabra` del guion donde entra, su `imagen`
  (una foto: la ruta de un archivo del proyecto — lo que subió el usuario o se generó — o una referencia con
  licencia que `bancos.py` baja a `fuentes/material/`: `commons:File:…`, `nasa:…` o la URL de la imagen) y su
  `titular` opcional (el banner de alerta arriba, hasta 90 caracteres). Se bajan una vez y su licencia queda en
  `FUENTES.md`. Una persona real identificable nunca se genera con IA: se busca su foto con licencia.
- `portada.png` (opcional en vertical: la pone de primer fotograma).

`--revisa` valida todo en un segundo y sin red ni voz: la forma de `montaje.json`, que cada `palabra` exista
en el guion y vaya en orden, y que cada `imagen` local exista o sea una referencia de foto bien formada. El
resto — voz, material, la edición de Remotion (el director pone cada imagen con su paneo Ken Burns y sus
fundidos, el titular de alerta, los subtítulos de impacto con la cifra en amarillo y la alarma en rojo, los
efectos del noticiero y la música con ducking), portada y hoja — se cronometra en `revision/tiempos.json`.
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
from bancos import Falla, es_local, fuentes_md, traer_items  # noqa: E402
from hermit import duracion, transcribir  # noqa: E402
from momentos import Reloj, anclar, errores_mojibake, hoja, palabras_de, roto, texto_guion, tiempos_de_escenas  # noqa: E402
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


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args], check=True)


def leer_montaje() -> tuple[dict, list[str]]:
    """montaje.json de la raíz; devuelve (datos, errores de forma)."""
    archivo = PROYECTO / "montaje.json"
    if not archivo.exists():
        return {}, ["falta montaje.json en la raíz del proyecto"]
    try:
        datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        return {}, [f"montaje.json no es JSON: {e}"]
    if not isinstance(datos, dict):
        return {}, ["montaje.json no es un objeto: lleva `formato` y `escenas`"]
    errores = errores_mojibake(datos)
    formato = datos.get("formato", "vertical")
    if formato not in FORMATOS:
        errores.append(f'formato «{formato}»: va "vertical" u "horizontal"')
    escenas = datos.get("escenas")
    if not isinstance(escenas, list) or not escenas:
        errores.append("no tiene escenas: una lista `escenas`, cada una con `palabra` e `imagen`")
        escenas = []
    for k, e in enumerate(escenas):
        que = f"escena {k + 1}"
        if not isinstance(e, dict):
            errores.append(f"{que}: no es un objeto")
            continue
        if not str(e.get("palabra", "")).strip():
            errores.append(f"{que}: falta `palabra`, las palabras del guion donde entra")
        imagen = str(e.get("imagen", "")).strip()
        if not imagen:
            errores.append(f"{que}: falta `imagen`, el archivo que se ve (por ejemplo fuentes/material/01.jpg)")
        elif es_local(imagen):
            if not (PROYECTO / imagen).is_file():
                errores.append(f"{que}: no está el archivo {imagen} (relativo a la raíz del proyecto)")
        elif not imagen.startswith(("commons:", "nasa:", "http")):
            # Una foto de banco o una URL; los videos (mixkit:, archive:, yt:) no entran por `imagen`.
            errores.append(f"{que}: «{imagen}» no es una foto con licencia: una ruta del proyecto, "
                           "`commons:File:…`, `nasa:…` o la URL de la imagen")
        t = e.get("titular")
        if t is not None and (not isinstance(t, str) or len(t) > 90):
            errores.append(f"{que}: `titular` es un texto de hasta 90 caracteres o se quita")
    return datos, errores


SFX = SKILL / "sfx"


def cues_de(escenas: list[dict]) -> list[tuple[float, object, float]]:
    """Los efectos del noticiero, en (segundo, sonido, ganancia), secos como el formato: `subboom_1` +
    `riser_1` al abrir, `click_N` en cada escena con `titular` (rotando las tres muestras), `swish_1` en
    cada entrada y `impact_1` en el cierre. Los usan la mezcla ffmpeg de `audio()` y las pistas del
    monitor de `pistas()`: los mismos tiempos en los dos."""
    cues: list[tuple[float, object, float]] = [(0.0, "subboom_1", 0.09), (0.0, "riser_1", 0.045)]
    n_tit = 0
    for k, e in enumerate(escenas):
        t0, t1 = e["t0"], e["t1"]
        cues.append((t0, "swish_1", 0.05))
        if str(e.get("titular") or "").strip():
            n_tit += 1
            cues.append((t0, f"click_{(n_tit - 1) % 3 + 1}", 0.09))
    if escenas:
        cues.append((escenas[-1]["t0"], "impact_1", 0.055))
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
    La voz con la cama de efectos del noticiero y la música incidental, masterizada a -14 LUFS
    (`public/musica.mp3`, `musica.mp3` o `public/musica.wav`, a bajo volumen con ducking bajo la voz y
    fundidos). Los cues son (tiempo, sonido, ganancia), secos como el formato:

    - `subboom_1` + `riser_1` al abrir — el golpe grave y la subida que ponen la tensión del análisis.
    - `click_N` al entrar cada escena con `titular` — el golpe seco del titular que se estampa, rotando las
      tres muestras.
    - `swish_1` al entrar cada escena — el barrido de la transición editorial (la imagen se funde).
    - `impact_1` al entrar la última escena — el golpe del cierre polarizante.
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

    for f in ("fuentes/caso.md", "guion.md", "montaje.json"):
        if not (PROYECTO / f).exists():
            sys.exit(f"✗ Falta {f} en la raíz del proyecto.")
    for f in ("fuentes/caso.md", "guion.md", "montaje.json"):
        if malo := roto((PROYECTO / f).read_text(encoding="utf-8")):
            sys.exit(f"✗ {f} tiene la codificación rota («{malo}»): UTF-8 leído como latin-1; reescríbelo en UTF-8.")

    datos, errores = leer_montaje()
    if datos.get("formato") and not formato_arg:
        formato = datos["formato"]
    if errores:
        sys.exit("✗ montaje.json:\n  " + "\n  ".join(errores))
    escenas = [e for e in (datos.get("escenas") or []) if isinstance(e, dict)]
    if malos := anclar(escenas, palabras_de(texto_guion(PROYECTO)), "el guion")[1]:
        sys.exit("✗ montaje.json:\n  " + "\n  ".join(malos))
    if revisa:
        print("✓ montaje.json bien: ya puedes lanzar hacer.py de fondo")
        return

    ancho, alto = FORMATOS[formato]
    reloj = Reloj(PROYECTO)
    revision = PROYECTO / "revision"
    revision.mkdir(exist_ok=True)
    out_dir = PROYECTO / "out"
    out_dir.mkdir(exist_ok=True)

    # 1. La voz
    reloj.paso("voz…")
    # La voz vive en fuentes/voz/ (VOZ.md de video-base: ahí la deja generar_voz), como en los demás estilos;
    # public/voz.wav y voz.wav son las rutas viejas que aún se aceptan. Si hay varias, la más reciente es la que
    # se produjo última.
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

    # 3. Las imágenes: las rutas del proyecto tal cual; las referencias de banco o URL se bajan
    #    una vez a fuentes/material/ y su licencia queda en FUENTES.md (MATERIAL.md de video-base).
    reloj.paso("material…")
    mat_dir = PROYECTO / "fuentes" / "material"
    mat_dir.mkdir(parents=True, exist_ok=True)
    registro: dict = {}
    try:
        for k, e in enumerate(escenas):
            e["imagen"] = str(traer_items(PROYECTO, [{"foto": e["imagen"]}], k, mat_dir, registro)[0].relative_to(PROYECTO))
    except Falla as f:
        sys.exit(f"✗ {f}")
    fuentes_md(PROYECTO, registro)

    # 4. Las escenas en la voz: en qué segundo entra cada imagen
    reloj.paso("escenas…")
    escenas_t = tiempos_de_escenas(escenas, segmentos, total, de="montaje.json")

    # 5. El audio: voz + los efectos del noticiero + la música incidental con ducking, masterizado a -14 LUFS.
    # Es el sonido de la edición (public/sonido.wav): Remotion lo lleva en el render y el monitor en vivo lo oye.
    reloj.paso("audio…")
    audio_master = audio(voz, escenas_t, total, revision)
    sonido = PROYECTO / "public" / "sonido.wav"
    if sonido.exists():
        sonido.unlink()
    try:
        os.link(audio_master, sonido)
    except OSError:
        shutil.copy2(audio_master, sonido)

    # 6. La edición: el director pone cada imagen con su paneo y sus fundidos, el titular de alerta, los
    # subtítulos de impacto con la cifra en amarillo y la alarma en rojo — capas dentro del video, con los
    # tiempos de la misma transcripción—, en src/edicion.json. Sin .ass ni post-pase de ffmpeg: out/ queda
    # solo con el mp4 final.
    reloj.paso("edición…")
    director.armar(escenas_t, PROYECTO, ancho, alto, total, audio="sonido.wav", segmentos=segmentos,
                   sonido=pistas(voz, escenas_t, total))

    # 7. El render de Remotion, sin audio como en los demás estilos: los cuadros de cada clip van ya sacados a
    # imágenes (cuadros_render.cjs, --antes), que es varias veces más rápido que OffthreadVideo cuadro a cuadro.
    # La voz y los efectos (`public/sonido.wav`) entran por ffmpeg, no por el `<Audio>` del render: la mezcla de
    # audio de Remotion es la pieza frágil y el `<Audio>` de la plantilla queda solo para el monitor en vivo.
    # Los subtítulos ya van dentro de la composición (capas del director), así que el mux es el video final:
    # out/ queda solo con él.
    reloj.paso("render…")
    nombre = nombre_arg or re.sub(r"^politica-", "", PROYECTO.name)
    sin_sonido = out_dir / f"_politica-{nombre}-video.mp4"
    final = out_dir / f"politica-{nombre}.mp4"
    subprocess.run(["node", str(BASE / "render.cjs"), str(sin_sonido), "--id=Politica", "--muted",
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
    # La voz vive solo en fuentes/voz/ (como en los demás estilos): si se usó una copia vieja de public/ o de la
    # raíz, se muda ahí; si ya estaba en fuentes/voz/, las copias de public/ y de la raíz son duplicados y se borran.
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
