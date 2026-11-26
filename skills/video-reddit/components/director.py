"""director.py — Montaje declarativo de video-reddit para Remotion.

Arma la edición completa:
1. Video de fondo inmersivo continuo (con viñeta de contraste).
2. Tarjeta vectorial nativa de Reddit durante los primeros 3 segundos (animada con GSAP + sonido pop).
3. Subtítulos palabra por palabra en Varela Round con acento naranja (#FF4500).
4. Emisión de `src/edicion.json` para el render de Remotion.
"""
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SKILL = AQUI.parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(SKILL.parent / "video-base" / "scripts"))
from comp import Comp, esc, fr  # noqa: E402
from subtitulos import linea  # noqa: E402

# Iconos SVG nativos de la interfaz de Reddit
SNOO_SVG = (
    '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">'
    '<circle cx="10" cy="10" r="10" fill="#FF4500"/>'
    '<path d="M16.67 10a1.46 1.46 0 0 0-2.47-1.05 6.36 6.36 0 0 0-3.86-1.22l.66-3.1 2.15.46a1.03 1.03 0 1 0 .21-.69l-2.45-.52a.25.25 0 0 0-.29.19l-.75 3.54a6.43 6.43 0 0 0-3.92 1.22 1.46 1.46 0 1 0-1.84 2.37 3 3 0 0 0 0 .8A4.44 4.44 0 0 0 8 13.92a6.83 6.83 0 0 0 4 0 4.44 4.44 0 0 0 3.89-1.92 3 3 0 0 0 0-.8 1.45 1.45 0 0 0 .78-1.2zM7.17 11a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.72 2.31a3.42 3.42 0 0 1-2.89.5 3.42 3.42 0 0 1-2.89-.5.21.21 0 0 1 .15-.36 3.73 3.73 0 0 0 2.74.45 3.73 3.73 0 0 0 2.74-.45.21.21 0 0 1 .15.36zm-.06-1.31a1 1 0 1 1 1-1 1 1 0 0 1-1 1z" fill="#FFF"/>'
    '</svg>'
)

UPVOTE_SVG = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
    '<polyline points="18 15 12 9 6 15"></polyline>'
    '</svg>'
)

DOWNVOTE_SVG = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
    '<polyline points="6 9 12 15 18 9"></polyline>'
    '</svg>'
)

COMMENT_SVG = (
    '<svg viewBox="0 0 24 24" fill="currentColor">'
    '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>'
    '</svg>'
)

SHARE_SVG = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
    'stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M7 17 17 7M9 7h8v8"/>'
    '</svg>'
)

SAVE_SVG = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
    'stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'
    '</svg>'
)

BADGE_SVG = (
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    '<circle cx="12" cy="12" r="10" fill="#0079d3"/>'
    '<path d="M8 12.4l2.6 2.6L16.5 9.5" fill="none" stroke="#fff" stroke-width="2.2" '
    'stroke-linecap="round" stroke-linejoin="round"/>'
    '</svg>'
)


