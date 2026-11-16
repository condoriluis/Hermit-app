// El video entero, en su formato (vertical u horizontal: `ZONA` en tema.ts): el mundo 3D (uno solo, que la cámara
// recorre de principio a fin), lo 2D del capítulo clavado en ese mundo, el texto, el personaje y la voz. Los capítulos (oscuro o claro) repintan el mismo mundo; el cambio
// desenfoca todo el cuadro y pasa por gris en ~6 cuadros (capitulos.ts). Al moverse rápido la cámara, el mundo se
// desenfoca un poco (el barrido).
import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { temaEn } from "./capitulos";
import { CAPITULOS, PERSONAJE } from "./escenas";
import { CON_PERSONAJE } from "./marca";
import { Sonidos } from "./director/Escena";
import { TRAMOS_ESCENA } from "./director/guion";
import { Titular, TITULAR } from "./director/Titular";
import { ContadorVivo } from "./director/Contador";
import { CamaraContexto, camaraDe, rapidezDe } from "./mundo/camara";
import { Escena3D } from "./mundo/Escena3D";
import { PLANOS } from "./mundo/guion";
import { Mundo } from "./mundo/Mundo";
import { Personaje } from "./piezas/Personaje";
import { Subtitulos } from "./piezas/Subtitulos";
import { TemaContexto } from "./piezas/ui";
import { FPS, FUENTES, HORIZONTAL, PALETA } from "./tema";
import { DURACION } from "./tiempo";
import { EdicionContexto, entradaEn, leerEdicion, useEdicion, type Edicion } from "./edicion";

// Las escenas del video (los lugares de momentos.json) para el monitor en vivo: el motor las lee de aquí y las pone en
// el carril Escenas de la línea de tiempo, donde se pueden elegir para pedir un cambio o editar su entrada (V8).
// En segundos, como las secuencias de Remotion.
if (typeof window !== "undefined") {
  (window as unknown as { __hermitEscenas?: unknown }).__hermitEscenas = TRAMOS_ESCENA.map((t) => ({
    escena: t.escena,
    nombre: t.escena,
    desde: Math.round((t.desde / FPS) * 1000) / 1000,
    hasta: Math.round((t.hasta / FPS) * 1000) / 1000,
  }));
}

export const Video: React.FC = () => {
  const [espera] = useState(() => delayRender("Cargando las fuentes"));
  const [listo, setListo] = useState(false);
  const [edicion, setEdicion] = useState<Edicion>({});
  useEffect(() => {
    // Las fuentes y la edición a mano (`public/edicion.json`, V8): si no está, todo queda por omisión.
    Promise.all([FUENTES, leerEdicion()]).then(([, ed]) => {
      setEdicion(ed);
      setListo(true);
      continueRender(espera);
    });
  }, [espera]);
  return listo ? (
    <EdicionContexto.Provider value={edicion}>
      <Cuadro />
    </EdicionContexto.Provider>
  ) : null;
};

const Cuadro: React.FC = () => {
  const f = useCurrentFrame();
  const ed = useEdicion();
  const t = temaEn(f);
  const Escena = CAPITULOS[t.n].Escena;
  const camara = camaraDe(PLANOS, f);
  const rapidez = rapidezDe(PLANOS, f);
  const barrido = rapidez > 7 ? Math.min(6, (rapidez - 7) * 0.12) : 0;
  const fondo = t.color("fondo");
  const conPerro = CON_PERSONAJE && f >= PERSONAJE.entra;
  // La entrada elegida a mano para esta escena (edicion.json): el desenfoque se suma al del cambio de capítulo.
  const entrada = entradaEn(f, ed);
  const borroso = Math.max(t.borroso, entrada?.tipo === "desenfoque" ? 1 - entrada.k : 0);
  return (
    <AbsoluteFill style={{ backgroundColor: fondo }}>
      <AbsoluteFill style={{ filter: borroso ? `blur(${borroso * 14}px)` : undefined }}>
        <CamaraContexto.Provider value={camara}>
          <AbsoluteFill style={{ filter: barrido ? `blur(${barrido}px)` : undefined }}>
            <Mundo planos={PLANOS}>
              <Escena3D />
            </Mundo>
            {/* El mundo se funde con el fondo donde va el texto y el personaje: arriba y abajo en vertical; en
                horizontal, en el tercio de abajo (el personaje, a la derecha, va encima del mundo). */}
            <AbsoluteFill
              style={{
                background: HORIZONTAL
                  ? `linear-gradient(transparent 0%, transparent 66%, ${fondo} 80%, ${fondo} 100%)`
                  : `linear-gradient(${fondo} 0%, ${fondo} 11%, transparent 25%, transparent ${conPerro ? 74 : 88}%, ${fondo} ${conPerro ? 96 : 100}%)`,
              }}
            />
            <TemaContexto.Provider value={t.tema}>
              <Escena />
            </TemaContexto.Provider>
          </AbsoluteFill>
        </CamaraContexto.Provider>
        {/* El gancho va en el titular, enorme; los subtítulos siguen desde la frase de después. */}
        {TITULAR && f <= TITULAR.hasta ? <Titular /> : <Subtitulos texto={t.color("texto")} tenue={t.color("tenue")} />}
        <ContadorVivo />
        {CON_PERSONAJE ? <Personaje {...PERSONAJE} /> : null}
        {borroso ? <AbsoluteFill style={{ backgroundColor: "#7a7a7a", opacity: borroso * 0.25 }} /> : null}
        {entrada && entrada.tipo !== "desenfoque" ? <Entrada entrada={entrada} fondo={fondo} /> : null}
      </AbsoluteFill>
      <Audio src={staticFile("voz.wav")} />
      <Sonidos />
      <Progreso />
    </AbsoluteFill>
  );
};

/** La entrada de una escena elegida a mano: un destello que se apaga o un fundido desde el fondo del video. */
const Entrada: React.FC<{ entrada: { tipo: "destello" | "fundido"; k: number }; fondo: string }> = ({ entrada, fondo }) => {
  const opacidad =
    entrada.tipo === "destello"
      ? interpolate(entrada.k, [0, 0.2, 1], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(entrada.k, [0, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  return <AbsoluteFill style={{ backgroundColor: entrada.tipo === "destello" ? "#ffffff" : fondo, opacity: opacidad }} />;
};

/** La barra de progreso de los videos virales: fina, arriba del cuadro entero y fuera del desenfoque de los capítulos,
 *  del color de luz del video (`luz` de la paleta). Gris neutro de fondo: se lee sobre el oscuro y sobre el claro. */
const Progreso: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, DURACION], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: "rgba(128,128,128,0.28)" }}>
      <div style={{ width: `${p * 100}%`, height: "100%", background: PALETA.luz }} />
    </div>
  );
};
