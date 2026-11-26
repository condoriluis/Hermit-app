import { Composition } from "remotion";
import { Politica, datos } from "./Politica";

export const Root = () => (
  <Composition
    id="Politica"
    component={Politica}
    durationInFrames={Math.max(1, datos.duracion)}
    fps={datos.fps}
    width={datos.ancho}
    height={datos.alto}
  />
);
