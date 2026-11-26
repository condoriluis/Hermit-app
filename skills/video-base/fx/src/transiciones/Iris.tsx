import React from "react";
import { AbsoluteFill } from "remotion";
import { prog, useAbsoluto } from "../util";

/**
 * Iris: la escena se abre en círculo desde el centro (o desde `cx`/`cy` en %)
 * y se cierra igual al salir — el ojo de buey del cine clásico, muy usado en
 * ganchos y remates de video corto.
 */
export const Iris: React.FC<{
  children: React.ReactNode;
  desde: number;
  hasta: number;
  dur?: number;
  cx?: number;
  cy?: number;
}> = ({ children, desde, hasta, dur = 12, cx = 50, cy = 50 }) => {
  const f = useAbsoluto(desde);
  const entra = prog(f, desde, desde + dur, (t) => t * t * (3 - 2 * t));
  const sale = prog(f, hasta - dur, hasta, (t) => t * t * (3 - 2 * t));
  const p = Math.min(entra, 1 - sale);
  const r = p * 141; // diagonal del cuadro: el círculo cubre todo al llegar a 100 %
  return (
    <AbsoluteFill style={{ clipPath: `circle(${r}% at ${cx}% ${cy}%)` }}>{children}</AbsoluteFill>
  );
};
