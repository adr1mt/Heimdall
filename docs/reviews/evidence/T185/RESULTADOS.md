# T185 · Informe por alumno

Generado con `make gui-informes` (arnés `gui/scripts/report-lab.ts`): la
aplicación construida corrige el laboratorio por SSH con cuatro alumnos
ficticios —uno con la máquina apagada— y guarda los informes desde
Resultados. Solo el diálogo de carpeta está simulado.

| Fichero | Qué enseña |
|---|---|
| `01-confirmacion.png` | Resumen antes de guardar: cuántos informes y qué no llevan |
| `02-guardado.png` | Aviso con la carpeta escrita |
| `03-informe-*.png` | Un informe por alumno: aprobado, suspensos y sin nota final |
| `04-carla-demo.pdf` | Impresión a PDF A4, una página |
| `05-informe-movil.png` | El mismo informe a 390 px de ancho |
| `verification.json` | Ficheros escritos y consola sin errores |

El arnés comprueba en cada HTML que no aparecen la contraseña, la salida de
las máquinas, el comando, la dirección del laboratorio ni el nombre de otro
alumno, y que no carga nada externo. Diego, con la máquina apagada, sale
«Sin nota final» y sin ninguna comprobación fallada.

Revisión de diseño (ui-ux-pro-max para la dirección, impeccable para el
pulido): sin rótulo encima del título, jerarquía de encabezados h1→h2 y
contraste AA en la nota. Queda a propósito la trama rayada del tramo «sin
comprobar» de la barra: lo distingue también impreso en blanco y negro.
