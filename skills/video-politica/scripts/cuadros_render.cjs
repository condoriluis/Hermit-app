// Los cuadros de cada clip de la edición, sacados a imágenes antes de dibujar: es lo que hace rápido el render.
//
// Lo llama `render.cjs` de video-base (`--antes`), con el paquete de Remotion ya hecho. Con `OffthreadVideo`, cada
// cuadro de video viaja de FFmpeg a Chrome como un mapa de bits de varios MB. Aquí cada clip de `src/edicion.json`
// deja sus cuadros en `<paquete>/public/_cuadros/<id>/00000.jpg` y `Politica.tsx` los enseña como imágenes cuando recibe
// `cuadros: true`. Van dentro del paquete: se borran con él y no pasan por `public/` del video.
//
// `velocidad` (la cámara lenta de politica.json) se aplica en la extracción: `setpts=(PTS-STARTPTS)/velocidad` hace que el
// cuadro i salga del segundo i·velocidad/fps del clip, igual que `playbackRate` en el monitor en vivo.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function ffmpeg(args) {
  return new Promise((listo, falla) => {
    const p = spawn("ffmpeg", ["-nostdin", "-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    p.stderr.on("data", (d) => (error += d));
    p.on("error", falla);
    p.on("close", (c) => (c ? falla(new Error(`ffmpeg: ${error.slice(-400)}`)) : listo()));
  });
}

module.exports = async ({ serveUrl, raiz }) => {
  const datos = JSON.parse(fs.readFileSync(path.join(raiz, "src", "edicion.json"), "utf8"));
  const destino = path.join(serveUrl, "public", "_cuadros");
  const cola = datos.videos.map((v) => async () => {
    const n = Math.max(1, v.f1 - v.f0);
    const origen = path.join(raiz, "public", v.src.split("?")[0]);
    const carpeta = path.join(destino, v.id);
    fs.mkdirSync(carpeta, { recursive: true });
    const alfa = /\.webm$/i.test(origen);
    const ext = alfa ? "png" : "jpg";
    const vel = v.velocidad && v.velocidad !== 1 ? Number(v.velocidad) : 1;
    await ffmpeg([
      // El alfa de un VP9 solo sale con libvpx; el decodificador de FFmpeg lo tira.
      ...(alfa ? ["-c:v", "libvpx-vp9"] : []),
      "-ss", (v.desde / datos.fps).toFixed(4), "-i", origen,
      "-vf", `setpts=(PTS-STARTPTS)/${vel},fps=${datos.fps}`,
      "-frames:v", String(n), "-threads", "2",
      ...(alfa ? [] : ["-q:v", "3"]), "-start_number", "0", path.join(carpeta, `%05d.${ext}`),
    ]);
    // Si el clip se acaba antes que su tramo, su último cuadro se queda (como hacía el video).
    const hechos = fs.readdirSync(carpeta).length;
    if (!hechos) throw new Error(`no salieron cuadros de ${v.src}`);
    const ultimo = path.join(carpeta, `${String(hechos - 1).padStart(5, "0")}.${ext}`);
    for (let k = hechos; k < n; k++) fs.copyFileSync(ultimo, path.join(carpeta, `${String(k).padStart(5, "0")}.${ext}`));
  });
  const inicio = Date.now();
  const hilos = Math.max(2, Math.min(6, Math.floor(os.cpus().length / 2)));
  await Promise.all(Array.from({ length: hilos }, async () => {
    for (let tarea = cola.shift(); tarea; tarea = cola.shift()) await tarea();
  }));
  console.log(`Cuadros de ${datos.videos.length} clips en ${((Date.now() - inicio) / 1000).toFixed(0)} s.`);
};