def tarjeta_reddit(c: Comp, post: dict, ancho: int, alto: int, t_salida: float = 3.0, z: int = 50):
    """
    Construye la tarjeta nativa de Reddit en Remotion y su animación con GSAP.
    Aparece en t=0 con pop/slam y se desvanece suavemente a los t_salida segundos.
    Todos los tamaños escalan con --rcs = min(ancho/1080, alto/1920) (ver tokens.css).
    """
    cid = c.uid("card_wrap")
    card_id = c.uid("card")

    sub = esc(post.get("subreddit") or "r/AskReddit")
    if not sub.startswith("r/"):
        sub = f"r/{sub}"
    autor = esc(post.get("autor") or "u/RedditStory")
    if not autor.startswith("u/"):
        autor = f"u/{autor}"
    tiempo = esc(post.get("tiempo") or "hace 4 h")
    titulo = esc(post.get("titulo") or "¿Cuál es tu historia?")
    votos = esc(post.get("votos") or "14.2k")
    comentarios = esc(post.get("comentarios") or "1.8k")

    vertical = alto > ancho
    pos_top = "20%" if vertical else "14%"
    escala = min(ancho / 1080.0, alto / 1920.0)
    claro = str(post.get("tema") or "").lower() == "claro"
    verificado = bool(post.get("verificado"))
    badge = f'<span class="reddit-card-badge">{BADGE_SVG}</span>' if verificado else ""

    inner = (
        f'<div id="{cid}" class="reddit-card-wrap" style="top:{pos_top};--rcs:{escala:.4f}">'
        f'  <div id="{card_id}" class="reddit-card{" claro" if claro else ""}">'
        f'    <div class="reddit-card-header">'
        f'      <div class="reddit-card-icon">{SNOO_SVG}</div>'
        f'      <div class="reddit-card-meta">'
        f'        <div class="reddit-card-sub">{sub}</div>'
        f'        <div class="reddit-card-author">{autor} • {tiempo}{badge}</div>'
        f'      </div>'
        f'    </div>'
        f'    <div class="reddit-card-title">{titulo}</div>'
        f'    <div class="reddit-card-footer">'
        f'      <div class="reddit-card-pill upvote">'
        f'        {UPVOTE_SVG}'
        f'        <span>{votos}</span>'
        f'        {DOWNVOTE_SVG}'
        f'      </div>'
        f'      <div class="reddit-card-pill">'
        f'        {COMMENT_SVG}'
        f'        <span>{comentarios}</span>'
        f'      </div>'
        f'      <div class="reddit-card-pill icon">{SHARE_SVG}</div>'
        f'      <div class="reddit-card-pill icon">{SAVE_SVG}</div>'
        f'    </div>'
        f'  </div>'
        f'</div>'
    )

    c.clip(0.0, t_salida + 0.5, inner, z=z, pieza="tarjeta")

    # Animación GSAP: Entrada rápida con pop/overshoot suave a t=0
    c.at(f'tl.fromTo("#{card_id}",{{scale:1.14,opacity:0}},'
         f'{{scale:1.0,opacity:1.0,duration:0.35,ease:"back.out(1.2)",immediateRender:false}},0.0);')

    # Salida: Desvanecimiento suave antes de desaparecer
    c.at(f'tl.to("#{card_id}",'
         f'{{opacity:0,scale:0.95,duration:0.38,ease:"power2.in"}},{t_salida - 0.38:.4f});')


def fondo_continuo(c: Comp, src: str, duracion_total: float, duracion_clip: float):
    """
    Video de fondo continuo. Si el clip es más corto que el relato se repite, pero cada vuelta
    se monta con un fundido cruzado de XF segundos y una deriva de escala alternada (zoom in /
    zoom out), así el reinicio del clip no se ve como un corte.
    """
    XF = 0.4
    dur_clip = max(duracion_clip, 2.0)
    salto = dur_clip - XF
    if salto <= 0.2:
        # El clip dura casi lo mismo que el tramo: no hace falta fundido, un solo tramo.
        c.video(0.0, duracion_total, src, media_start_s=0.0, z=1, velocidad=1.0, pieza="fondo")
    else:
        vids = []
        i = 0
        while True:
            t0 = i * salto
            if t0 >= duracion_total:
                break
            t1 = min(t0 + dur_clip, duracion_total)
            vid = c.video(t0, t1, src, media_start_s=0.0, z=1, velocidad=1.0, pieza="fondo")
            vids.append((vid, t0, t1))
            i += 1
            if t1 >= duracion_total:
                break

        # Fundido cruzado entre vueltas y deriva alternada (in/out) para que el bucle no se note.
        f_xf = fr(XF)
        for k, (vid, t0, t1) in enumerate(vids):
            dur = t1 - t0
            if k > 0:
                c.at(f'tl.fromTo("#{vid}",{{opacity:0}},{{opacity:1,duration:{f_xf:.4f},'
                     f'ease:"power1.inOut",immediateRender:false}},{fr(t0):.4f});')
                prev = vids[k - 1][0]
                c.at(f'tl.to("#{prev}",{{opacity:0,duration:{f_xf:.4f},'
                     f'ease:"power1.inOut"}},{fr(t0):.4f});')
            # Deriva lenta: una vuelta entra a escala 1.06→1.0, la siguiente 1.0→1.06, y así.
            if dur > XF + 0.5:
                entra, sale = (1.0, 1.06) if k % 2 else (1.06, 1.0)
                c.at(f'tl.fromTo("#{vid}",{{scale:{entra:.3f}}},'
                     f'{{scale:{sale:.3f},duration:{fr(dur):.4f},ease:"none",immediateRender:false}},'
                     f'{fr(t0):.4f});')

    # Viñeta suave sobre el video para garantizar contraste perfecto
    vid = c.uid("vignette")
    c.clip(0.0, duracion_total, f'<div id="{vid}" class="reddit-vignette"></div>', z=5, pieza="vignette")


