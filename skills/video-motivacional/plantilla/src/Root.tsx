import { Composition } from "remotion";
import { Motivacional, datos } from "./Motivacional";

export const Root = () => (
  <Composition
    id="Motivacional"
    component={Motivacional}
    durationInFrames={Math.max(1, datos.duracion)}
    fps={datos.fps}
    width={datos.ancho}
    height={datos.alto}
  />
);
