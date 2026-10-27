# T215 · Todos reciben informe.html

2026-10-27. Base: `7f28731`. Solicitud explícita del profesor; cambio de nombre
acotado e instalación local. Resultado: **CORRECTO**.

## Comportamiento

La GUI entrega siempre `informe.html`, por fila y en el envío masivo. El
contenido sigue siendo individual y el título real del examen se conserva.
La confirmación avisa de que cada nuevo envío sustituye el anterior, incluso
si corresponde a otro examen. La ayuda usa el nombre fijo y Ctrl+L en Archivos.

El motor admite el nombre fijo, conserva los nombres anteriores válidos y
rechaza rutas, otros archivos y comandos. No cambia su escritor: reemplazo
atómico y permisos 0600. Los archivos antiguos no se borran. Se cambia la
clave del registro de envíos: un recibo del antiguo nombre no prueba que exista
el nuevo archivo. Las nuevas entregas mantienen la protección contra duplicados.
Decisión documentada en ADR-0038, sin alterar notas ni contenido del HTML.

## Pruebas e instalación

- `GOCACHE=/tmp/heimdall-go-cache make check build`: correcto. Los envíos
  individual y masivo de las pruebas usan `informe.html`, manteniendo el
  aislamiento por alumno. Nombres anteriores y rechazo de rutas probados.
- **609 tests GUI / 43 ficheros correctos**. Nombre fijo, contenido HTML y
  nueva entrega tras recibos de la versión anterior probados.
- Tipos Node/web/tests, build, preload y AppImage correctos.
- 26 ficheros GUI del paquete idénticos a los compilados; nombre fijo presente
  y motor incorporado idéntico a `bin/heimdall`. AppRun verificado y arranque
  real con perfil temporal: `Package auto: renderer and preload OK (Heimdall)`.
- [Manifest con huellas de instalación y copia anterior](instalacion-local.json).
  Sustitución atómica de `/home/adr1/Aplicaciones/Heimdall/Heimdall.AppImage`,
  copia sincronizada y verificada `Heimdall.AppImage.antes-informe-fijo-2026-10-27.bak`.
- `make docs-check tools-check` y `git diff --check`: correctos.

No se cierra ni reinicia la instancia activa, ni se abren perfiles reales o
se envían informes al alumnado durante la prueba. Para cargar el cambio:
cerrar/abrir cuando termine la corrección y volver a enviar el informe deseado.
No se publica, se cambia la versión nominal ni se modifican remotos.
