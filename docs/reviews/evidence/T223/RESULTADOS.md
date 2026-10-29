# T223 · Resultados y proyector simplificados

Petición de Adrià, 2026-10-29. Base: `5c0fb2d0688a39497ebfac74f01d9297951dc78e`.
Verificación de los cambios locales de T223 con datos ficticios, sin perfil
habitual, red, alumnos reales, instalación ni publicación.

## Resultado

- Resultados ya no muestra resumen académico, media, comprobación con más
  fallos, hora actual, última corrección ni explicación permanente de la nota.
  Analíticas conserva sus estadísticas. El aviso de criterios anteriores y
  los errores de actualización continúan visibles cuando corresponden.
- Reloj compacto en la cabecera con icono y cuenta atrás accesible. Pausa y
  corrección sustituyen la cifra por su estado. La actualización del reloj
  queda aislada de la tabla.
- Búsqueda, Filtros y Alumnos en una barra; menús exclusivos, cierre al pulsar
  fuera o Escape. Ocultar/recuperar alumnos conserva sus notas y filtros.
- Matriz con nombre y nota principal, sin procedencia, última nota ni ojo
  repetidos; guion para ausencia de nota y etiqueta Provisional para la parcial.
  La procedencia sigue en la ayuda y las comprobaciones en el detalle.
- Filas sin contador de alumnos que superan cada comprobación. Separador en
  cabecera ajustable con ratón y flechas, límites 160–800 px; doble clic o
  Inicio recuperan el ancho automático. Se conserva al cambiar de vista,
  proyector o corrección de las mismas fuentes; otras fuentes lo reinician.
- Proyector con controles −, + y Encajar, sin porcentajes ni ayuda persistente.
  La tabla ocupa el ancho disponible. El ajuste usa mínimos de columna
  independientes del ancho expandido para no realimentar la escala; tipografía
  estable sin unidades de contenedor en celdas de tabla.

## Comprobaciones

- `GOCACHE=/tmp/heimdall-go-cache make check`: correcto. El cache habitual es
  de solo lectura dentro del aislamiento; no se modifica su configuración.
- `npm test`: **643 pruebas, 47 archivos correctos** fuera del aislamiento.
  Dentro fallaron cuatro por timeout en procesos auxiliares de copias/cierre,
  también al repetir los dos archivos solos. Sin modificar esos tests, la
  ejecución autorizada fuera del aislamiento pasa completa en 3,22 s.
- `npm run typecheck`, `npm run build` y preload: correctos.
- `make docs-check tools-check` y `git diff --check`: correctos.
- Electron aislado: mejor nota conservada, pausa/reanudación, cierre a lista,
  visibilidad, filtros, nota provisional y ausencia de nota, arrastre real
  (500 → 590 px), teclado, navegación y remontaje. Resultados conservados al
  corregir y al fallar; error visible y reloj de siguiente vuelta.
- Ajuste con 5/30 alumnos y 50 comprobaciones a 1024×768, 1366×768 y 1920×1080:
  todas las columnas y filas dentro del área, sin desbordamiento, también al
  filtrar y pasar a lista; + abandona el ajuste automático. Aserción específica
  de ocupación del ancho para evitar una tabla diminuta en un rincón.
- Clase de 14 alumnos/19 comprobaciones a 1366×768 y 1024×768; profesor a
  1366×768/1920×1080. Cero errores del renderer. [Mediciones](proof.json).

## Capturas

- [Profesor · 1366×768](teacher-1366.png).
- [Profesor · 1920×1080](teacher-1920.png).
- [Proyector de aula · 1366×768](projector-class-1366.png).
- [Proyector de aula · 1024×768](projector-class-1024.png).
- [5 alumnos/50 comprobaciones · 1024×768](projector-5-1024.png).
- [5 alumnos/50 comprobaciones · 1366×768](projector-5-1366.png).
- [30 alumnos/50 comprobaciones · 1024×768](projector-30-1024.png).

## Reproducir

Desde `gui/`, tras compilar:

```bash
node_modules/.bin/esbuild scripts/results-fixture.tsx --bundle --platform=browser --format=iife --tsconfig=tsconfig.web.json --outfile=/tmp/heimdall-results-fixture.js
node_modules/.bin/esbuild scripts/exam-session-fixture.tsx --bundle --platform=browser --format=iife --tsconfig=tsconfig.web.json --outfile=/tmp/heimdall-session-fixture.js
node_modules/.bin/esbuild scripts/results-simple-ui.ts --bundle --platform=node --format=esm --external:electron --outfile=/tmp/heimdall-simple-ui.mjs
node_modules/electron/dist/electron /tmp/heimdall-simple-ui.mjs --no-sandbox
```

El perfil es temporal y los envíos están simulados. `--no-sandbox` se limita
al arnés, como en los laboratorios anteriores. El entorno restringido no
permite iniciar Electron; la ejecución visual fue autorizada fuera de él.
Esta evidencia sustituye las expectativas visuales de etiquetas y controles
anteriores, no los resultados históricos de esos trabajos. No cambia motor,
cálculo de notas, artefactos, exportaciones ni ciclo persistente del examen.
Con 50 comprobaciones y muchos alumnos, encajar todo reduce necesariamente
la letra; +, filtros y desplazamiento permiten leer una parte desde lejos.
