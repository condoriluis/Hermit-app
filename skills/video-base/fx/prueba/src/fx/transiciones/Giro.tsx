import React from "react";
import { AbsoluteFill } from "remotion";
import { prog, useAbsoluto } from "../util";

/**
 * Giro: la escena entra rotando en Y como una puerta (perspectiva incluida) y
 * sale girando al lado contrario — el «card flip» de los edits de CapCut.
 * Para giros más contenidos sin perspectiva rara, baja `grados`.
 */
export const Giro: React.FC<{
  children: React.ReactNode;
  desde: number;
  hasta: number;
  dur?: number;
  grados?: number;
}> = ({ children, desde, hasta, dur = 10, grados = 70 }) => {
  const f = useAbsoluto(desde);
  const entra = prog(f, desde, desde + dur);
  const sale = prog(f, hasta - dur, hasta);
  const ry = grados * (1 - entra) - grados * sale;
  const op = Math.min(entra * 1.4, (1 - sale) * 1.4, 1);
  return (
    <AbsoluteFill style={{ perspective: 1200, transformStyle: "preserve-3d" }}>
      <AbsoluteFill
        style={{
          transform: `rotateY(${ry}deg)`,
          opacity: op,
          backfaceVisibility: "hidden",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