def subtitulos(c: Comp, lineas: list, W: int, H: int, t_tarjeta: float = 3.0, z: int = 80):
    """
    Subtítulos dinámicos palabra por palabra (karaoke) en Varela Round.
    Durante los primeros t_tarjeta segundos van abajo (para dar espacio a la tarjeta);
    después suben al centro de la pantalla con gran tamaño e impacto.
    """
    if not lineas:
        return
    vertical = H > W
    # Tamaño por el lado menor: la misma letra se lee igual en 1080×1920 y en 1920×1080.
    letra_normal = round(min(W, H) * 0.072)
    contorno = max(round(letra_normal * 0.12), 2)

    for g in lineas:
        palabras = [(ini, fin, texto) for ini, fin, texto in g if texto.strip()]
        if not palabras or palabras[-1][1] - palabras[0][0] < 1.0 / c.fps:
            continue
        t0, t1 = palabras[0][0], palabras[-1][1]

        # Posicionamiento: Abajo mientras esté la tarjeta, al centro después
        durante_tarjeta = t0 < t_tarjeta
        if durante_tarjeta:
            pos_style = f"bottom:{round(H * 0.20)}px;font-size:{letra_normal}px;"
        else:
            pos_style = f"top:50%;transform:translateY(-50%);font-size:{round(letra_normal * 1.08)}px;"

        partes = []
        for ini, fin, texto in palabras:
            w = linea(texto)
            if not w:
                continue
            wid = c.uid("w")
            partes.append(f'<span class="w" id="{wid}">{esc(w.upper())}</span>')
            c.at(f'tl.set("#{wid}",{{className:"w on"}},{fr(ini):.4f});')
            c.at(f'tl.set("#{wid}",{{className:"w"}},{fr(fin):.4f});')

        if not partes:
            continue

        inner = (
            f'<div class="reddit-karaoke" style="{pos_style}--reddit-contorno:{contorno}px">'
            f'{" ".join(partes)}'
            f'</div>'
        )
        c.clip(t0, t1, inner, z=z, pieza="subtitulos")


def armar(post: dict, fondo_src: str, fondo_dur: float, proyecto: Path,
          ancho: int, alto: int, total: float, audio: str = "sonido.wav",
          subs: list = None, t_tarjeta: float = 3.0, sonido: dict = None):
    """
    Ensambla la composición completa de video-reddit y escribe src/edicion.json.
    """
    c = Comp(total, ancho, alto, cid="reddit")
    c.escena("Arranque y Tarjeta", 0.0, min(total, t_tarjeta))
    if total > t_tarjeta:
        c.escena("Relato", t_tarjeta, total)

    # 1. Fondo continuo
    fondo_continuo(c, fondo_src, total, fondo_dur)

    # 2. Tarjeta interactiva de Reddit
    tarjeta_reddit(c, post, ancho, alto, t_salida=t_tarjeta)

    # 3. Subtítulos dinámicos
    if subs:
        subtitulos(c, subs, ancho, alto, t_tarjeta=t_tarjeta)

    tokens_path = proyecto / "public" / "assets" / "reddit" / "tokens.css"
    if not tokens_path.exists():
        tokens_path = SKILL / "assets" / "tokens.css"

    c.write(
        path=str(proyecto / "src" / "edicion.json"),
        tokens=str(tokens_path),
        audio=audio,
        title=post.get("titulo") or "Reddit Story",
        sonido=sonido,
    )

