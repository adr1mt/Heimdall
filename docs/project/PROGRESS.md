# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T052, hecha**: la aplicación corrige. Se eligen examen y aula, se escriben
las contraseñas que el aula nombra, y la corrección avanza en pantalla
comprobación a comprobación y alumno a alumno, con un botón para detenerla.
Al terminar dice qué ha pasado y dónde ha quedado el resultado. Las
contraseñas solo viven en memoria: del campo al motor por `stdin`, nunca en
`argv`, nunca al disco. `gui/scripts/secretos.sh` (`make gui-lab`) lo comprueba
mirando todos los procesos vivos durante una corrección real del laboratorio.

En palabras de aula: ya se corrige una clase entera desde la aplicación y se ve
avanzar. Las notas alumno a alumno son T053.

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
  `internal/events`: contrato nativo NDJSON (ADR-0017) con su propia redacción;
  `docs/design/09-CONTRATO-GUI.md` y `docs/design/schema/run-result.schema.json`.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, `panic` recuperado, parcial tras cada alumno. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el alumno roto, puerto 2299.
  `acceptance.sh` recorre A-1 a A-14 y `eventos.sh` E-1 a E-10.
- `gui/`: árbol Node independiente; `make gui-check` (37 tests), `make gui-build`
  y `make gui-lab`. Vistas: Inicio, Ajustes, Ayuda. Un ajuste guardado, la ruta
  del motor. Inicio lanza el motor con un directorio (`examen.yaml` fijo, el
  aula por `--cname`) y sigue el flujo NDJSON. `npm run lab-run` corrige a
  través de la aplicación construida; `CANCEL_MS` pulsa «Detener» a mitad.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · `make gui-check` verde (37 tests) ·
`make gui-lab` verde tres veces seguidas (S-0 a S-4) · prototipo corregido
entero desde la aplicación: 10 de 10, artefacto `PARTIAL`, salida 3 · detenido
a mitad: artefacto `CANCELLED`, las cinco comprobaciones de alumne02 en
`CANCELLED`, salida 4. `make test` no se ha repetido esta sesión.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- `systemctl is-active` sin `dbus` contesta con error y la comprobación sale
  suspensa, no sin evaluar. Es correcto, pero conviene saberlo.

## Siguiente tarea recomendada

**T053** (`READY`, P0): resultados. Matriz sobre el artefacto canónico, notas,
causas técnicas e incompletos; cierra D-8 con un ADR.
