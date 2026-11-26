import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { azar } from "../util";

const ruido =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>\")";

/**
 * Grano: grano de película animado — la textura que hace que un render se vea
 * rodado. Salta cada 3 cuadros con semilla determinista (el mismo grano en cada
 * render). `intensidad` 0-1, `tamano` del mosaico en px.
 */
export const Grano: React.FC<{ intensidad?: number; tamano?: number }> = ({
  intensidad = 0.05,
  tamano = 240,
}) => {
  const f = useCurrentFrame();
  const paso = Math.floor(f / 3);
  const r = azar(paso * 7919 + 13);
  const x = Math.floor(r() * tamano);
  const y = Math.floor(r() * tamano);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: ruido,
        backgroundSize: `${tamano}px ${tamano}px`,
        backgroundPosition: `${x}px ${y}px`,
        opacity: intensidad,
        pointerEvents: "none",
        mixBlendMode: "overlay",
      }}
    />
  );
};
