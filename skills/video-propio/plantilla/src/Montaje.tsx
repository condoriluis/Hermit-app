/**
 * El montaje de «Video con tu material». No se edita a mano: `hacer.py` escribe `montaje.json` con las escenas ya
 * medidas en cuadros (cada foto o video del usuario, sus títulos y el orden). Aquí cada escena se dibuja en su tramo,
 * con fundido con la vecina, paneo lento en las fotos, tarjetas de apertura y cierre, y títulos que entran palabra a
 * palabra en Archivo Black. El video no lleva audio: la música y la voz las mezcla `hacer.py` aparte (sonido.wav).
 */
import { AbsoluteFill, Img, OffthreadVideo, Sequence, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, continueRender, delayRender } from "remotion";
import { useEffect, useState, type CSSProperties, type FC, type ReactNode } from "react";
import datos from "./montaje.json";

type Foto = { src: string; pie?: string };
type Escena =
  | { tipo: "plano"; src: string; video: boolean; mov: string; titulo?: string; subtitulo?: string; desde: number; hasta: number }
  | { tipo: "collage"; fotos: Foto[]; titulo?: string; subtitulo?: string; desde: number; hasta: number }
  | { tipo: "tarjeta"; variante: "intro" | "cierre"; titulo: string; subtitulo?: string; kicker?: string; desde: number; hasta: number };

const D = datos as { ancho: number; alto: number; fps: number; duracion: number; acento: string; escenas: Escena[] };
const { W, H, FPS } = { W: D.ancho, H: D.alto, FPS: D.fps };
const VERTICAL = H > W;
/** El fundido entre escenas, en cuadros (~0,33 s): la que sale se apaga en su último tramo y la que entra se
 *  enciende en el primero, con las dos a la vez. */
const F = 10;

const css = `
@font-face { font-family: "Archivo Black"; src: url("${staticFile("assets/fonts/ArchivoBlack-Regular.ttf")}") format("truetype"); }
@font-face { font-family: "Varela Round"; src: url("${staticFile("assets/fonts/VarelaRound-Regular.ttf")}") format("truetype"); }
.grano {
  position: absolute; inset: -120px; pointer-events: none; opacity: .05;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>");
  animation: grano .8s steps(4) infinite;
}
@keyframes grano {
  0% { transform: translate(0, 0); } 25% { transform: translate(-38px, 24px); }
  50% { transform: translate(26px, -30px); } 75% { transform: translate(-18px, -14px); }
  100% { transform: translate(0, 0); }
}
`;

