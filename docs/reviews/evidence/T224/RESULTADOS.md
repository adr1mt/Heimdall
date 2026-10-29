# T224 · Corregir y Resultados según las referencias de aula

Petición y dos capturas de Adrià del 2026-10-29. Base:
`ddf22869ca1acad9c551c382aaa005b28d9377e4`.
Verificación de cambios locales con datos ficticios y perfil temporal.

## Resultado

- Corregir: selector de clase en cabecera, una línea con el examen y una
  tarjeta azul reconocible para el modo examen. Intervalos existentes,
  inicio/reanudación, pausa y finalización conservados. Alumnos en tres
  columnas compactas; dos/una cuando el ancho lo requiere. Sin falsas
  casillas de selección: se sigue corrigiendo toda la clase.
- Eliminadas las dos tarjetas redundantes de contexto y el bloque de cinco
  métricas del examen. Detalle de sesión plegado; sus errores se muestran
  también fuera del desplegable. Progreso general y estado de cada alumno
  permanecen visibles durante una corrección.
- Resultados: búsqueda, Lista/Matriz, exportación y menú de opciones en una
  cabecera. Opciones agrupa filtros, orden, visibilidad, informes y acciones
  de sesión, conservadas incluso cuando no hay cuenta atrás.
- Franja azul con reloj y acciones de examen; una corrección manual conserva
  su estado sin indicar que es un modo examen. Sin estadísticas ni mensajes
  permanentes de nota, como pidió Adrià en T223.
- Matriz con nombres arriba, celdas sólidas de alto contraste y fila Nota
  abajo, fija durante el desplazamiento. La mejor nota se conserva y no se
  confunde con la última comprobación. Sin nota usa un guion, la provisional
  mantiene su etiqueta; procedencia en la ayuda y evidencia en el detalle.
- Separador por ratón y teclado conservado. Proyector encaja toda la tabla,
  incluida la fila de notas; leyenda fuera de la escala para mantenerla
  legible, controles compactos sin porcentajes.

## Comprobaciones

- `GOCACHE=/tmp/heimdall-go-cache make check`: correcto.
- `npm test -- --maxWorkers=1`: **643 pruebas, 47 archivos correctos**.
  La primera ejecución concurrente con la compilación falló en la prueba de
  descarga lenta con `la descarga se ha quedado parada`; las 643 pasan en
  serie, sin modificar límites ni pruebas de descarga.
- Tipos de main, renderer y tests; build y preload: correctos.
- `make docs-check tools-check` y `git diff --check`: correctos.
- Electron: mejor nota en pie, pausa/reanudación, cierre a lista final,
  modo examen de 10 minutos, selector de clase bloqueado durante examen,
  clase de 14 alumnos visible completa antes de corregir, errores de sesión
  visibles fuera del detalle plegado, provisionales y ausencia de nota,
  ocultar/recuperar, filtros, arrastre real 402 → 492 px, teclado y remontaje.
- Se conservan los resultados durante una actualización o fallo, con aviso y
  nueva cuenta atrás. Encajar con 5/30 alumnos y 50 comprobaciones probado a
  1024×768, 1366×768 y 1920×1080, sin desbordamiento, ocupando el ancho,
  también tras filtrar y pasar a lista. + abandona el ajuste automático.
- Capturas de Corregir/Resultados a 1366×768 y 1920×1080, proyector de aula
  a 1024×768/1366×768 y tema oscuro a 1024×768. Cero errores del renderer.
  [Mediciones y aserciones](proof.json).

## Capturas

- [Corregir · 1366×768](correct-idle-1366.png).
- [Corregir · 1920×1080](correct-idle-1920.png).
- [Modo examen activo · 1366×768](correct-active-1366.png).
- [Resultados · 1366×768](teacher-1366.png).
- [Resultados · 1920×1080](teacher-1920.png).
- [Resultados oscuros · 1024×768](results-dark-1024.png).
- [Proyector de aula · 1366×768](projector-class-1366.png).
- [Proyector de aula · 1024×768](projector-class-1024.png).
- [5 alumnos/50 comprobaciones · 1024×768](projector-5-1024.png).
- [5 alumnos/50 comprobaciones · 1366×768](projector-5-1366.png).
- [30 alumnos/50 comprobaciones · 1024×768](projector-30-1024.png).

## Reproducir y límites

Desde `gui/`, tras `npm run build`:

```bash
node_modules/.bin/esbuild scripts/results-fixture.tsx --bundle --platform=browser --format=iife --tsconfig=tsconfig.web.json --outfile=/tmp/heimdall-results-fixture.js
node_modules/.bin/esbuild scripts/exam-session-fixture.tsx --bundle --platform=browser --format=iife --tsconfig=tsconfig.web.json --outfile=/tmp/heimdall-session-fixture.js
node_modules/.bin/esbuild scripts/classroom-reference-ui.ts --bundle --platform=node --format=esm --external:electron --outfile=/tmp/heimdall-reference-ui.mjs
node_modules/electron/dist/electron /tmp/heimdall-reference-ui.mjs --no-sandbox
```

Electron y tests con procesos auxiliares se ejecutan con autorización fuera del
entorno restringido, con perfil temporal y sin SSH. Las capturas cubren las
rutas; no equivalen a instalación ni prueba de aula. No se cambia el motor,
notas, criterios, compatibilidad ni persistencia. Sin intervalos nuevos,
selección parcial, instalación, push ni publicación. T223 sigue pendiente de
instalar junto a este cambio. Encajar 50 comprobaciones exige reducir la letra;
para leer de lejos se puede ampliar o filtrar.
