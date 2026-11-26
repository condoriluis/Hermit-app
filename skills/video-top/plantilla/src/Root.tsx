import { Composition } from "remotion";
import { Top, datos } from "./Top";

export const Root = () => (
  <Composition
    id="Top"
    component={Top}
    durationInFrames={Math.max(1, datos.duracion)}
    fps={datos.fps}
    width={datos.ancho}
    height={datos.alto}
  />
);
