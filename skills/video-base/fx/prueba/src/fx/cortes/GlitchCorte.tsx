import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { azar, prog } from "../util";

const ruido =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")";

/**
 * GlitchCorte: el corte «se corrompe» — franjas RGB desplazadas, bloques de
 * ruido que saltan y líneas de escaneo, todo determinista por cuadro. Es el
 * glitch de CapCut hecho con capas (no necesita el frame de abajo: el efecto
 * se lee por sí solo). `intensidad` 0-1.
 *
 *   <Sequence from={corte - 4} durationInFrames={10}><GlitchCorte /></Sequence>
 */
export const GlitchCorte: React.FC<{ dur?: number; intensidad?: number }> = ({
  dur = 10,
  intensidad = 1,
}) => {
  const f = useCurrentFrame();
  // Semilla por cuadro: las franjas saltan de verdad y el resultado es reproducible.
  const r = azar(777 + f * 37);
  const op = Math.min(prog(f, 0, 2), 1 - prog(f, dur - 3, dur));
  const saltos = [0, 1, 2, 3, 4].map((i) => ({
    top: 8 + r() * 84,
    alto: 2 + r() * 9,
    dx: (r() - 0.5) * 22 * intensidad,
    tinte: ["rgba(255,0,60,.5)", "rgba(0,255,255,.5)", "rgba(255,255,255,.35)", "rgba(255,180,0,.4)"][i % 4],
  }));
  return (
    <AbsoluteFill style={{ opacity: op, pointerEvents: "none", mixBlendMode: "screen" }}>
      {/* Desplazamiento cromático: dos copias teñidas del ruido, corridas en X */}
      {["#ff2050", "#20e0ff"].map((c, i) => (
        <div
          key={c}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: ruido,
            backgroundSize: "160px 160px",
            opacity: 0.16 * intensidad,
            transform: `translateX(${(i === 0 ? -1 : 1) * (6 + 14 * r()) * intensidad}px)`,
            filter: `hue-rotate(${i === 0 ? 300 : 160}deg)`,
          }}
        />
      ))}
      {/* Franjas que saltan */}
      {saltos.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${-6 + s.dx}%`,
            right: `${-6 - s.dx}%`,
            top: `${s.top}%`,
            height: `${s.alto}%`,
            background: s.tinte,
            mixBlendMode: "screen",
          }}
        />
      ))}
      {/* Líneas de escaneo finas */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,.10) 0 1px, transparent 1px 4px)",
          opacity: 0.5 * intensidad,
        }}
      />
    </AbsoluteFill>
  );
};
