# La pieza central, encargada a un subagente

Se lee solo cuando la biblioteca no tiene el objeto que sostiene la historia (la olla del tamal, el aparato del
baño de pies, la hogaza del pan). En cuanto sepas cuál es, lanza **un** subagente en segundo plano que lo haga a
medida, con tu mismo modelo, y este encargo tal cual (rellenando lo de `<…>`):

> sigue la skill modelos-3d (4 y 5): escríbelo en `src/modelos/<id>.tsx` de `<proyecto>`: <qué es y qué partes trae>.
> El objeto mismo llena su caja: sin mesa, piso ni base debajo (el mundo ya trae piso), porque el video lo escala por
> su caja y una mesa lo deja diminuto. Compacto, casi tan alto como ancho: lo largo va de pie (el video es vertical;
> la articulación de los dedos, dos huesos acostados, quedó una tira delgada). Con props de 0 a 1 para lo que cambia
> en la historia (<cuáles>), que se vean de frente a la cámara y a su tamaño, y una que la haga actuar sola todo el
> video mientras vale más de 0 (<la acción que no para: pica, late, gotea>; guárdala con `--actua`). Que la acción
> tenga el detalle de la vida real: lo que salta, se deshace o salpica al hacerla (las capas de la cebolla que se
> separan, el jugo, las gotitas), no solo el objeto que sube y baja. Primero, en unos 4 minutos, una versión
> que compile con todas sus props; luego guárdalo con `modelos.py guardar`. No toques nada más.

Úsala como la cosa de tu escena principal, con sus props en `anima`. Es lo que más sube un video: con ella, la escena
se arma frente al que mira; sin ella, son íconos sueltos.
