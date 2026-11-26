import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog } from "../util";

/**
 * BarridoCorte: una banda de luz diagonal cruza la pantalla en el corte —
 * la «light sweep» que acompaña al whoosh de audio. `color` para la banda.
 *
 *   <Sequence from={corte - 4} durationInFrames={10}><BarridoCorte color="#8ef0c8" /></Sequence>
 */
export const BarridoCorte: React.FC<{ dur?: number; color?: string }> = ({
  dur = 10,
  color = "#ffffff",
}) => {
  const f = useCurrentFrame();
  const p = prog(f, 0, dur);
  const op = Math.min(prog(f, 0, 2), 1 - prog(f, dur - 3, dur));
  // La banda cruza de -30% a 130% en el eje X, rotada 18°.
  const x = -30 + 160 * p;
  return (
    <AbsoluteFill style={{ opacity: op, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "-40%",
          bottom: "-40%",
          left: `${x}%`,
          width: "22%",
          transform: "rotate(18deg)",
          background: `linear-gradient(90deg, transparent, ${color}55 30%, ${color} 50%, ${color}55 70%, transparent)`,
          filter: "blur(6px)",
        }}
      />
    </AbsoluteFill>
  );
};
