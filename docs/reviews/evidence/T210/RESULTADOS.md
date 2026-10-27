# T210 · Instalación de controles de aula

Instalación local autorizada expresamente por Adrià el 2026-10-27, tras la
entrega de T208. Resultado: **CORRECTO**.

## Contenido y verificaciones

- Fuente GUI: `475cc1f8c18dc100b6e73546ddee0484345a14c5`, con ocultos temporales,
  Evaluados y filtros/orden en proyector. Las 601 pruebas de GUI y el arnés
  visual de [T208](../T208/RESULTADOS.md) verifican el comportamiento.
- `GOCACHE=/tmp/heimdall-plan-go-cache make check`: correcto sobre el motor final
  T209 combinado con T208. `make gui-build`: correcto, incluido preload.
- `electron-builder --linux AppImage --publish never`: correcto. Versión
  nominal local 1.0.1, sin publicación ni cambio de remotos.
- Los **25 ficheros** compilados son idénticos byte a byte a su contenido en
  el archivo de la aplicación empaquetada. Comprobados los controles Ocultos,
  Evaluados y Ordenar alumnos en el módulo de Resultados.
- Motor del paquete idéntico tanto al extraído de la instalación anterior T209
  como a `bin/heimdall`: se conserva la reparación Kea bajo AppArmor.
- AppRun conserva argumentos y fallback probados. [Arranque real](arranque.txt)
  del paquete con perfil temporal vacío: renderer y preload correctos. Solo
  se detiene el proceso de prueba; no se abre el perfil real.

## Instalación y recuperación

[Manifest de instalación y huellas](instalacion-local.json).

Se comprueba la huella de la instalación anterior antes de preparar el cambio
y de nuevo inmediatamente antes de sustituir el archivo. Se conserva una
copia íntegra, verificada y sincronizada a disco, al lado:
`Heimdall.AppImage.antes-controles-aula-2026-10-27.bak`.

El nuevo ejecutable se copia a un archivo temporal en la misma carpeta, se
verifica su huella, conserva permisos de ejecución y se publica mediante
sustitución atómica. La instalación final coincide con el AppImage comprobado;
la copia anterior conserva su huella original. El lanzador de escritorio sigue
apuntando a `/home/adr1/Aplicaciones/Heimdall/Heimdall.AppImage`.

No se cierra ni reinicia Heimdall. Una instancia ya abierta conserva su versión;
para cargar T208 hay que cerrar y volver a abrir cuando finalice la corrección.
No se modifican clases, exámenes, perfiles, contraseñas, notas ni máquinas del
alumnado. No se ejecuta una nueva corrección real ni se certifica aula o CI.
