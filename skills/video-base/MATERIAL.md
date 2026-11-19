# El material con licencia

Todo estilo que usa fotos o clips de archivo los saca de los mismos bancos, con la misma regla: **nada entra al
video sin su fuente y su licencia anotadas**. La capa que baja y resuelve las referencias es
`scripts/bancos.py` (la usan `video-documental` y cualquier `hacer.py` que la importe); `video-documental` le suma
encima su tratamiento (`material.py`).

## Las fuentes

| Referencia | Banco | Licencia |
|---|---|---|
| `mixkit:<id>` | Mixkit (stock de video) | Mixkit Free License |
| `commons:File:<nombre>` | Wikimedia Commons | La del archivo (suele ser CC; `revisar` avisa si pide crédito) |
| `archive:<identificador>` | archive.org (Prelinger y demás) | Dominio público o la de su ficha; si no es clara, `revisar` lo dice |
| `nasa:<id>` | Biblioteca de imágenes de NASA | Dominio público |
| `yt:<id>` | YouTube | Del canal: uso como comentario o cita (`revisar` lo recuerda) |
| URL de imagen o página | og:image de la página | `revisar`: confirmar que se puede usar |
| URL de `.mp4`/`.webm` | El archivo directo | `revisar`: confirmar que se puede usar |
| Ruta del disco | Lo que adjuntó el usuario | Del usuario |

## Cómo se consiguen las referencias

`video-documental/scripts/buscar.py` las busca y las muestra en `revision/busca.jpg` (una hoja para elegir mirando,
no por el título). Se corre desde la raíz del proyecto:

```
python -I -B -X utf8 <skills>/video-documental/scripts/buscar.py "race start" "dripping tap" "foto:Googleplex" \
    "archivo:car show 1950" "nasa:aurora"
```

- a secas: clips de Mixkit y alguno de Commons
- `foto:`: fotos de Commons y NASA · `archivo:`: películas de archivo · `nasa:`: videos y fotos de NASA
- `--mira <referencia>`: un cuadro por segundo de un clip, para elegir su `desde`

La referencia que va en el pedido de material es la que imprime, tal cual (`mixkit:4421`, `archive:…`,
`commons:File:…`, `nasa:…`). También sirven las URLs directas.

## La regla

1. **Todo material se anota**: de dónde salió (`pagina`), su `licencia` y si hay que `revisar` derechos. El
   documental lo deja en `work/material.json` y `FUENTES.md`; cualquier estilo que junte material propio deja el
   mismo registro (una tabla en el proyecto o su `FUENTES.md`).
2. **`revisar` no vacío = no publicar sin comprobar**: son los casos de derechos del dueño (YouTube, dominios
   ajenos, fotos de páginas, archive.org sin licencia clara).
3. **Nada de personas reales generadas**: si el plano necesita gente, se busca material que ya la tenga con su
   licencia, o se usa lo del usuario. En `busca.jpg`, los clips marcados `[gente]` solo sirven cuando la frase
   habla de esa clase de persona.
4. **Lo que no sale en los bancos** va como `pagina`/`foto`/`post` con su URL, o lo genera el estilo con IA solo
   si no es una persona real identificable (regla de cada `SKILL.md`).

## Usarlo desde un `hacer.py`

```python
import sys
from pathlib import Path
BASE = Path(__file__).resolve().parents[2] / "video-base" / "scripts"
sys.path.insert(0, str(BASE))
from bancos import Falla, bajar_a, pedir, resolver
```

`resolver("foto"|"clip", referencia)` devuelve `{"url", "pagina", "licencia", "revisar", ...}`; `bajar_a(url,
destino)` lo deja en disco sin bajarlo dos veces; `pedir(url)` baja una URL con las esperas de los 429. Para bajar
muchos archivos o tratarlos (recortes, looks), el patrón completo está en
`video-documental/scripts/material.py`, que ya resuelve todo esto y deja la hoja `revision/material.jpg`.
