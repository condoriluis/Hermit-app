import { Composition } from "remotion";
import { Montaje } from "./Montaje";
import datos from "./montaje.json";

export const Root = () => (
  <Composition
    id="Montaje"
    component={Montaje}
    durationInFrames={Math.max(1, datos.duracion)}
    fps={datos.fps}
    width={datos.ancho}
    height={datos.alto}
  />
);
