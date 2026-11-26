/**
 * El anuncio de publicidad en Remotion. No se edita a mano: el director (`components/director.py`) la escribe en
 * `src/edicion.json` — una capa por tramo de material (foto con paneo o clip), una por los textos del anuncio en
 * cada corte (titular y `sub` con su entrada cinética), la tarjeta de marca del cierre (fondo, logo, eslogan y
 * píldora del CTA con sus entradas escalonadas) y el karaoke de subtítulos, que van como capas dentro del video
 * (como en el top y el documental): no hay `.ass` ni post-pase, `out/` queda solo con el mp4 final.
 *
 * Las capas se montan siempre (GSAP las busca por su id), la línea se lleva al cuadro que toca y cada capa se
 * enseña solo en su tramo. Los clips van con `OffthreadVideo` en vivo y como imágenes ya sacadas (`_cuadros/`) en
 * el render final, que es varias veces más rápido. Las rutas son de `public/`; los colores de la marca llegan
 * como variables CSS (`--pub-color`, `--pub-fondo`, `--pub-acento`, `--pub-tinta`) dentro de la propia edición.
 */
import gsap from "gsap";
import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type FC, type HTMLAttributes } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import json from "./edicion.json";

/** El cuadro que toca de un clip, como imagen: su tramo empieza en el cuadro 0 de su `Sequence`. */
const Cuadros: FC<{ id: string; n: number; alfa: boolean }> = ({ id, n, alfa }) => {
  const f = Math.min(n - 1, Math.max(0, useCurrentFrame()));
  return <Img src={staticFile(`_cuadros/${id}/${String(f).padStart(5, "0")}.${alfa ? "png" : "jpg"}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
};

type Capa = { id: string; f0: number; f1: number; z: number; cls: string; style: string; pieza: string };
type Clip = Capa & { html: string };
type Video = Capa & { src: string; desde: number; velocidad?: number };
type Escena = { nombre: string; f0: number; f1: number };
/** Las pistas del monitor en vivo y de la línea de tiempo (`sonido` de edicion.json, lo escribe hacer.py):
 *  la voz, la música y cada efecto en su golpe. El video final no las usa —su audio es la mezcla ffmpeg de
 *  `audio()`—: los `<Audio>` solo viven en el Player del monitor. */
type Sonido = {
  musica?: { src: string; desde: number; hasta: number; volumen: number };
  voz?: { src: string; desde: number; hasta: number; volumen: number };
  sfx?: { src: string; desde: number; hasta: number; volumen: number }[];
};
type Datos = {
  titulo: string;
  fps: number;
  ancho: number;
  alto: number;
  duracion: number;
  css: string;
  clips: Clip[];
  videos: Video[];
  pre: string;
  js: string;
  escenas: Escena[];
  audio: string | null;
  sonido?: Sonido;
};

export const datos = json as unknown as Datos;
const S = datos.sonido;

/** Una ruta de public/ (con su `?v=` si lo trae) como la sirve Remotion; las de fuera, tal cual. */
function ruta(s: string) {
  if (/^(https?:|data:|blob:|\/)/.test(s)) return s;
  const [archivo, version] = s.split("?");
  return staticFile(archivo) + (version ? `?${version}` : "");
}

const conRutas = (html: string) => html.replace(/(\ssrc=")([^"]+)"/g, (_, a: string, s: string) => `${a}${ruta(s)}"`);

/** Las fuentes del estilo viven en public/assets/pub/fonts. */
const css = datos.css.replace(/url\("fonts\/([^"]+)"\)/g, (_, f: string) => `url("${staticFile(`assets/pub/fonts/${f}`)}")`);

/** El `style` de una capa, de texto CSS al objeto de React, con su z-index. */
function estilo(texto: string, z: number): CSSProperties {
  const o: Record<string, string | number> = { zIndex: z };
  for (const d of texto.split(";")) {
    const i = d.indexOf(":");
    const k = d.slice(0, i).trim();
    if (i < 0 || !k) continue;
    o[k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_, l: string) => l.toUpperCase())] = d.slice(i + 1).trim();
  }
  return o as CSSProperties;
}

/**
 * Cada capa se dibuja con un componente que se llama como su pieza (`material`, `textos`, `tarjeta`, `logo`,
 * `eslogan`, `cta`, `subtitulo`…): es lo que el estudio de Hermit dice de lo que se elige en el cuadro.
 */
type Props = HTMLAttributes<HTMLDivElement> & { "data-f0": number; "data-f1": number };
const piezas = new Map<string, FC<Props>>();
function pieza(nombre: string) {
  let P = piezas.get(nombre);
  if (!P) {
    P = (p) => <div {...p} />;
    P.displayName = nombre;
    piezas.set(nombre, P);
  }
  return P;
}

/**
 * Todas las capas, montadas siempre (GSAP las busca por su id al armar la línea) y sin volver a dibujarse: lo
 * que cambia con el cuadro lo pone `Publicidad` directamente en el DOM.
 */
const Capas = memo(({ cuadros }: { cuadros?: boolean }) => (
  <>
    {datos.clips.map((c) => {
      const P = pieza(c.pieza);
      return <P key={c.id} id={c.id} className={c.cls} style={estilo(c.style, c.z)} data-f0={c.f0} data-f1={c.f1} dangerouslySetInnerHTML={{ __html: conRutas(c.html) }} />;
    })}
    {datos.videos.map((v) => {
      const P = pieza(v.pieza);
      return (
        <P key={v.id} id={v.id} className={v.cls} style={estilo(v.style, v.z)} data-f0={v.f0} data-f1={v.f1}>
          <Sequence from={v.f0} durationInFrames={Math.max(1, v.f1 - v.f0)} premountFor={30} showInTimeline={false} name={v.pieza}>
            {/* En el render final (`--props={"cuadros":true}`) los cuadros de cada clip ya están sacados en
                `_cuadros/<id>/` (`cuadros_render.cjs`); en el monitor en vivo llegan como OffthreadVideo. */}
            {cuadros === true ? (
              <Cuadros id={v.id} n={Math.max(1, v.f1 - v.f0)} alfa={/\.webm$/i.test(v.src)} />
            ) : (
              <OffthreadVideo
                src={ruta(v.src)}
                trimBefore={v.desde > 0 ? v.desde : undefined}
                playbackRate={v.velocidad && v.velocidad !== 1 ? v.velocidad : undefined}
                muted
                transparent={/\.webm$/i.test(v.src)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
          </Sequence>
        </P>
      );
    })}
  </>
));

export const Publicidad: FC<{ cuadros?: boolean }> = ({ cuadros }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const raiz = useRef<HTMLDivElement>(null);
  const linea = useRef<gsap.core.Timeline | null>(null);
  const [fuentes] = useState(() => delayRender("Las fuentes del estilo"));

  // La línea de tiempo, una vez. Con `gsap.context`, los `#id` se buscan solo dentro de este video.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      new Function("gsap", datos.pre)(gsap);
      const tl = gsap.timeline({ paused: true });
      new Function("gsap", "tl", datos.js)(gsap, tl);
      linea.current = tl;
    }, raiz.current!);
    const caras = [...document.fonts].filter((f) => f.family.replace(/["']/g, "").startsWith("Pub"));
    Promise.all(caras.map((f) => f.load()))
      .catch(() => {})
      .finally(() => continueRender(fuentes));
    return () => {
      ctx.revert();
      linea.current = null;
    };
  }, [fuentes]);

  // Cada cuadro: la línea en su tiempo (un pelo después: los tiempos van redondeados a 4 decimales), cada capa
  // visible solo en su tramo y, en el render, esperar a las imágenes que entran.
  useLayoutEffect(() => {
    linea.current?.seek(frame / fps + 1e-4, true);
    const pendientes: HTMLImageElement[] = [];
    for (const el of raiz.current!.querySelectorAll<HTMLElement>(":scope > [data-f0]")) {
      const dentro = frame >= Number(el.dataset.f0) && frame < Number(el.dataset.f1);
      el.style.display = dentro ? "" : "none";
      if (dentro) for (const img of el.querySelectorAll("img")) if (!img.complete) pendientes.push(img);
    }
    if (!pendientes.length) return;
    const espera = delayRender("Las imágenes del cuadro");
    const cargada = (img: HTMLImageElement) =>
      new Promise((listo) => {
        img.addEventListener("load", listo, { once: true });
        img.addEventListener("error", listo, { once: true });
      });
    void Promise.all(pendientes.map(cargada)).then(() => continueRender(espera));
  }, [frame, fps]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <style>{css}</style>
      <div ref={raiz} className="pub-frame" style={{ width: datos.ancho, height: datos.alto }}>
        <Capas cuadros={cuadros} />
      </div>
      {/* Las pistas del sonido, cada una en su carril de la línea de tiempo; showInTimeline=false para que
          no se lean como escenas. Si la edición no trae `sonido` (una vieja), queda la mezcla única de `audio`. */}
      {S ? (
        <>
          {S.voz && (
            <Sequence from={S.voz.desde} durationInFrames={Math.max(1, S.voz.hasta - S.voz.desde)} name="Voz" showInTimeline={false}>
              <Audio src={ruta(S.voz.src)} name="Voz" volume={S.voz.volumen} />
            </Sequence>
          )}
          {S.musica && (
            <Sequence from={S.musica.desde} durationInFrames={Math.max(1, S.musica.hasta - S.musica.desde)} name="Música" showInTimeline={false}>
              <Audio src={ruta(S.musica.src)} name="Música" volume={S.musica.volumen} />
            </Sequence>
          )}
          {S.sfx?.map((s, i) => (
            <Sequence key={`sfx-${i}`} from={s.desde} durationInFrames={Math.max(1, s.hasta - s.desde)} showInTimeline={false}>
              <Audio src={ruta(s.src)} volume={s.volumen} />
            </Sequence>
          ))}
        </>
      ) : (
        datos.audio && <Audio src={ruta(datos.audio)} />
      )}
      {datos.escenas.map((e, i) => (
        <Sequence key={i} from={e.f0} durationInFrames={Math.max(1, e.f1 - e.f0)} name={e.nombre} layout="none">
          {null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
