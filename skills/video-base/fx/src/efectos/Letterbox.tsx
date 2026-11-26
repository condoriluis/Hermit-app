import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog } from "../util";

/**
 * Letterbox: las barras de cine que entran en `dur` cuadros y se quedan —
 * para el momento épico o el cierre. `alto` es la fracción del cuadro que
 * tapa cada barra (0,11 ≈ cinemascope). Se monta en una <Sequence> que cubre
 * el tramo cinematográfico.
 */
export const Letterbox: React.FC<{ dur?: number; alto?: number; color?: string }> = ({
  dur = 15,
  alto = 0.11,
  color = "#000",
}) => {
  const f = useCurrentFrame();
  const p = prog(f, 0, dur, (t) => 1 - Math.pow(1 - t, 3));
  const h = `${alto * 100 * p}%`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: h, background: color }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: h, background: color }} />
    </AbsoluteFill>
  );
};
