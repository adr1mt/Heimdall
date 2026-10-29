# T227 · Controles del aula y preparación de otro examen

Petición de Adrià durante la prueba local del 2026-10-29. Base: `0a58b3b`.

## Resultado

- Eliminado Vista profesor del lateral. Escala de interfaz en Más opciones de
  Resultados; proyector conserva zoom y Encajar. Matriz sin leyenda redundante.
- Lista de corrección sin envío individual. Envío general disponible; las notas
  finales conservan informes y exportación.
- Corregir permite ocultar y recuperar alumnado, antes y durante la evaluación.
  Lista y matriz comparten la selección, también al recibir el primer artefacto.
  Solo presentación: no modifica inventario, corrección, notas ni exportaciones.
- Reanudar mantiene la espera pendiente y las vueltas. Si se recuperó de disco o
  cambió el intervalo, espera un intervalo completo. No corrige inmediatamente.
  La espera en pausa vive en memoria; no cambia el manifiesto persistente.
- Preparar otro examen solo está disponible tras finalizar: limpia resultados,
  filtros y alumnos ocultos, sale de proyector y vuelve a Corregir sin clase.
  Elegir otra vez la misma clase no vuelve a abrir automáticamente sus notas
  anteriores. La siguiente corrección usa la creación de registro ya existente;
  no se elimina ni reescribe el registro finalizado.

## Verificación

- `make check`: correcto.
- `make gui-check`: tipos correctos; 648 pruebas en 47 ficheros, todas correctas.
  Primera ejecución aislada: cuatro timeouts en procesos hijos de las pruebas
  de cierre/copia. Reejecución fuera del aislamiento: todas pasan.
- `make gui-build`: correcto; preload verificado.
- `make docs-check tools-check`: enlaces correctos y 11 pruebas correctas.
- Electron real, perfil temporal, 14 alumnos ficticios, sin SSH ni datos reales:
  [comprobaciones](proof.json). Verifica ocultación entre Corregir/lista/matriz,
  escala en Resultados, proyector, informes finales y preparar la misma clase
  sin recuperar automáticamente el examen anterior. Sin errores de renderer.
- Capturas inspeccionadas: [Corregir](correct-hidden.png),
  [matriz](matrix-hidden.png), [notas finales](final-grades.png) y
  [misma clase preparada](prepared-same-class.png).

Arnés: `gui/scripts/classroom-fixture.tsx` y `gui/scripts/classroom-ui.ts`.
Desde `gui/`, tras build:

```bash
./node_modules/.bin/esbuild scripts/classroom-fixture.tsx --bundle --format=iife --platform=browser --jsx=automatic --alias:@=./src/renderer/src --loader:.png=dataurl '--external:*?worker' --outfile=/tmp/heimdall-classroom-fixture.js
./node_modules/.bin/esbuild scripts/classroom-ui.ts --bundle --platform=node --format=esm --external:electron --outfile=/tmp/heimdall-classroom-ui.mjs
./node_modules/electron/dist/electron /tmp/heimdall-classroom-ui.mjs --no-sandbox
```

El arnés requiere permisos de procesos y escritorio. No se reinstala ni
reinicia la aplicación habitual que el profesor tiene abierta. Sin publicación,
push ni cambios del contrato motor/GUI o los datos guardados de alumnado.
