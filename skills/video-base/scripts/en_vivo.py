"""
El transcriptor del live de Clips (`server/en-vivo.ts`): la voz del stream, trozo a trozo, con el Whisper o el
Parakeet del Python de Hermit. Es un servicio que se queda esperando, como `voz_viva.py`: lo abre el servidor al
conectar un live y lo cierra al pararlo.

Por cada línea de stdin `{"wav": "<ruta>"}` transcribe ese WAV (16 kHz, mono — lo corta ffmpeg del propio live)
con `proceso()` de hermit.py, que en una NVIDIA usa el Whisper ya cargado de `voz_viva.py` y en los demás equipos
Parakeet, que carga en segundos. Contesta por stdout con una línea JSON: `{"ok": true, "segmentos": [...],
"idioma": "..."}` o `{"ok": false, "error": "..."}`. Los tiempos son los del trozo, desde su principio: quien lo
lanzó les suma el corrimiento del trozo dentro de la emisión.

`{"salir": true}` lo cierra; si stdin se cierra (el servidor se va), también.
"""

import contextlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hermit import MODELOS, proceso  # noqa: E402


def atender(pedido: dict) -> dict:
    try:
        # proceso() avisa por stdout («Esperando…» del turno, «Transcribo…», «Transcribiendo: N %»): si esas
        # líneas salieran por aquí, el servidor las tomaría por respuestas y se comería los trozos sin
        # transcribir nada (ya pasó: el live entero quedó con la transcripción vacía). Van a stderr.
        with contextlib.redirect_stdout(sys.stderr):
            d = proceso("transcribir-ajeno.py", [pedido["wav"]], {"modelos": str(MODELOS)})
        return {"ok": True, "segmentos": d.get("segmentos") or [], "idioma": d.get("idioma")}
    except BaseException as e:  # noqa: BLE001 — SystemExit de proceso() también es fallo del trozo, no del servicio
        return {"ok": False, "error": str(e) or type(e).__name__}


def main() -> None:
    for linea in sys.stdin:
        try:
            pedido = json.loads(linea)
        except json.JSONDecodeError:
            continue
        if pedido.get("salir"):
            break
        if not pedido.get("wav"):
            continue
        print(json.dumps(atender(pedido), ensure_ascii=False), flush=True)


main()
