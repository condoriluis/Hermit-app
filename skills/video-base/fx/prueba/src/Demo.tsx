import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  BarridoCorte,
  Cortina,
  Empuje,
  FlashCorte,
  Fundido,
  Giro,
  GlitchCorte,
  Grano,
  Iris,
  Letterbox,
  LightLeak,
  Shake,
  Viñeta,
  Zoom,
  ZoomCorte,
  ZoomPunch,
} from "./fx";

/**
 * Demo del kit fx: 6 escenas con solape de 12 cuadros — las 6 transiciones de
 * escena, los 4 overlays de corte y los efectos (Shake, ZoomPunch, Viñeta,
 * Grano, Letterbox, LightLeak) en un solo render de 12 s.
 */

const F = 12; // solape entre escenas, como en las plantillas
const T = [0, 60, 120, 180, 240, 300, 360]; // fronteras

const COLORES: [string, string][] = [
  ["#1b2a4a", "#0d1526"],
  ["#3a1b4a", "#1c0d26"],
  ["#142a3a", "#0a141c"],
  ["#1b4a3a", "#0d2619"],
  ["#4a241b", "#260f0a"],
  ["#2a1b4a", "#140d26"],
];
const NOMBRES = ["EMP-UJE", "CORTINA", "FUNDIDO", "IRIS", "GIRO", "ZOOM"];
const DETALLES = [
  "desliza y empuja",
  "barrido clip-path",
  "opacidad suave",
  "ojo de buey",
  "card flip",
  "atraviesa la imagen",
];

const Escena: React.FC<{ i: number }> = ({ i }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(160deg, ${COLORES[i][0]} 0%, ${COLORES[i][1]} 100%)`,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 30,
    }}
  >
    <div
      style={{
        fontFamily: "sans-serif",
        fontWeight: 900,
        fontSize: 110,
        color: "#fff",
        textShadow: "0 6px 0 rgba(0,0,0,.35)",
        letterSpacing: 4,
      }}
    >
      {NOMBRES[i]}
    </div>
    <div style={{ fontFamily: "sans-serif", fontSize: 42, color: "rgba(255,255,255,.85)", fontWeight: 700 }}>
      {DETALLES[i]}
    </div>
  </AbsoluteFill>
);

type Wrapper = React.FC<{ children: React.ReactNode; desde: number; hasta: number }>;

const TRANSICIONES: Wrapper[] = [
  (p) => <Empuje {...p} dur={F} dir="izquierda" />,
  (p) => <Cortina {...p} dur={14} dir="derecha" />,
  (p) => <Fundido {...p} dur={10} />,
  (p) => <Iris {...p} dur={14} />,
  (p) => <Giro {...p} dur={12} grados={65} />,
  (p) => <Zoom {...p} dur={12} escala={1.3} />,
];

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {T.slice(0, -1).map((b, i) => {
        const L = Math.max(0, b - F);
        const R = T[i + 1];
        const W = TRANSICIONES[i];
        const dentro = <Escena i={i} />;
        return (
          <Sequence key={i} from={L} durationInFrames={R - L} name={NOMBRES[i]}>
            {i === 3 ? (
              // Iris + Shake en el golpe del cuadro 205
              <Iris desde={L} hasta={R} dur={14}>
                <Shake desde={L} en={205} dur={16} intensidad={16}>
                  {dentro}
                </Shake>
              </Iris>
            ) : i === 4 ? (
              // Giro + ZoomPunch en el cuadro 255
              <Giro desde={L} hasta={R} dur={12} grados={65}>
                <ZoomPunch desde={L} en={255} pico={1.16} dur={9}>
                  {dentro}
                </ZoomPunch>
              </Giro>
            ) : (
              <W desde={L} hasta={R}>{dentro}</W>
            )}
          </Sequence>
        );
      })}

      {/* Overlays de corte, encima de las escenas, en cada frontera */}
      <Sequence from={T[1] - 4} durationInFrames={10} name="glitch">
        <GlitchCorte dur={10} />
      </Sequence>
      <Sequence from={T[2] - 4} durationInFrames={8} name="flash">
        <FlashCorte dur={8} color="#ffd23f" pico={0.8} />
      </Sequence>
      <Sequence from={T[3] - 4} durationInFrames={9} name="zoomcorte">
        <ZoomCorte dur={9} color="#8ef0c8" />
      </Sequence>
      <Sequence from={T[4] - 4} durationInFrames={10} name="barrido">
        <BarridoCorte dur={10} color="#ff8a5c" />
      </Sequence>
      <Sequence from={T[5] - 4} durationInFrames={10} name="glitch2">
        <GlitchCorte dur={10} intensidad={0.7} />
      </Sequence>

      {/* Overlays fijos de toda la pieza */}
      <Viñeta intensidad={0.4} />
      <Grano intensidad={0.06} />

      {/* Tramo cinematográfico final: letterbox + light leak */}
      <Sequence from={320} durationInFrames={40} name="cine">
        <Letterbox dur={15} alto={0.11} />
        <LightLeak intensidad={0.55} dur={180} />
      </Sequence>
    </AbsoluteFill>
  );
};
