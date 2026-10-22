# T190 · La GUI con Tailwind CSS 4

Comparación de la app compilada antes (commit `c057272`, Tailwind 3) y después
(Tailwind 4), sin capturas en el repositorio: se generan de nuevo con los
arneses y se comparan píxel a píxel.

## Cómo se comparó

- **Secciones vacías**: las 9 secciones de la barra lateral, en claro y oscuro,
  con un proyecto y una clase temporales y sin motor.
- **Con datos**: el arnés `gui/scripts/ui-refresh.ts` (con la carpeta de
  salida cambiada) contra el laboratorio SSH `make lab` y el motor de
  `make build`. Hace una corrección real de 5 alumnos (100/80/60/40/20) y
  captura 16 pantallas: editor, Corregir, Resultados en lista y matriz, detalle
  de alumno, analíticas, ajustes, ayuda, edición de clase, proyector, tema
  claro, alumno con la máquina apagada y modo examen. Las dos versiones pasan
  todas sus aserciones y no registran errores de consola.
- En cada captura se guardaron, además, la posición y los estilos calculados
  de todos los elementos, y se compararon elemento a elemento.

## Resultado

Tres ejecuciones de cada versión. Salvo lo que cambia con los datos de cada
ejecución, v3 y v4 dan los mismos píxeles en todas las pantallas:

- rutas temporales (validación del editor, Ajustes) y horas (modo examen,
  fecha de la corrección);
- la barra de desplazamiento de Monaco en el editor claro, que aparece o no
  según el momento de la captura también entre dos ejecuciones de v3;
- en el proyector, alturas 0,016 px menores por el redondeo del interlineado,
  sin cambio visible.

## Lo que hubo que corregir a mano

- La herramienta oficial renombró la variante `'outline'` de botones e
  insignias a `'outline-solid'` y cambió `rounded-[0.25rem]` del control
  segmentado por `rounded-lg`, que en este tema mide 8 px.
- La base de v4 quita el relleno de 1 px de las celdas de tabla: cada fila de
  la matriz, de la clase y de las analíticas bajaba 2 px.
- `space-y-*` pone ahora el margen en el hijo anterior: ese margen pierde
  frente al `mb-3` del título de sección y no tiene efecto sobre un `<span>` en
  línea. Afectaba a tres sitios de Clases.
- Cursor de mano en botones, gris de los placeholder y color de borde por
  defecto de v3, con los selectores exactos de v3.

`npm audit`: ningún aviso de Tailwind; quedan los 8 moderados de
`electron-builder` (`sprintf-js`), fuera de esta tarea.

No queda comprobado en imagen el anillo de foco por teclado: el evento
sintético no activa `:focus-visible`. No hay ningún `ring` sin anchura, y los
`ring-2` generan el mismo anillo de 2 px con color explícito que en v3.
