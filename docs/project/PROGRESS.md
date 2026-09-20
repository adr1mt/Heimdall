# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T052 y T053, hechas.** La aplicación corrige y enseña las notas: examen,
aula, las contraseñas que el aula nombra, progreso en pantalla con botón de
detener, y al terminar se abre sola Resultados. Ahí está cada alumno con su
estado y su nota, la matriz en tres colores y el detalle de cualquier
comprobación: causa técnica, comando, esperado, encontrado y salidas con su
corte. Quien no se pudo evaluar sale sin nota, nunca con un 0; un incompleto
enseña la provisional dicha como tal y ninguna final.

T053 se partió al llegar: actuar ante un incompleto es **T055**, con el ADR de
D-8.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `version`. `run`: `--secrets=stdin|env`,
  `--var`, `--cname`, `--case`, `--concurrency`, `--host-concurrency`,
  `--events=ndjson` y, congeladas, `--compat=teuton2` y `--export=json`
  (incompatible con `--events`). Exit: 0 ok · 2 config inválida · 3 parcial ·
  4 cancelado · 1 ni se pudo escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf`.
  `plan`: los dos YAML y las nueve validaciones. `assert`: cinco aserciones.
  `report`: escritura atómica y redacción. `events`: contrato NDJSON (ADR-0017),
  descrito en `docs/design/09-CONTRATO-GUI.md`.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno. `internal/ssh`: 2 reintentos, identidades
  en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el alumno roto, puerto 2299.
  `acceptance.sh` recorre A-1 a A-14 y `eventos.sh` E-1 a E-10.
- `gui/`: árbol Node independiente; `make gui-check` (57 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Ajustes, Ayuda. Inicio lanza el motor
  con un directorio (`examen.yaml` fijo, aula por `--cname`) y sigue el flujo;
  Resultados lee el artefacto de `run.end`. Las frases de cada causa y estado
  están en `lib/results.ts`, contrastadas en test con `internal/model/enums.go`.
  `npm run lab-run` corrige por la aplicación construida; `CANCEL_MS` detiene a
  mitad, `OPEN_CHECK` abre una comprobación.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` y `make gui-check` (57 tests) verdes · `gofmt -l` sin salida ·
`make gui-lab` verde (S-0 a S-4) · prototipo corregido entero desde la
aplicación (10 de 10, `PARTIAL`, salida 3) y detenido a mitad (`CANCELLED`,
salida 4) · Resultados abierto sobre el prototipo y sobre
`testdata/salida-grande`: provisional con denominador, alumno sin nota, aviso
de proceso vivo y corte de 64 kB de 8 MB. `make test` no se repitió.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- `systemctl is-active` sin `dbus` contesta con error y la comprobación sale
  suspensa, no sin evaluar. Es correcto, pero conviene saberlo.

## Siguiente tarea recomendada

**T055** (`READY`, P0): qué ofrece la GUI ante un incompleto. Cierra D-8 con un
ADR y repite los alumnos que quedaron a medias.
