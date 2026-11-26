// El estilo publicidad se dibuja con HTML y CSS (los textos con su contorno, el paneo de las fotos, la
// tarjeta de marca): con la tarjeta de video (ANGLE) va más rápido que por software y se ve igual.
import { Config } from "@remotion/cli/config";

Config.setChromiumOpenGlRenderer("angle");
