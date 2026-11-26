import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog } from "../util";

/**
 * ZoomCorte: estelas radiales que explotan desde el centro en el corte — el
 * «zoom blur» de los edits de acción. Convergen y se apagan en `dur` cuadros.
 * `color` para las estelas (blanco por omisión).
 *
 *   <Sequence from={corte - 4} durationInFrames={9}><ZoomCorte color="#ffd23f" /></Sequence>
 */
export const ZoomCorte: React.FC<{ dur?: number; color?: string; intensidad?: number }> = ({
  dur = 9,
  color = "#ffffff",
  intensidad = 1,
}) => {
  const f = useCurrentFrame();
  const op = Math.min(prog(f, 0, 2), 1 - prog(f, dur - 4, dur));
  const giro = f * 14 * intensidad;
  return (
    <AbsoluteFill style={{ opacity: op, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "260vmax",
          height: "260vmax",
          transform: `translate(-50%, -50%) rotate(${giro}deg)`,
          background: `repeating-conic-gradient(from 0deg, transparent 0deg 9deg, ${color}33 9deg 10.5deg, transparent 10.5deg 20deg)`,
          WebkitMaskImage:
            "radial-gradient(circle at center, transparent 0%, transparent 22%, black 60%, black 100%)",
          maskImage:
            "radial-gradient(circle at center, transparent 0%, transparent 22%, black 60%, black 100%)",
        }}
      />
      {/* Núcleo que late */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "34vmax",
          height: "34vmax",
          transform: `translate(-50%, -50%) scale(${0.6 + 0.5 * (1 - op)})`,
          background: `radial-gradient(circle, ${color}cc 0%, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
