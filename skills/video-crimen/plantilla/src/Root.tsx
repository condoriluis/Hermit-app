import { Composition } from "remotion";
import { Crimen, datos } from "./Crimen";

export const Root = () => (
  <Composition
    id="Crimen"
    component={Crimen}
    durationInFrames={Math.max(1, datos.duracion)}
    fps={datos.fps}
    width={datos.ancho}
    height={datos.alto}
  />
);
