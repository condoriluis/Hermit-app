import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog } from "../util";

/**
 * FlashCorte: destello de pantalla en el corte — `color` (blanco por omisión, o
 * el acento del estilo) sube de golpe y se apaga en `dur` cuadros. Se monta en
 * una <Sequence> que cubre el corte, ENCIMA de las escenas:
 *
 *   <Sequence from={corte - 3} durationInFrames={9}><FlashCorte color="#fff" /></Sequence>
 */
export const FlashCorte: React.FC<{ dur?: number; color?: string; pico?: number }> = ({
  dur = 8,
  color = "#ffffff",
  pico = 0.85,
}) => {
  const f = useCurrentFrame();
  const op = pico * (1 - prog(f, 0, dur, (t) => t));
  return (
    <AbsoluteFill
      style={{ background: color, opacity: op, mixBlendMode: "screen", pointerEvents: "none" }}
    />
  );
};
