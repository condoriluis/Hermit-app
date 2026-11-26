import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { Dir, prog, useAbsoluto, vector } from "../util";

/**
 * Empuje: la escena entra deslizándose desde `dir` y sale empujada hacia el lado
 * contrario, como los expeditores de las películas. Es la transición del recap
 * (video-propio la tiene propia; esta es la versión del kit para cualquier estilo).
 *
 * Uso: la escena va en una <Sequence from={L} durationInFrames={R-L}> y el wrapper
 * recibe `desde={L}` y `hasta={R}` (cuadros absolutos). Las escenas vecinas se montan
 * con `dur` cuadros de solape — igual que en Montaje.tsx.
 */
export const Empuje: React.FC<{
  children: React.ReactNode;
  desde: number;
  hasta: number;
  dur?: number;
  dir?: Dir;
}> = ({ children, desde, hasta, dur = 10, dir = "izquierda" }) => {
  const f = useAbsoluto(desde);
  const [ex, ey] = vector(dir);
  // Entra desde el lado `dir`; sale hacia el lado contrario (empuje continuo).
  const entra = prog(f, desde, desde + dur, Easing.out(Easing.cubic));
  const sale = prog(f, hasta - dur, hasta, Easing.in(Easing.cubic));
  const x = ex * (1 - entra) - ex * sale;
  const y = ey * (1 - entra) - ey * sale;
  return (
    <AbsoluteFill style={{ transform: `translate(${x}%, ${y}%)` }}>{children}</AbsoluteFill>
  );
};
