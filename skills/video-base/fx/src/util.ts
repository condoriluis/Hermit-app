import { interpolate, Easing, useCurrentFrame } from "remotion";

/** Helpers del kit fx: todos los componentes son funciones puras del cuadro (deterministas). */

/** PRNG con semilla (mulberry32): el "aleatorio" del grano y los leaks es el mismo en cada render. */
export function azar(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Progreso 0→1 entre dos cuadros absolutos, con easing suave y topes. */
export function prog(f: number, a: number, b: number, easing = Easing.inOut(Easing.cubic)): number {
  return interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

/** Cuadro absoluto: dentro de una <Sequence>, useCurrentFrame() es local; `desde` lo hace absoluto. */
export function useAbsoluto(desde: number): number {
  return useCurrentFrame() + desde;
}

/** Direcciones válidas para empujes y cortinas. */
export type Dir = "izquierda" | "derecha" | "arriba" | "abajo";

/** Vector de salida (en %) para una dirección: de dónde entra y hacia dónde sale la escena. */
export function vector(dir: Dir): [number, number] {
  switch (dir) {
    case "izquierda":
      return [110, 0];
    case "derecha":
      return [-110, 0];
    case "arriba":
      return [0, 110];
    case "abajo":
      return [0, -110];
  }
}
