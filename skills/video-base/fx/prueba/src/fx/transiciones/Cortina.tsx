import React from "react";
import { AbsoluteFill } from "remotion";
import { Dir, prog, useAbsoluto } from "../util";

/**
 * Cortina: la escena se revela por un barrido (clip-path) — entra desde un lado
 * y se cierra hacia el contrario al salir, como una cortina de cine o un
 * limpiaparabrisas. `dir` es el lado por donde empieza a abrirse.
 */
export const Cortina: React.FC<{
  children: React.ReactNode;
  desde: number;
  hasta: number;
  dur?: number;
  dir?: Dir;
}> = ({ children, desde, hasta, dur = 12, dir = "izquierda" }) => {
  const f = useAbsoluto(desde);
  const entra = prog(f, desde, desde + dur);
  const sale = prog(f, hasta - dur, hasta);
  // clip-path inset: 100% del lado de entrada → 0 al abrirse; al salir se cierra al lado opuesto.
  const clip = (p: number, lado: "i" | "d", vertical: boolean) => {
    if (vertical) return `inset(${lado === "i" ? 100 * (1 - p) : 0}% 0 ${lado === "d" ? 100 * (1 - p) : 0}% 0)`;
    return `inset(0 ${lado === "i" ? 100 * (1 - p) : 0}% 0 ${lado === "d" ? 100 * (1 - p) : 0}%)`;
  };
  const abre = clip(entra, dir === "arriba" || dir === "izquierda" ? "i" : "d", dir === "arriba" || dir === "abajo");
  const cierra = clip(1 - sale, dir === "abajo" || dir === "derecha" ? "i" : "d", dir === "abajo" || dir === "arriba");
  return (
    <AbsoluteFill style={{ clipPath: sale > 0 ? cierra : abre }}>{children}</AbsoluteFill>
  );
};
