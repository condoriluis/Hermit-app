-- Las visitas de la página y las descargas que cuenta el Worker (src/estadisticas.ts): `tipo` es 'pagina' o
-- 'descarga' (esta con `so`); `sesion` es la conexión resumida y el día, sin la IP. `ruta` es la página vista,
-- `ref` de dónde se vino, `pais`/`ciudad` lo que dice Cloudflare, `so` el de quien descarga y `disp` móvil o
-- escritorio. El panel las lee en `/panel` y `/estadisticas/datos`, con la llave PUBLICAR.
CREATE TABLE visitas (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  sesion TEXT NOT NULL,
  tipo TEXT NOT NULL,
  ruta TEXT,
  ref TEXT,
  pais TEXT,
  ciudad TEXT,
  so TEXT,
  disp TEXT
);
CREATE INDEX visitas_ts ON visitas (ts);
