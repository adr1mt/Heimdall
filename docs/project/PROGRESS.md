# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

Dos cosas, en dos commits.

**Replanificación (ADR-0016)**: Heimdall deja de ser compatible con Teuton. Ni
`config.yaml`, ni `start.rb`, ni importador de exámenes antiguos. T041, T043 y
T044 quedan `DROPPED` con su motivo y la capa legacy, congelada hasta T060. La
cadena es Heimdall GUI → contrato nativo → motor → SSH → máquinas.

**T050, hecha (ADR-0017)**: `heimdall run --events=ndjson` emite cinco eventos
por `stdout` —`run.start` con el denominador exacto y el total de la barra,
`student.start`, `check.end` con estado y causa separados, `student.end` con la
nota, `run.end` con el artefacto y el código de salida— y el esquema del
artefacto está publicado en `docs/design/schema/`. `test/eventos.sh` lee una
ejecución entera solo con el flujo y el artefacto: E-1 a E-10 en verde contra
el laboratorio. El esquema no puede desincronizarse del modelo. La fachada
congelada no se ha tocado; `--events` y `--export` son incompatibles.

En palabras de aula: la GUI nueva ya puede saber, mientras corrige, cuántas
comprobaciones quedan y por qué ha fallado cada una. Una máquina apagada deja
de parecerse a un examen mal hecho.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `version`. `run` acepta `--secrets=stdin|env`,
  `--var=dir`, `--concurrency=N`, `--host-concurrency=N`, `--events=ndjson` y,
  congeladas, `--compat=teuton2` y la fachada en `compat.go`. `--events` y
  `--export` son incompatibles. Exit: 0 ok · 2 config inválida · 3 parcial ·
  4 cancelado · 1 ni se pudo escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf`.
  `internal/plan`: los dos YAML y las nueve validaciones. `internal/assert`:
  cinco aserciones. `internal/report`: escritura atómica y redacción.
- `internal/events`: contrato nativo NDJSON (ADR-0017), con su propia
  redacción de secretos. `docs/design/09-CONTRATO-GUI.md` y el esquema en
  `docs/design/schema/run-result.schema.json`.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, `panic` recuperado, parcial tras cada alumno. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el alumno roto, puerto 2299.
  `test/acceptance.sh` recorre A-1 a A-14 y `test/eventos.sh` E-1 a E-10.
- `gui/` **no existe todavía**. `workspace/teuton-gui` es referencia de solo
  lectura.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · `make test` entero contra el
laboratorio: integración de `engine` y `ssh`, `secrets.sh`, `acceptance.sh`
13 de 14, **`eventos.sh` 10 de 10**, `ra2.sh` 13, `carga.sh` con A-15.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- `systemctl is-active` sin `dbus` contesta con error y la comprobación sale
  suspensa, no sin evaluar. Es correcto, pero conviene saberlo.

## Siguiente tarea recomendada

**T051** (`READY`, P0): la semilla de `gui/`. Heimdall GUI arrancando con la
base técnica y visual de `teuton-gui` y sin una línea de Teuton dentro.
