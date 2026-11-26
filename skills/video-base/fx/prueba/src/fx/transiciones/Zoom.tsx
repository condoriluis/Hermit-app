import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { prog, useAbsoluto } from "../util";

/**
 * Zoom: la escena crece desde `escala` (1,25 por omisión) al entrar y se aleja
 * hacia 1,18 al salir, con un fundido corto en los extremos — la sensación de
 * «atravesar» la imagen, típica del montaje viral.
 */
export const Zoom: React.FC<{
  children: React.ReactNode;
  desde: number;
  hasta: number;
  dur?: number;
  escala?: number;
}> = ({ children, desde, hasta, dur = 10, escala = 1.25 }) => {
  const f = useAbsoluto(desde);
  const entra = prog(f, desde, desde + dur, Easing.out(Easing.cubic));
  const sale = prog(f, hasta - dur, hasta, Easing.in(Easing.cubic));
  const s = escala - (escala - 1) * entra + 0.18 * sale;
  const op = Math.min(entra * 1.6, (1 - sale) * 1.6, 1);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})`, opacity: op }}>{children}</AbsoluteFill>
  );
};
