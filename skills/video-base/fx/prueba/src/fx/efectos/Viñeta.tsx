import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * Viñeta: oscurece los bordes para cine y para que el texto se lea sobre
 * cualquier material. `intensidad` 0-1, `respira` la hace latir muy despacio
 * (determinista). Se monta como overlay fijo encima de todo el video.
 */
export const Viñeta: React.FC<{ intensidad?: number; respira?: boolean }> = ({
  intensidad = 0.42,
  respira = false,
}) => {
  const f = useCurrentFrame();
  const pulso = respira ? 0.85 + 0.15 * Math.sin((f / 90) * Math.PI * 2) : 1;
  const op = intensidad * pulso;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(115% 100% at 50% 45%, transparent 52%, rgba(0,0,0,${op}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
};
