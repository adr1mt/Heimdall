# T191 · Resultados compactos y explorables

Fecha: 2026-10-22. Base: `20eeba88d93e8130f74d8abbb082d7f4305d92d4`.
Al empezar: árbol limpio; `git fetch origin` y comparación de `HEAD` con
`origin/main`: 0 commits por delante y 0 por detrás.

## Resultado

- Una sola cabecera con nombre completo (hasta dos líneas), nota de 20 px
  semibold, escala secundaria y estado escrito. Desaparece la fila «Nota».
- Celdas discretas con los símbolos existentes, seguimiento de fila y columna
  al pasar el ratón o enfocar, y recuento superados/alumnos visibles. Los pesos
  distintos de 1 siguen visibles; todos se conservan en el texto de ayuda.
- La tercera lectura muestra la comprobación con más fallos, número de fallos,
  evaluados y empates. Reutiliza `failingChecks`: los problemas técnicos no se
  cuentan como fallos académicos. El resumen sigue referido a toda la clase.
- Filtros visibles de alumnos: Todos, Aprobados, Suspensos y Sin evaluar
  (incluye provisionales y pendientes). Los excluidos solo aparecen en Todos.
  Los filtros de comprobaciones y causas siguen en su propio desplegable.
- Lista y matriz comparten selección de alumnos y orden por nombre, nota en
  ambos sentidos o más comprobaciones falladas. Las notas ausentes van al
  final; los fallos se cuentan sobre el alumno completo. Estado activo y
  Restablecer visibles. Se conserva el acceso al detalle por nombre o celda.
- Scroll propio con columnas de al menos 9 rem, primera columna y cabecera
  fijas, fondos opacos y capas separadas. Nombres truncados conservan el nombre
  completo en la etiqueta accesible, el tooltip y la vista individual.

## Causa y corrección de la media

La escala existente es no lineal: une 0, el aprobado en 5 y el máximo en 10.
Antes se promediaban los porcentajes canónicos y después se convertía la media.
Para 100, 80, 60, 40 y 20 daba 60, que la escala escribe como 4,3.

Ahora se promedian las notas finales que el profesor ve: 10,0; 6,7; 4,3; 2,9
y 1,4 → **5,06**. Se excluyen provisionales, ausentes y excluidos; se incluye
el cero final. Se aplica también al resumen de Analíticas para que coincidan.
La media se presenta con dos decimales y redondeo aritmético (5,975 → 5,98).
No cambia ninguna nota individual, umbral, escala, exportación ni artefacto.

## Comprobaciones

- `make check`: Go vet y suite rápida correctos.
- `npm run typecheck`: node, web y tests correctos; no hay script de lint en
  este repositorio. TypeScript aplica las comprobaciones estrictas existentes.
- `npm test`: 549 pruebas correctas en 34 ficheros; cubre también informes, CSV, Moodle,
  integridad de notas, estados, copias y el corpus compartido.
- `npm run build`: compilación de main, preload y renderer correcta;
  verificación del preload CommonJS y su ruta correcta.
- `make docs-check` y `make tools-check`: enlaces y herramientas correctos.
- `git diff --check`: sin errores.
- Nuevas pruebas: media no lineal y redondeo, escala/umbral configurables,
  exclusión de provisionales/ausentes/excluidos, cero real, filtros por alumno,
  ordenación sin mutación, empates, filtros combinados y fallos de todo el alumno.

En el aislamiento inicial, las pruebas que arrancan otro Node agotaron sus
5 segundos (`spawnSync /usr/bin/node ETIMEDOUT`) y algunas pruebas de cierre
agotaron el mismo límite. Repetidas fuera de ese aislamiento pasan completas,
sin alterar tests ni sus límites.

## Verificación visual e interacción

Arnés `gui/scripts/results-ui.ts` y datos ficticios en
`gui/scripts/results-fixture.tsx`. Renderiza el componente real de Resultados
con los estilos de producción, en una ventana Electron y un perfil temporal.
No abre proyectos reales ni ejecuta IPC de exportación o envío.

5 y 30 alumnos × 50 comprobaciones × claro/oscuro × 1440×900, 1024×768 y
390×844. Se comprueban por geometría ambos ejes de scroll, ausencia de overflow
de página, una sola fila de cabecera y fijación de cabecera/primera columna.
En las doce combinaciones, desviación de ambas esquinas: **0 px**; la esquina
queda por encima de los datos (`elementFromPoint`). Véase [proof.json](proof.json).

El arnés prueba además Aprobados/Suspensos/Sin evaluar, las dos vistas con el
mismo filtro, los cuatro órdenes, Restablecer, nombre → detalle → volver, y la
intersección de filtro de alumno con comprobaciones falladas. Sin errores de
consola. Cada captura comprueba que su píxel de fondo coincide con el tema
calculado, después de esperar al compositor de Electron. Revisión de ambas capturas iniciales y de los tamaños/temas finales;
los estados mantienen texto y símbolos además del color.

Capturas representativas:

- Antes: [claro](antes-5-1440-light.png), [oscuro](antes-5-1440-dark.png).
- Después: [5 alumnos, claro](5-1440-light.png), [5 alumnos, oscuro](5-1440-dark.png).
- Portátil: [30 alumnos, scroll, claro](30-1024-light-scroll.png),
  [oscuro](30-1024-dark-scroll.png).
- Móvil: [5 alumnos, claro](5-390-light.png), [oscuro](5-390-dark.png),
  [30 alumnos con scroll](30-390-dark-scroll.png).

Estado sin nota: [alumna sin evaluar](incomplete.png). Las capturas finales
incluyen el ajuste de redondeo de medias a mitad de centésima.

Para reproducir desde `gui/`, después de `npm run build`:

```bash
node_modules/.bin/esbuild scripts/results-fixture.tsx --bundle --platform=browser --format=iife --tsconfig=tsconfig.web.json --outfile=/tmp/heimdall-results-fixture.js
node_modules/.bin/esbuild scripts/results-ui.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-results-ui.mjs --external:electron
RESULTS_UI_OUT=/tmp/heimdall-results-ui node_modules/electron/dist/electron /tmp/heimdall-results-ui.mjs --no-sandbox
```

## Límites

Verificación de viewport móvil en Electron de Linux, sin dispositivo táctil
real ni lector de pantalla. El arnés aísla esta pantalla: no sustituye una
corrección SSH real ni comprueba nuevos envíos. Las rutas de exportación,
informes y corrección conservan su implementación y su suite existente.
Sin dependencias nuevas ni cambios al motor. No se publica ni se hace push.
