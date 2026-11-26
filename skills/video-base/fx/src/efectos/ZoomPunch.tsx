import React from "react";
import { AbsoluteFill } from "remotion";
import { prog, useAbsoluto } from "../util";

/**
 * ZoomPunch: el «zoom punch» de los edits — un acercamiento rápido con salida
 * elástica en el cuadro `en` (un golpe de batería, una palabra clave). Envuelve
 * el contenido de la escena.
 */
export const ZoomPunch: React.FC<{
  children: React.ReactNode;
  desde: number;
  en?: number;
  pico?: number;
  dur?: number;
}> = ({ children, desde, en, pico = 1.14, dur = 9 }) => {
  const f = useAbsoluto(desde);
  const golpe = en ?? desde;
  const s = 1 + (pico - 1) * Math.sin(Math.PI * Math.min(Math.max((f - golpe) / dur, 0), 1));
  return <AbsoluteFill style={{ transform: `scale(${s})` }}>{children}</AbsoluteFill>;
};
