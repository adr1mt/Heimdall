# T211–T213 · Resultados en aula e informes individuales

2026-10-27. Base: `0499ec799e350fdf0a8aea54d6108ec704a4b1cc`.
Revisión local de los cambios de esta sesión, con datos ficticios. La petición
explícita agrupa las seis mejoras; retención y entrega se separan en commits.

## Resultado

- **T211:** controles +/−, porcentaje y ajuste automático en lista/matriz.
  ResizeObserver recalcula al redimensionar y al cambiar el contenido. Los
  controles, filtros y reloj conservan su tamaño; se ajusta el contenido.
  Resumen general plegable en proyector para reservar espacio. Casos en una
  columna más ancha, fuente adaptativa de 16–24 px (20–30 en proyector antes
  del zoom) y hasta dos líneas; el texto completo sigue en el título.
- **T212:** `begin` reinicia el progreso, conservando artefacto y ruta.
  Arranque fallido, flujo sin cierre, cancelación y lectura fallida mantienen
  los resultados anteriores. Solo un artefacto válido los sustituye. Cambio
  de contexto los limpia; una revisión invalida lecturas asíncronas antiguas.
  Hora, estado, próxima corrección y hora de la última completada visibles.
  Un fallo durante la actualización aparece discretamente junto al reloj.
- **T213:** envío desde cada fila con nombre e identificador confirmados.
  Reutiliza HTML, IPC y `deliver`; este contacta solo con los identificadores
  solicitados. Bloqueo común para envíos; registro local de éxitos para las
  últimas 100 correcciones, restaurado tras reabrir. Envío general conserva
  todos los destinatarios y confirma el reenvío; reintento solo a fallidos.
  Ayuda integrada para copiar el HTML desde Archivos de Desktop por SFTP y
  abrirlo con Firefox. SCP queda como alternativa en la guía. ADR-0037.

## Comprobaciones ejecutadas

- `GOCACHE=/tmp/heimdall-go-cache make check build`: correcto. La selección
  individual se prueba con tres alumnos: una conexión y una escritura solo
  para el elegido. Se conservan las pruebas de identidad, secretos y masivo.
- Suite GUI: **608 pruebas / 43 ficheros correctos**; tipos Node/web/tests,
  compilación Electron/renderer y verificación de preload correctos.
- Dos arneses Electron aislados: envío individual, confirmación, registro
  al navegar, reenvío masivo explícito, ayuda Desktop, retención durante
  refresco/fallo, cuenta atrás, sustitución y zoom manual/automático.
  Se comprueban también ajuste tras filtrar/ocultar/restaurar y nombres largos
  con límite de dos líneas. Matriz de 50 casos con 5/30 alumnos a 1440×900 y 1024×768 sin scroll en
  ajuste; lista ajustada. Regresiones a 390/1024/1440, claro/oscuro: ejes
  fijos, filtros, orden, ocultos, recuperación, navegación y enmascaramiento.
  Ningún error del renderer. [Pruebas nuevas](improvements-proof.json) y
  [regresiones](regression-proof.json).
- `make docs-check tools-check` y `git diff --check`: correctos.
- El aislamiento bloquea Chromium y lectura stdin de subprocesos Node:
  inicialmente cuatro tests antiguos agotaron el tiempo. Una reproducción
  mínima con spawnSync confirmó ETIMEDOUT. La suite completa y los arneses
  pasan fuera de ese aislamiento, sin modificar ni debilitar sus tests.

Capturas: [refresco sin borrado](refresh-preserves-results.png),
[ayuda Desktop](desktop-report-help.png), [ajuste completo](fit-30-1440.png)
y [proyector con resultados y controles](projector-evaluated.png).

## Límites

Ajustar cincuenta casos exige letra pequeña: no se promete lectura lejana
simultánea de un volumen arbitrario. + y filtros permiten ampliar. El nombre
de caso muy largo ocupa dos líneas y se consulta completo en su ayuda.
La privacidad se apoya en la cuenta SSH y archivo 0600: una contraseña común
conocida por los demás no aísla sus máquinas. No se introduce un servicio web
ni se cambian credenciales. La copia Desktop se documenta a partir de la
[ayuda oficial de Ubuntu](https://help.ubuntu.com/stable/ubuntu-help/nautilus-connect.html.en)
y [OpenSSH](https://man.openbsd.org/scp); no se ha operado un Ubuntu Desktop
real de alumno ni su red. No es validación de aula ni CI remota.

No se modifican notas, aserciones, pesos, denominadores ni la evaluación.
No se instala, publica ni reinicia la aplicación del profesor; no se toca
ninguna máquina real ni ningún remoto. Compilación local lista para empaquetar.


Reproducir los arneses desde `gui/`, tras `npm run build`:

```bash
node_modules/.bin/esbuild scripts/results-fixture.tsx --bundle --platform=browser --format=iife --tsconfig=tsconfig.web.json --outfile=/tmp/heimdall-results-fixture.js
node_modules/.bin/esbuild scripts/results-improvements-ui.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-improvements-ui.mjs --external:electron
node_modules/electron/dist/electron /tmp/heimdall-improvements-ui.mjs --no-sandbox
node_modules/.bin/esbuild scripts/results-ui.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-results-ui.mjs --external:electron
node_modules/electron/dist/electron /tmp/heimdall-results-ui.mjs --no-sandbox
```
