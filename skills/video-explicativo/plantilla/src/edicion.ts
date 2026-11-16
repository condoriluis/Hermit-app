// La edición a mano del video (`public/edicion.json`, lo escribe el usuario desde Hermit, V8): lo que cambia del estilo
// sin tocar el guion. Si el archivo no está (un video de antes), todo queda por omisión. La página del motor la lee una
// vez al abrir (`Video.tsx`) y la sirve `staticFile` igual en el render.
import { createContext, useContext } from "react";
import { staticFile } from "remotion";
import { TRAMOS_ESCENA } from "./director/guion";

/** Lo que se puede retocar de los subtítulos; lo que no se dice, va como el estilo lo trae. */
export type SubtitulosEdicion = {
  /** El tamaño de la letra en px (74 por omisión). */
  tamano?: number;
  /** El color del texto (#rrggbb); sin él, el del tema. */
  color?: string;
  /** La fuente: figtree (la del estilo), mono o marcador; sin ella, figtree. */
  fuente?: "figtree" | "mono" | "marcador";
  /** Cuánto se corre el texto en horizontal y en vertical, en px. */
  desplazaX?: number;
  desplazaY?: number;
};

/** Cómo se entra a una escena del video (`TRAMOS_ESCENA` de momentos.json); sin entrada, el corte seco de siempre. */
export type Entrada = "desenfoque" | "destello" | "fundido";
export type EscenaEdicion = { entrada?: Entrada };

export type Edicion = { subtitulos?: SubtitulosEdicion; escenas?: Record<string, EscenaEdicion> };

/** Cuánto dura cada entrada, en cuadros. */
const DURACION_ENTRADA: Record<Entrada, number> = { desenfoque: 8, destello: 10, fundido: 14 };

/** La entrada que toca en este cuadro: `k` de 0 (recién entra) a 1 (ya está), o null. El `desenfoque` va con el del
 *  cambio de capítulo; `destello` y `fundido` se dibujan como capa encima. */
export type EntradaFx = { tipo: "desenfoque"; k: number } | { tipo: "destello" | "fundido"; k: number };
export const entradaEn = (f: number, ed: Edicion): EntradaFx | null => {
  for (const t of TRAMOS_ESCENA) {
    const tipo = ed.escenas?.[t.escena]?.entrada;
    // Un edicion.json editado a mano puede traer algo que no está en la lista: se ignora, no rompe el render.
    if (!tipo || !(tipo in DURACION_ENTRADA)) continue;
    const d = f - t.desde;
    if (d < 0 || d >= DURACION_ENTRADA[tipo]) continue;
    const k = d / DURACION_ENTRADA[tipo];
    return tipo === "desenfoque" ? { tipo, k } : { tipo, k };
  }
  return null;
};

export const EdicionContexto = createContext<Edicion>({});
export const useEdicion = () => useContext(EdicionContexto);

/** Lee `public/edicion.json`; si no está o no es un objeto, vacío (los videos de antes no lo traen). */
export const leerEdicion = async (): Promise<Edicion> => {
  try {
    const r = await fetch(staticFile("edicion.json"));
    if (!r.ok) return {};
    const d = await r.json();
    return d && typeof d === "object" && !Array.isArray(d) ? (d as Edicion) : {};
  } catch {
    return {};
  }
};
