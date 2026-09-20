# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T056, hecha**: las notas ya salen de la aplicación.

Desde Resultados se guarda una hoja de notas: un alumno por línea, con su
identificador de Moodle si el aula lo trae, y su nota en la escala que el
profesor elija en Ajustes —0 a 10 o 0 a 100—. Quien no tiene nota final sale
sin nota y con el motivo. En la hoja no va nada de lo que escribieron las
máquinas, así que tampoco puede ir ninguna contraseña, y la corrección
guardada no se toca: exportar solo lee.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `version`. `run`: `--secrets=stdin|env`,
  `--var`, `--cname`, `--case`, `--concurrency`, `--host-concurrency`,
  `--events=ndjson`, `--retry=<artefacto>` y, congeladas, `--compat=teuton2` y
  `--export=json`. Exit: 0 ok · 2 config · 3 parcial · 4 cancelado · 1 sin
  escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf`; el
  rastro del intento anterior no entra en ninguna nota. `plan`: los dos YAML y
  nueve validaciones. `assert`: cinco aserciones. `report`: escritura atómica y
  redacción. `events`: contrato NDJSON (ADR-0017).
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno y selección de reintento. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el roto, en el 2299. `acceptance.sh`
  recorre A-1 a A-14 y `eventos.sh` E-1 a E-10.
- `gui/`: árbol Node independiente; `make gui-check` (93 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Histórico, Ajustes, Ayuda. Resultados
  lleva el panel de lo que quedó sin comprobar, manda el reintento a Inicio y
  **exporta las notas a CSV**; la escala del profesor vive con las preferencias
  de pantalla. El histórico lee `var/run-*.json` del proyecto del examen, 50
  como mucho, y no mira nada de la capa legacy.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` y `make gui-check` (93 tests) verdes · `gofmt -l` sin salida ·
`make gui-lab` verde: S-0 a S-4, H-1 y **X-1 y X-2**, que exportan las notas
con el botón real contra el laboratorio real y comprueban que la contraseña no
aparece en el fichero. `acceptance.sh`, `eventos.sh` y `make test`, no.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido; sin examen elegido
  no hay lista, y para eso está «Abrir otro resultado…».
- El laboratorio no deja ningún alumno con nota final: exportar una cerrada lo
  comprueban los tests rápidos.
- El artefacto de un reintento parcial no da nota final: la cadena entera se
  lee en T057, y hasta entonces esos alumnos se exportan sin nota. Un
  reintento exige el mismo PLAN: si lo que estaba mal era el `aula.yaml`, esa
  clase se corrige entera otra vez.

## Siguiente tarea recomendada

**T057** (`READY`, P1): cerrar la nota de un alumno que quedó entero entre dos
correcciones, sin mezclar artefactos. También `READY`: T058 y T059.