/** Un título que entra palabra a palabra: cada una sube y aparece con su resorte, escalonada. */
const Titulo: FC<{ texto?: string; subtitulo?: string; local: number; dur: number }> = ({ texto, subtitulo, local, dur }) => {
  if (!texto && !subtitulo) return null;
  const palabras = (texto ?? "").split(/\s+/).filter(Boolean);
  const sale = Math.max(0, local - (dur - 14));
  const salida = interpolate(sale, [0, 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: VERTICAL ? "17%" : "9%", textAlign: "center", opacity: salida, padding: "0 6%" }}>
      {palabras.length > 0 && (
        <div style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: VERTICAL ? 78 : 84, lineHeight: 1.04, color: "#fff", letterSpacing: "0.5px" }}>
          {palabras.map((p, i) => {
            const s = spring({ frame: local - 6 - i * 3, fps: FPS, config: { damping: 200, stiffness: 120 } });
            const entra = { display: "inline-block", margin: "0 0.28em", opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 46}px) rotate(${(1 - s) * -2}deg)`, textShadow: "0 3px 0 rgba(0,0,0,.5), 0 10px 34px rgba(0,0,0,.65), -2px -2px 0 rgba(0,0,0,.6), 2px -2px 0 rgba(0,0,0,.6), -2px 2px 0 rgba(0,0,0,.6), 2px 2px 0 rgba(0,0,0,.6)" } as CSSProperties;
            // La última palabra lleva el golpe: marcador de acento que barre detrás, como en los recaps.
            if (palabras.length > 1 && i === palabras.length - 1) {
              const m = spring({ frame: local - 6 - i * 3 - 2, fps: FPS, config: { damping: 16, stiffness: 160 } });
              return (
                <span key={i} style={entra}>
                  <span style={{ position: "relative", display: "inline-block", padding: "0 .14em" }}>
                    <span style={{ position: "absolute", left: "-4%", right: "-4%", top: "-12%", bottom: "-24%", background: D.acento, borderRadius: 14, transform: `scaleX(${m})`, transformOrigin: "0% 50%", rotate: "-1deg" }} />
                    <span style={{ position: "relative", color: "#0b0f14" }}>{p}</span>
                  </span>
                </span>
              );
            }
            return <span key={i} style={entra}>{p}</span>;
          })}
        </div>
      )}
      {subtitulo && (
        <div style={{ marginTop: 14, fontFamily: '"Varela Round", sans-serif', fontSize: 34, fontWeight: 700, color: "rgba(255,255,255,.92)", textShadow: "0 2px 12px rgba(0,0,0,.7)" }}>
          {subtitulo}
        </div>
      )}
    </div>
  );
};

/** La foto o el video a pantalla completa, con su paneo lento (Ken Burns) según `mov`, con ease y una
 *  micro-rotación que lo despega del movimiento mecánico lineal. `i` da variedad de giro por escena. */
const Plano: FC<{ e: Extract<Escena, { tipo: "plano" }>; local: number; dur: number; i: number }> = ({ e, local, dur, i }) => {
  const p = Easing.inOut(Easing.cubic)(Math.min(1, local / Math.max(1, dur)));
  const zoom = e.mov === "alejar" ? interpolate(p, [0, 1], [1.15, 1.0]) : interpolate(p, [0, 1], [1.0, 1.18]);
  const cx = e.mov === "izquierda" ? interpolate(p, [0, 1], [2.5, -2.5]) : e.mov === "derecha" ? interpolate(p, [0, 1], [-2.5, 2.5]) : 0;
  const cy = e.mov === "arriba" ? interpolate(p, [0, 1], [2, -2]) : e.mov === "abajo" ? interpolate(p, [0, 1], [-2, 2]) : 0;
  const giro = interpolate(p, [0, 1], [0, (i % 2 === 0 ? 1 : -1) * (e.mov === "alejar" ? -1.3 : 1.3)]);
  const estilo: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `translate(${cx}%, ${cy}%) scale(${zoom}) rotate(${giro}deg)` };
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {e.video ? <OffthreadVideo src={staticFile(e.src)} muted style={estilo} /> : <Img src={staticFile(e.src)} style={estilo} />}
      <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,0) 42%)" }} />
      <Titulo texto={e.titulo} subtitulo={e.subtitulo} local={local} dur={dur} />
    </AbsoluteFill>
  );
};

/** Dónde cae cada foto del collage: [left %, top %, giro] dentro de su caja, una pila suelta que se encimbra. */
const LUGARES: Record<number, [number, number, number][]> = VERTICAL
  ? {
      2: [[30, 50, -6], [54, 48, 5]],
      3: [[28, 44, -8], [52, 42, 4], [38, 60, 7]],
      4: [[26, 42, -9], [56, 40, 6], [32, 62, 3], [60, 60, -5]],
    }
  : {
      2: [[30, 52, -5], [56, 50, 4]],
      3: [[26, 50, -7], [52, 48, 3], [38, 64, 8]],
      4: [[22, 46, -8], [48, 44, 6], [30, 66, 3], [60, 64, -5]],
    };

/** Las fotos en marcos, como un collage que cae escalonado y flota despacio. */
const Collage: FC<{ e: Extract<Escena, { tipo: "collage" }>; local: number; dur: number }> = ({ e, local, dur }) => {
  const lugares = LUGARES[Math.min(4, e.fotos.length)] ?? LUGARES[4];
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 30%, #1a222b 0%, #0b0f14 70%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "4%", right: "4%", top: VERTICAL ? "14%" : "8%", bottom: VERTICAL ? "36%" : "24%" }}>
        {e.fotos.map((f, i) => {
          const [x, y, giro] = lugares[i % lugares.length];
          const s = spring({ frame: local - 4 - i * 5, fps: FPS, config: { damping: 14, stiffness: 90, mass: 0.9 } });
          const flot = Math.sin((local + i * 17) / 34) * 1.4;
          return (
            <div key={i} style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: VERTICAL ? "38%" : "27%",
              aspectRatio: VERTICAL ? "4/5" : "16/10",
              background: "#f4f1ea",
              padding: VERTICAL ? "10px 10px 30px" : "12px 12px 34px",
              boxShadow: "0 24px 60px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.4)",
              transform: `translateY(${(1 - s) * -160}px) rotate(${giro + flot + (1 - s) * giro * 2.2}deg) scale(${0.9 + s * 0.1})`,
              opacity: Math.min(1, s * 1.6),
            }}>
              <Img src={staticFile(f.src)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {f.pie && <div style={{ position: "absolute", left: 0, right: 0, bottom: 7, textAlign: "center", fontFamily: '"Varela Round", sans-serif', fontSize: VERTICAL ? 19 : 21, fontWeight: 700, color: "#3a3f45" }}>{f.pie}</div>}
            </div>
          );
        })}
      </div>
      <Titulo texto={e.titulo} subtitulo={e.subtitulo} local={local} dur={dur} />
    </AbsoluteFill>
  );
};

/** La tarjeta de apertura o de cierre: fondo sobrio, filete de acento y el título grande. */
const Tarjeta: FC<{ e: Extract<Escena, { tipo: "tarjeta" }>; local: number; dur: number }> = ({ e, local }) => {
  const cierre = e.variante === "cierre";
  const s = spring({ frame: local - 2, fps: FPS, config: { damping: 18, stiffness: 80 } });
  const palabras = e.titulo.split(/\s+/).filter(Boolean);
  return (
    <AbsoluteFill style={{ background: cierre ? "#0b0f14" : "radial-gradient(100% 80% at 50% 38%, #16202a 0%, #0b0f14 75%)", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "34%", height: 5, borderRadius: 3, background: D.acento, transform: `scaleX(${s})`, transformOrigin: "50% 50%", marginBottom: VERTICAL ? 44 : 36, opacity: s }} />
      {e.kicker && (
        <div style={{ fontFamily: '"Varela Round", sans-serif', fontSize: 30, fontWeight: 700, letterSpacing: "0.42em", color: D.acento, textTransform: "uppercase", marginBottom: 22, opacity: Math.min(1, s * 1.5) }}>{e.kicker}</div>
      )}
      <div style={{ textAlign: "center", padding: "0 8%", opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 26}px)` }}>
        <div style={{ fontFamily: '"Archivo Black", sans-serif', fontSize: VERTICAL ? 96 : 88, lineHeight: 1.05, color: "#fff", textShadow: "0 4px 0 rgba(0,0,0,.4), 0 18px 50px rgba(0,0,0,.6)" }}>
          {palabras.map((p, i) => (
            <span key={i} style={{ display: "block" }}>{p}</span>
          ))}
        </div>
        {e.subtitulo && <div style={{ marginTop: 26, fontFamily: '"Varela Round", sans-serif', fontSize: 36, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>{e.subtitulo}</div>}
      </div>
    </AbsoluteFill>
  );
};

const Escena: FC<{ e: Escena; i: number }> = ({ e, i }) => {
  const local = useCurrentFrame();
  const dur = e.hasta - e.desde + F;
  if (e.tipo === "plano") return <Plano e={e} local={local} dur={dur} i={i} />;
  if (e.tipo === "collage") return <Collage e={e} local={local} dur={dur} />;
  return <Tarjeta e={e} local={local} dur={dur} />;
};

export const Montaje: FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const [fuentes] = useState(() => delayRender("Las fuentes del video"));
  useEffect(() => {
    Promise.all([document.fonts.load('90px "Archivo Black"'), document.fonts.load('40px "Varela Round"')])
      .catch(() => {})
      .finally(() => continueRender(fuentes));
  }, [fuentes]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <style>{css}</style>
      {D.escenas.map((e, i) => {
        const L = Math.max(0, e.desde - F);
        const R = Math.min(durationInFrames, e.hasta);
        if (R <= L) return null;
        // Entre dos escenas de material, la nueva entra deslizándose y empuja a la anterior (dirección
        // alterna); con una tarjeta (intro/cierre) de por medio, fundido como antes.
        const vx = i % 2 === 0 ? 1 : -1;
        const empujaEntra = e.tipo !== "tarjeta" && D.escenas[i - 1]?.tipo !== "tarjeta" && i > 0;
        const empujaSale = e.tipo !== "tarjeta" && D.escenas[i + 1]?.tipo !== "tarjeta";
        const vxSale = (i + 1) % 2 === 0 ? 1 : -1;
        const tx = empujaEntra
          ? interpolate(f, [L, L + F], [110 * vx, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
          : empujaSale
            ? interpolate(f, [Math.max(L, R - F), R], [0, -110 * vxSale], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) })
            : 0;
        const op = Math.min(empujaEntra ? 1 : Math.max(0, (f - L) / F), empujaSale ? 1 : Math.max(0, (R - f) / F));
        return (
          <Sequence key={i} from={L} durationInFrames={R - L} name={e.titulo?.trim() || `${e.tipo}-${i}`}>
            <AbsoluteFill style={{ opacity: op, overflow: "hidden", transform: `translateX(${tx}%)` }}>
              <Escena e={e} i={i} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {/* La barra de avance, fina, arriba: se lee el ritmo sin tapar nada. */}
      <AbsoluteFill style={{ top: 0, height: 4, background: "rgba(255,255,255,.14)" }}>
        <div style={{ height: "100%", width: `${(f / durationInFrames) * 100}%`, background: D.acento }} />
      </AbsoluteFill>
      {/* Grano de película: la textura que hace que un recap se vea rodado y no plano. */}
      <div className="grano" />
      {/* Viñeta suave: cinemático y ayuda a que el texto se lea sobre cualquier foto. */}
      <AbsoluteFill style={{ background: "radial-gradient(115% 100% at 50% 45%, transparent 55%, rgba(0,0,0,.42) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
