# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 4 — Contrato nativo motor ↔ GUI

## Última sesión

**ADR-0016**, que sustituye a ADR-0008: **Heimdall deja de ser compatible con
Teuton**. No se lee `config.yaml` ni `start.rb`, no hay importador de exámenes
antiguos y ninguna limitación de Teuton GUI condiciona el diseño. La cadena
definitiva es Heimdall GUI → contrato nativo → motor → SSH → máquinas.
Consecuencias, ya aplicadas a la planificación:

- **T041, T043 y T044** quedan `DROPPED`, con su motivo en `TASKS.json`.
- **Fase 4** pasa a ser el contrato nativo: **T050** (eventos NDJSON + esquema
  del artefacto, cierra D-9) es la única tarea `READY` y todo cuelga de ella.
- **Fase 5**, Heimdall GUI en `gui/`, sembrada desde `teuton-gui` y sin una
  línea de Teuton: T051 semilla, T052 ejecución y progreso, T053 resultados e
  incompletas (cierra D-8), T054 histórico, modo examen y analíticas.
- **Fase 6**: T060, borrado de la capa legacy. **Fase 7**: T070 rehacer los
  exámenes en formato nativo (sin migrador), T071 editor, T072 empaquetado.
- `internal/legacy` y la fachada `--compat`/`--export=json` quedan **congeladas**:
  pruebas internas y nada nuevo.

No se tocó código: solo ADR, roadmap, tareas y reglas.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `version`. `run` acepta `--secrets=stdin|env`,
  `--var=dir`, `--concurrency=N`, `--host-concurrency=N` y, congeladas,
  `--compat=teuton2` y la fachada en `compat.go`. Exit: 0 ok · 2 config
  inválida · 3 parcial · 4 cancelado · 1 ni se pudo escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf`.
  `internal/plan`: los dos YAML y las nueve validaciones. `internal/assert`:
  cinco aserciones. `internal/report`: escritura atómica y redacción.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, `panic` recuperado, parcial tras cada alumno. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el alumno roto, puerto 2299.
  `test/acceptance.sh` recorre A-1 a A-14 con `jq`.
- `gui/` **no existe todavía**. `workspace/teuton-gui` es referencia de solo
  lectura.

## Pruebas ejecutadas

**En esta sesión no se ejecutó nada**: no se tocó código. Última suite verde
(sesión anterior): `make check`, `gofmt -l` limpio y `make test` contra el
laboratorio, con `acceptance.sh` 13 de 14 y `carga.sh` con A-15.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- `systemctl is-active` sin `dbus` contesta con error y la comprobación sale
  suspensa, no sin evaluar. Es correcto, pero conviene saberlo.

## Siguiente tarea recomendada

**T050** (`READY`, P0): el contrato nativo motor ↔ GUI. Eventos NDJSON
versionados y esquema del artefacto, con el ADR que cierra D-9.
