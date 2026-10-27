# T208 · Alumnos visibles, Evaluados y proyector

Fecha: 2026-10-27. Resultado: **CORRECTO**.

## Intervalo y alcance

Base y HEAD previo: `c6a566c614c7b1e400aeaa7b5bda7ed7f3039616`.
Revisión de esa base más los cambios locales de T208, incluidos los nuevos
ficheros de estado visual y pruebas. Comprende Resultados, sus filtros,
estado de aplicación/lectura de resultados, arnés ficticio y documentación.
Durante la sesión apareció T209 en paralelo: sus cambios de comprobador RA1,
examen y pruebas Python quedan fuera de esta revisión y de este commit.

T208 no instala ni reinicia la aplicación, no abre datos reales ni corrige
máquinas del alumnado. No cambia el motor, el contrato, las notas, los
informes, las exportaciones ni a quién se corrige.

## Criterios comprobados

| Criterio | Evidencia |
|---|---|
| Ocultar en lista/matriz y recuperar uno/todos | Interacciones del componente real, incluido todos ocultos y ningún resultado visible. Acciones de ocultar y detalle son botones hermanos, no anidados. |
| Misma selección al navegar, cambiar vista o proyector y corregir otra vez | Estado temporal compartido; arnés desmonta y remonta la vista y carga otra corrección con las mismas fuentes. |
| Reinicio por clase/examen y sin persistencia | Pruebas de cambios reales de clase, proyecto, fuente histórica y navegación pendiente por borrador. El estado no usa almacenamiento local ni se escribe en disco. |
| Evaluados incluye conexiones incompletas | Pruebas para todas las causas con/sin evidencia de ejecución SSH, varios hosts, intento sin comando, solo inventario, excluido y evidencia solo anterior. Interfaz: completo, parcial y solo timeout visibles; rechazo SSH y máquina inaccesible fuera. |
| Cuatro órdenes y filtros en proyector | Mismo orden antes/después del cambio de modo; filtros compartidos en lista y matriz; sin nota final siempre al final. Detalle conserva ocultación de dirección y host. |
| Restablecer y recuentos | Restablecer conserva los ocultos; recuperación explícita individual/global. Contador de visibles/total/ocultos y resumen identificado como toda la corrección. |
| Integridad de los resultados | Prueba de ausencia de mutación del resultado y CSV idéntico antes/después de ocultar. Exportaciones e informes siguen recibiendo el artefacto completo. |

«Evaluados» exige `execution.transport === 'ssh'` y `command_attempts > 0`
en alguna comprobación de la corrección abierta. Este registro se crea después
de autenticar. También incluye rechazo posterior de sudo; no implica nota
final ni éxito académico. No deduce asistencia a clase de una conexión fallida.

## Comprobaciones ejecutadas

- `GOCACHE=/tmp/heimdall-plan-go-cache make check`: correcto sobre la base del
  motor previa a los cambios simultáneos de T209. Se usa caché temporal porque
  la caché habitual no es escribible en el aislamiento.
- `make gui-check`: TypeScript y **601 pruebas en 41 ficheros**, correcto.
  Incluye **18 pruebas nuevas** de conexión, selección y ciclo de sesión.
- `make gui-build`: correcto, incluido preload sandboxed; repetido tras el
  último ajuste de alineación. Genera solo `gui/out`, sin paquete instalado.
- Arnés Electron real aislado: correcto, dos pasadas visuales y de interacción,
  sin errores de consola. Perfil temporal, fuentes ficticias y renderizado
  fuera de pantalla; no abre una ventana sobre la corrección del profesor.
- `make docs-check tools-check` y `git diff --check`: correctos.

Los intentos iniciales de la suite GUI dentro del aislamiento fallaron en
cuatro pruebas preexistentes de procesos auxiliares (`ETIMEDOUT` al arrancar
Node y cierre). La ejecución secuencial reprodujo el problema y una prueba
mínima de creación de proceso devolvió `EPERM`. La suite completa pasó fuera
de ese aislamiento, sin cambiar ni debilitar las pruebas. La captura inicial
con ventana oculta conservaba un fotograma de tema anterior; se usa ahora el
renderizado fuera de pantalla de Electron, verificando el píxel de fondo.

## Evidencia visual

El arnés cubre 5/30 alumnos, 50 comprobaciones, ambos temas y anchos
1440/1024/390, desplazamiento horizontal/vertical y cabeceras fijas.
La revisión visual agrupada detectó la alineación vertical del contador con
el panel de ocultos abierto; corregida y confirmada en la segunda pasada.

- [Matriz clara](5-1440-light.png) y [ventana estrecha oscura](5-390-dark.png).
- [Evaluados en proyector](projector-evaluated.png), con parcial y timeout.
- [Lista en proyector](projector-list.png), con acciones de ocultación.
- [Todos ocultos y recuperación](projector-all-hidden.png).
- [Aserciones de geometría e interacción](proof.json).

Reproducir desde `gui/`, después de `npm run build`:

```bash
node_modules/.bin/esbuild scripts/results-fixture.tsx --bundle --platform=browser --format=iife --tsconfig=tsconfig.web.json --outfile=/tmp/heimdall-results-fixture.js
node_modules/.bin/esbuild scripts/results-ui.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-results-ui.mjs --external:electron
RESULTS_UI_OUT=/tmp/heimdall-results-ui-t208 node_modules/electron/dist/electron /tmp/heimdall-results-ui.mjs --no-sandbox
```

## Límites y entrega

No es una validación de aula ni una ejecución CI remota. No se prueba lector
de pantalla ni dispositivo táctil físico. La recuperación muestra alumnos
ocultos, pero un filtro activo puede seguir dejándolos fuera; el contador lo
indica y Restablecer limpia esos filtros. El panel de pendientes y las
estadísticas generales siguen representando toda la corrección.

Implementación compilada en el repositorio. **Pendiente instalar T208 cuando
Adrià termine de corregir**; no hacer push, publicación ni reinicio automático.

Actualización posterior: Adrià autorizó instalar inmediatamente; la instalación
con copia anterior y motor T209 conservado queda registrada en
[T210](../T210/RESULTADOS.md). No se reinició la instancia activa.
