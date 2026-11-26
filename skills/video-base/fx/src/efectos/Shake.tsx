import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { azar, prog } from "../util";

/**
 * Shake: temblor de cámara que decae — el impacto de un golpe, un landing o un
 * susto. Envuelve el contenido de la escena (igual que las transiciones:
 * `desde` es el cuadro absoluto del inicio de su Sequence). `en` es el cuadro
 * absoluto del golpe (por omisión, el inicio de la escena); `intensidad` en px.
 */
export const Shake: React.FC<{
  children: React.ReactNode;
  desde: number;
  en?: number;
  dur?: number;
  intensidad?: number;
}> = ({ children, desde, en, dur = 14, intensidad = 12 }) => {
  const f = useCurrentFrame() + desde;
  const golpe = en ?? desde;
  // Semilla por cuadro: el jitter cambia en cada frame y es idéntico en cada render.
  const r = azar(4242 + golpe * 131 + f);
  const amp = intensidad * (1 - prog(f, golpe, golpe + dur));
  // Temblor pseudo-aleatorio pero determinista: dos senos descuadrados + ruido por cuadro.
  const t = f - golpe;
  const dx =
    amp * (Math.sin(t * 2.1) * 0.6 + (r() - 0.5) * 0.8) * (t >= 0 ? 1 : 0);
  const dy =
    amp * (Math.cos(t * 1.7) * 0.6 + (r() - 0.5) * 0.8) * (t >= 0 ? 1 : 0);
  return (
    <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px)` }}>{children}</AbsoluteFill>
  );
};
