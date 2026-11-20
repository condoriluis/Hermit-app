"""
Detección de caras en un video, por muestras: el primer paso del reencuadre inteligente de `video-clips`
(seguir al que habla en vez del recorte fijo). No renderiza nada: mide y enseña.

    python -B detectar.py <video.mp4> [--desde S] [--hasta S] [--fps 3] [--conf 0.6] [--lado 640] [--hoja salida.png]

Por cada muestra (cada 1/`--fps` segundos) deja en `<video>.caras.json`, junto al video:
    {"fps_muestra": 3, "ancho": 1920, "alto": 1080, "muestras": [{"t": 1.33, "caras": [{"x","y","w","h","score"}]}]}
`--hoja` dibuja una rejilla de muestras con las cajas y el segundo, para mirarlas de un vistazo (la que se
aprueba antes de gastar el render, como las hojas de `momentos.py`).

El modelo es YuNet (`assets/models/face_detection_yunet.onnx`, licencia MIT de OpenCV Zoo): corre sobre
OpenCV, CPU, sin GPU ni red. Solo sirve con el Python de Hermit (lleva opencv-python-headless).
"""

import argparse
import json
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
MODELO = Path(__file__).resolve().parents[1] / "assets" / "models" / "face_detection_yunet.onnx"


def hoja(video: Path, muestras: list, salida: Path, ancho: int, alto: int) -> None:
    """Una rejilla de muestras con sus cajas: lo que el detector vio, para aprobarlo antes de renderizar."""
    import cv2

    cap = cv2.VideoCapture(str(video))
    elegidas = muestras[:: max(1, len(muestras) // 12)][:12]
    celdas = []
    for m in elegidas:
        cap.set(cv2.CAP_PROP_POS_MSEC, m["t"] * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        f = cv2.resize(frame, (320, round(320 * alto / ancho)))
        for c in m["caras"]:
            k = f.shape[1] / ancho
            cv2.rectangle(f, (round(c["x"] * k), round(c["y"] * k)),
                          (round((c["x"] + c["w"]) * k), round((c["y"] + c["h"]) * k)), (0, 200, 0), 2)
        cv2.rectangle(f, (0, 0), (f.shape[1], 18), (0, 0, 0), -1)
        cv2.putText(f, f"{m['t']:.1f}s · {len(m['caras'])} cara(s)", (4, 13),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        celdas.append(f)
    cap.release()
    if not celdas:
        return
    filas = [cv2.hconcat(celdas[i:i + 4]) for i in range(0, len(celdas), 4)]
    cv2.imwrite(str(salida), cv2.vconcat(filas))
    print(f"  hoja: {salida}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("video", type=Path, nargs="?", help="el video a medir (o nada, con --una)")
    p.add_argument("--desde", type=float, default=0)
    p.add_argument("--hasta", type=float, default=0, help="0 = hasta el final")
    p.add_argument("--fps", type=float, default=3, help="muestras por segundo (2–4 gastan poco y bastan)")
    p.add_argument("--conf", type=float, default=0.6, help="score mínimo de la cara")
    p.add_argument("--lado", type=int, default=640, help="lado máximo del frame que ve el detector")
    p.add_argument("--hoja", type=Path, help="PNG de muestras con las cajas dibujadas")
    p.add_argument("--una", type=Path, help="una foto (JPG/PNG): detecta sus caras y escribe el JSON por stdout")
    a = p.parse_args()

    import cv2

    if a.una:
        img = cv2.imread(str(a.una))
        if img is None:
            sys.exit(f"No pude abrir {a.una}")
        alto, ancho = img.shape[:2]
        escala = min(1.0, a.lado / max(ancho, alto))
        det = cv2.FaceDetectorYN.create(str(MODELO), "", (max(32, round(ancho * escala)), max(32, round(alto * escala))), a.conf)
        if escala < 1:
            img = cv2.resize(img, (round(ancho * escala), round(alto * escala)))
        _, caras = det.detect(img)
        lista = []
        if caras is not None:
            for c in caras:
                x, y, w, h = (float(v) for v in c[:4])
                lista.append({"x": round(x / escala, 1), "y": round(y / escala, 1),
                              "w": round(w / escala, 1), "h": round(h / escala, 1), "score": round(float(c[14]), 3)})
        print(json.dumps({"ancho": ancho, "alto": alto, "caras": lista}))
        return
    if not a.video:
        sys.exit(__doc__)

    cap = cv2.VideoCapture(str(a.video))
    if not cap.isOpened():
        sys.exit(f"No pude abrir {a.video}")
    fps_video = cap.get(cv2.CAP_PROP_FPS) or 30
    cuadros = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    ancho, alto = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = cuadros / fps_video if fps_video else 0
    hasta = a.hasta or total
    # La entrada del detector va a `lado` de ancho máximo: las caras pequeñas del 1080p se ven, y detecta rápido.
    escala = min(1.0, a.lado / max(ancho, alto))
    det = cv2.FaceDetectorYN.create(str(MODELO), "", (max(32, round(ancho * escala)), max(32, round(alto * escala))), a.conf)

    # Saltar al primer cuadro del tramo en vez de decodificar desde cero: en una fuente larga es la
    # diferencia entre segundos y minutos. El seek puede quedar unos cuadros antes de la posición
    # pedida, así que los tiempos se leen de la posición real del stream, no de la supuesta.
    if a.desde > 0 and cuadros:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(a.desde * fps_video))
    paso = 1 / a.fps
    muestras, t0 = [], time.time()
    ultimo_t = -1
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        if t < a.desde:
            continue
        if t > hasta:
            break
        if t - ultimo_t < paso - 1e-6:
            continue
        ultimo_t = t
        if escala < 1:
            frame = cv2.resize(frame, (round(ancho * escala), round(alto * escala)))
        _, caras = det.detect(frame)
        lista = []
        if caras is not None:
            for c in caras:
                x, y, w, h = (float(v) for v in c[:4])
                lista.append({"x": round(x / escala, 1), "y": round(y / escala, 1),
                              "w": round(w / escala, 1), "h": round(h / escala, 1), "score": round(float(c[14]), 3)})
        muestras.append({"t": round(t, 2), "caras": lista})
    cap.release()
    ms = (time.time() - t0) * 1000 / max(1, len(muestras))

    datos = {"video": str(a.video), "fps_muestra": a.fps, "ancho": ancho, "alto": alto,
             "rango": [round(a.desde, 2), round(hasta, 2)], "muestras": muestras}
    salida = a.video.with_suffix(".caras.json")
    salida.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")

    con_cara = sum(1 for m in muestras if m["caras"])
    grandes = sum(1 for m in muestras if any(c["h"] > 0.15 * alto for c in m["caras"]))
    print(f"✓ {len(muestras)} muestras de {a.desde:.0f}–{hasta:.0f} s de {a.video.name} ({ms:.0f} ms/muestra)")
    print(f"  con cara: {con_cara}/{len(muestras)} · cara grande (>15 % del alto): {grandes}/{len(muestras)}")
    print(f"  → {salida}")

    if a.hoja:
        hoja(a.video, muestras, a.hoja, ancho, alto)


main()
