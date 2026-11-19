"""Divide una hoja de contacto 2×2 (cuatro paneles en una imagen, como las que se piden a Flow para no gastar cuatro
llamadas por cuatro variantes) en cuatro imágenes cuadradas.

    python -B dividir_contacto.py <hoja.jpg> <carpeta-salida/> <nombre1> <nombre2> <nombre3> <nombre4>

Los nombres van en el orden de los paneles: arriba-izquierda, arriba-derecha, abajo-izquierda, abajo-derecha.
Deja fuera el canal central y los márgenes, para que no entren en los recortes. Si la hoja no es cuadrada, falla:
pídela 1:1. Desde otro script: no hace falta, es de un solo uso.
"""

import sys
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 6:
        raise SystemExit(__doc__)
    hoja, salida, nombres = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
    im = Image.open(hoja).convert("RGB")
    w, h = im.size
    if abs(w / h - 1) > 0.01:
        raise SystemExit(f"La hoja no es cuadrada: {im.size}. Pídela en 1:1.")
    # El canal central y un margen por si el panel no llega al borde de su mitad.
    gx, gy = int(w * 0.018), int(h * 0.018)
    mx, my = w // 2, h // 2
    cajas = [
        (gx, gy, mx - gx, my - gy),
        (mx + gx, gy, w - gx, my - gy),
        (gx, my + gy, mx - gx, h - gy),
        (mx + gx, my + gy, w - gx, h - gy),
    ]
    salida.mkdir(parents=True, exist_ok=True)
    for nombre, caja in zip(nombres, cajas):
        destino = salida / f"{nombre}.jpg"
        im.crop(caja).save(destino, quality=95)
        print(f"{nombre}: {destino}")


if __name__ == "__main__":
    main()
