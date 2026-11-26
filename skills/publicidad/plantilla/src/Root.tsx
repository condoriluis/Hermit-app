import { Composition } from "remotion";
import { Publicidad, datos } from "./Publicidad";

export const Root = () => (
  <Composition
    id="Publicidad"
    component={Publicidad}
    durationInFrames={Math.max(1, datos.duracion)}
    fps={datos.fps}
    width={datos.ancho}
    height={datos.alto}
  />
);
