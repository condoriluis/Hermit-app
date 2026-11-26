import { Composition } from "remotion";
import { Reddit, datos } from "./Reddit";

export const Root = () => (
  <Composition
    id="Reddit"
    component={Reddit}
    durationInFrames={Math.max(1, datos.duracion)}
    fps={datos.fps}
    width={datos.ancho}
    height={datos.alto}
  />
);

