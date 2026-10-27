# T216 · Densidad adaptable en el portátil

Fecha: 2026-10-27. Base: `284b1cf622bda103da31932356647ebc891ed289`.
Implementación y evidencia en el commit que incorpora este informe.
Solicitud: aprovechar mejor el portátil sin sustituir la identidad visual.

## Resultado

- Barra lateral de 208 px expandida o 60 px contraída al 100 %. Automática
  hasta 1180 px; la selección manual se conserva. Acciones con nombre accesible
  y ayuda, también al mostrar solo iconos.
- «Vista profesor» permite escala 80–120 %, reinicio al 100 % y preferencia del
  lateral. Ambas se restauran al abrir. Proyector conserva su raíz de 20 px y
  controles propios, independientemente de la escala del profesor.
- Lista: nombres completos con salto de línea, acciones secundarias de icono,
  filas compactas y una o dos columnas según espacio. Moodle y CSV se agrupan
  en más opciones. Resumen: aprobados, suspensos y sin evaluar sobre toda la
  corrección, con excluidos fuera y sin considerar una avería un suspenso.
- Matriz: comprobaciones de 14 px al 100 %, primera columna proporcionada,
  nombres completos, filas compactas y desplazamiento propio; cabeceras y
  primera columna fijas. No se fuerza a incluir los 14 alumnos sin desplazar.
- Corregir: contexto y modo examen compactos, listado que aprovecha el ancho;
  progreso antes de la lista y nombres completos también mientras se corrige.
- Las últimas notas siguen visibles durante refresco y error. El aviso añade
  que están pendientes de actualizar. No se modifica la retención de T212.
- Proyector: ajuste medido a un ancho estable. Se elimina la realimentación
  entre el ancho y el zoom que podía alternar entre escalas y cortar columnas.

## Evidencia

Electron/Chromium, perfil temporal, datos ficticios, sin IPC real, red, SSH ni
escritura en los datos del profesor. [Mediciones](proof.json):

| Comprobación | Resultado |
| --- | --- |
| Lista, 1366×768 al 100 % | 14 nombres visibles, ninguno truncado; primera fila a 251 px |
| Lista, 1024×768 al 120 % | 5 filas visibles, nombres completos; sin desbordar la ventana |
| Escalas 80/100/120, ambas resoluciones | Nombres completos y matriz con desplazamiento |
| Lateral automático, manual y reapertura | Correcto |
| Matriz de 50 comprobaciones | Cabecera y primera columna permanecen fijas al desplazar |
| Matriz enfocada con teclado | Flecha derecha desplaza horizontalmente |
| Refresco y fallo | Se conservan los 14 resultados anteriores y el aviso |
| Proyector, 14 alumnos | Última cabecera dentro del área; cero desbordamiento horizontal/vertical |
| Corregir | Listado supera el 85 % del ancho del contenido; progreso visible antes |

Capturas inspeccionadas:
[Lista portátil](list-1366-100.png), [matriz portátil](matrix-1366-100.png),
[lista al 120 %](list-1024-120.png), [matriz desplazada](matrix-sticky-1024.png),
[Corregir](correct-1024.png), [progreso](correct-progress-1024.png),
[proyector](projector-1024.png), [tema oscuro](matrix-dark-1024.png).

Regresiones de filtros, orden, detalle, ocultar/recuperar, lista/matriz,
incidencias, temas y tamaños: [prueba existente](regression-results.json).
Proyector con 5/30 alumnos y 50 comprobaciones, ajuste tras filtro/cambio de
ventana, zoom manual, informes individual/masivo y refresco:
[prueba existente](regression-projector.json). Los dos arneses pasan.

## Validación y límites

615 pruebas GUI, tipos, build y preload correctos. Motor: `make check` correcto
con `GOCACHE=/tmp/heimdall-go-cache`; enlaces y 10 pruebas de navegación correctos.
El sandbox inicial impedía escribir la caché de Go y crear procesos hijos de
Node: 4 pruebas de copias/cierre agotaron el tiempo. La suite completa pasa al
permitir esos procesos locales, sin cambiar ni debilitar las pruebas.

El detector de Impeccable no se ejecutó: faltaba su motor y no podía crear la
caché de instalación. Revisión de código, contraste existente, geometría y
capturas realizada directamente. Las capturas prueban Chromium redimensionado;
no equivalen a validación de aula, hardware táctil o instalación empaquetada.
«Ajustar a pantalla» reduce la letra cuando hay muchos alumnos: + y los filtros
permiten leer una parte desde lejos. Sin instalación, publicación ni reinicio.

## Reproducir

Desde `gui/`, tras `npm run build`:

```bash
node_modules/.bin/esbuild scripts/density-fixture.tsx --bundle --platform=browser --format=iife --tsconfig=tsconfig.web.json --loader:.png=dataurl '--external:*?worker' --outfile=/tmp/heimdall-density-fixture.js
node_modules/.bin/esbuild scripts/density-ui.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-density-ui.mjs --external:electron
node_modules/electron/dist/electron /tmp/heimdall-density-ui.mjs --no-sandbox
```

El arnés no abre el editor; su worker queda fuera del bundle aislado. Los
arneses `results-improvements-ui.ts` y `results-ui.ts` se reproducen como indica
[la evidencia de T211–T213](../T211-T213/RESULTADOS.md).
