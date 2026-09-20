# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T051, hecha**: existe `gui/`, la aplicación propia. Arranca con su nombre, su
icono y su identidad, encuentra el motor, dice su versión y recuerda el examen y
el aula con los que se va a trabajar. Todavía no corrige: eso es T052.

De `teuton-gui` pasan la base técnica y el sistema visual; sus pantallas no
—estaban escritas contra el contrato de Teutón y se rehacen sobre el nativo—.
`grep -ri teuton gui/src` no devuelve nada; los tests retirados y su motivo
están en `gui/docs/TESTS-RETIRADOS.md`.

En palabras de aula: ya hay una aplicación de Heimdall que se abre y sabe decir
si el corrector está instalado. Falta que corrija y enseñe las notas.

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
- `gui/`: Electron + React + Tailwind, árbol Node independiente. `make gui-check`
  (typecheck + vitest) y `make gui-build`; `make check` no depende de él. Tres
  vistas: Inicio, Ajustes y Ayuda. Un solo ajuste guardado, la ruta del motor.
  `npm run screenshot` captura la ventana ya compilada.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · `make gui-check` verde (13 tests,
typecheck de main, renderer y tests) · la ventana levantada y capturada en los
dos temas · `make test` entero contra el laboratorio: integración de `engine` y `ssh`, `secrets.sh`, `acceptance.sh`
13 de 14, **`eventos.sh` 10 de 10**, `ra2.sh` 13, `carga.sh` con A-15.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- `systemctl is-active` sin `dbus` contesta con error y la comprobación sale
  suspensa, no sin evaluar. Es correcto, pero conviene saberlo.

## Siguiente tarea recomendada

**T052** (`READY`, P0): que la GUI lance el motor y siga la ejecución por el
contrato nativo, con progreso por comprobación y cancelación con artefacto
parcial.
