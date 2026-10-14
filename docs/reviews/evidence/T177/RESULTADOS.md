# T177 · Aviso de resultados y verificación básica

Fecha: 2026-10-14. Base: `bc6af1930b645dd72bad251eb3a8d84521fa3aa8`.
Petición: mejoras sencillas para corregir y proyectar; sin cambios de IP,
notas, copias ni contrato. Adrià autoriza commit y push.

## Resultado

Si falla la lectura del resultado al terminar, el aviso aparece en la pantalla
actual y también en modo proyector. Antes se guardaba el error solo para
Resultados, pero la navegación a esa pantalla ocurría únicamente si la lectura
tenía éxito. Se conserva el error de Resultados y se usa el aviso global ya
existente. Se sustituye el texto obsoleto «siguiente entrega».

## Evidencia

- `GOCACHE=/tmp/heimdall-audit-go make check`: vet y todas las pruebas Go pasan.
- `make gui-check`, con procesos hijos permitidos: tipos correctos y **531/531**.
- `make gui-build`: compilación y verificación de preload correctas.
- `npx vitest run tests/shutdown.test.ts tests/backup-recovery.test.ts --maxWorkers=1`:
  **13/13** con procesos hijos permitidos. Incluye cancelar al cerrar, esperar
  las copias, avisar si falla su destino y recuperar sin sobrescribir originales.
- Los cuatro fallos de la auditoría se reprodujeron dentro del sandbox.
  Un proceso Node mínimo con `spawnSync` devolvió `EPERM`; con permiso de ejecución
  ampliado las pruebas pasaron sin modificar el producto ni sus tests.
- Arnés Electron: reproduce el fallo antes del cambio (no encuentra el aviso
  visible) y pasa después, tanto normal como proyectando. La lectura correcta
  sigue navegando a Resultados. Ventana real con preload y renderer compilados;
  evento final y lectura controlados, perfil temporal, sin SSH ni datos reales.
- Capturas inspeccionadas tras completar las animaciones:
  [aviso proyectado](notice-projector.png) y [resultados proyectados](results-projector.png).

Reproducir desde `gui/` después de `make gui-build`:

```bash
./node_modules/.bin/esbuild scripts/results-notice.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-results-notice.mjs --external:electron
./node_modules/electron/dist/electron /tmp/heimdall-results-notice.mjs --no-sandbox
```

Necesita sesión gráfica y permiso para procesos hijos. `--no-sandbox` se usa
solo en el arnés local; no modifica la configuración del producto. Las capturas
se escriben en `/tmp/heimdall-results-notice` (o `NOTICE_OUT`).

## Límites y siguiente validación

No se ha ejecutado un examen contra las máquinas de GISAR ni probado un
proyector físico. T070 y T084 mantienen esa validación pendiente. Al probar en
el aula: corregir un examen real, incluir una máquina apagada y una contraseña
incorrecta, detener una corrección y volver a abrir sus resultados; comprobar
la lectura desde el fondo de clase. El arnés visual no certifica ese recorrido
SSH ni la legibilidad del proyector del aula.

No se añade un nuevo sistema de copias ni recuperación. Las copias automáticas
siguen guardando notas sin salidas en el directorio de datos de la aplicación.
