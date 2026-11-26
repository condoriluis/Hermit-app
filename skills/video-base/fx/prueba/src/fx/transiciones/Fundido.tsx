import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { prog, useAbsoluto } from "../util";

/**
 * Fundido: la escena entra y sale con opacidad. `color` (por omisión negro) permite
 * fundir a un tono — sepia, blanco de flashes, el acento del estilo.
 */
export const Fundido: React.FC<{
  children: React.ReactNode;
  desde: number;
  hasta: number;
  dur?: number;
  color?: string;
}> = ({ children, desde, hasta, dur = 10, color }) => {
  const f = useAbsoluto(desde);
  const entra = prog(f, desde, desde + dur);
  const sale = prog(f, hasta - dur, hasta);
  const op = Math.min(entra, 1 - sale);
  return (
    <AbsoluteFill style={{ opacity: op, background: color ?? undefined }}>{children}</AbsoluteFill>
  );
};
