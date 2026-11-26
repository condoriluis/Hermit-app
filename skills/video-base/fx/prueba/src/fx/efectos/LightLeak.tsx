import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog } from "../util";

/**
 * LightLeak: la fuga de luz cálida de las cámaras viejas — dos manchas de
 * gradiente (naranja/rosa) que derivan despacio y se mezclan con `screen`.
 * `dur` es el ciclo completo en cuadros (por omisión ~12 s a 30 fps); la pieza
 * se repite sola si el video es más largo. `intensidad` 0-1.
 */
export const LightLeak: React.FC<{ intensidad?: number; dur?: number }> = ({
  intensidad = 0.5,
  dur = 360,
}) => {
  const f = useCurrentFrame();
  const p = (f % dur) / dur; // ciclo determinista
  // Dos manchas cruzan la pantalla en direcciones opuestas con vaivén suave.
  const a = Math.sin(p * Math.PI * 2);
  const b = Math.sin(p * Math.PI * 2 + Math.PI);
  const op = intensidad * (0.55 + 0.45 * Math.sin(p * Math.PI * 4));
  const blob = (cx: number, cy: number, color: string, s: number) => (
    <div
      style={{
        position: "absolute",
        left: `${cx}%`,
        top: `${cy}%`,
        width: `${s}vmax`,
        height: `${s * 0.7}vmax`,
        transform: "translate(-50%, -50%)",
        background: `radial-gradient(ellipse, ${color} 0%, transparent 70%)`,
        filter: "blur(30px)",
      }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity: op, pointerEvents: "none", mixBlendMode: "screen" }}>
      {blob(20 + 30 * a, 25 + 15 * b, "rgba(255,140,40,.55)", 55)}
      {blob(75 - 25 * b, 70 - 20 * a, "rgba(255,60,140,.4)", 48)}
      {blob(50 + 20 * b, 85 - 15 * a, "rgba(255,210,120,.35)", 40)}
    </AbsoluteFill>
  );
};
