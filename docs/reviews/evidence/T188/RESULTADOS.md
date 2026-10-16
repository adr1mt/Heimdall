# T188 · El informe en la máquina de cada alumno

Generado con `make gui-informes` (arnés `gui/scripts/report-lab.ts`): la
aplicación construida corrige el laboratorio por SSH con cuatro alumnos
ficticios, cada uno con su máquina —tres contenedores de la imagen del
laboratorio en 2201-2203 y Diego con la máquina apagada— y envía los informes
desde Resultados. Solo el diálogo de carpeta está simulado.

| Fichero | Qué enseña |
|---|---|
| `01-confirmacion.png` | Antes de enviar: cuántos, qué fichero, dónde, que sustituye y qué no lleva |
| `02-resultado.png` | 3 de 4: Diego no lo recibe porque su máquina no respondió al corregir |
| `03-maquina-apagada-al-enviar.png` | «Volver a enviar» con la máquina de Carla apagada: 2 de 4, con el motivo, en 4,7 s |
| `04-informe-en-la-maquina-de-bruno.png` | El fichero leído de la máquina de Bruno con `podman exec` |
| `05-informe-movil.png` | El mismo informe a 390 px |
| `verification.json` | Resumen de la ejecución |

El arnés lee cada fichero de cada máquina con `podman exec`, sin pasar por
Heimdall, y comprueba: permisos `644` y dueño `alumno`; ningún temporal
olvidado; el informe viejo de Ana sustituido; solo el nombre de su alumno; ni
contraseña, ni salida de las máquinas, ni comando, ni dirección. Mientras se
envía, recorre `/proc/*/cmdline` cada 20 ms: el motor aparece y ningún proceso
lleva la contraseña (salvo la shell de `make`, que la recibe del propio
Makefile y queda excluida). Al final, `grep -r` de la contraseña en todo el
directorio de la prueba solo encuentra `classes.json`, donde la guarda la clase
(ADR-0030).

Revisión de las capturas: los textos dicen qué se deja, dónde y que sustituye;
el resultado separa «No le ha llegado» (con motivo) de «Le ha llegado».
El motivo de una conexión fallida es la frase técnica del motor (`connection
refused`); se deja así porque es la misma que ya ve el profesor en Resultados.
