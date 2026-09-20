# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T057, hecha su mitad de motor**; la pantalla queda en T061.

El motor lee varias correcciones de la misma clase como una sola: el alumno
cuya máquina estaba apagada el martes y contestó el miércoles sale con nota
final, y cada comprobación dice de qué corrección sale y qué se intentó antes.
Si falta algo en toda la cadena, sigue sin haber nota final; si las
correcciones no son del mismo examen y la misma aula, se rechazan con el
motivo. No se mezcla ni se reescribe ningún fichero: es una lectura.

**ADR-0019**: la nota consolidada la suma el motor, nunca la aplicación.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `version`. `run`:
  `--secrets=stdin|env`, `--var`, `--cname`, `--case`, `--concurrency`,
  `--host-concurrency`, `--events=ndjson`, `--retry=<artefacto>` y, congeladas,
  `--compat=teuton2` y `--export=json`. Exit: 0 ok · 2 config · 3 parcial ·
  4 cancelado · 1 sin escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf` y
  `Consolidate` (ADR-0019); el rastro del intento anterior no entra en ninguna
  nota. `plan`: los dos YAML y nueve validaciones. `assert`: cinco aserciones.
  `report`: escritura atómica y redacción. `events`: NDJSON (ADR-0017).
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno y selección de reintento. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el roto, en el 2299.
  `acceptance.sh` recorre A-1 a A-14 y `eventos.sh` E-1 a E-10.
- `gui/`: árbol Node independiente; `make gui-check` (93 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Histórico, Ajustes, Ayuda. Resultados
  lleva lo que quedó sin comprobar, manda el reintento a Inicio y **exporta las
  notas a CSV**; la escala del profesor va con las preferencias de pantalla. El
  histórico lee `var/run-*.json` del examen, 50 como mucho, sin tocar legacy.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` y `make gui-check` (93 tests) verdes · `gofmt -l` sin salida ·
cadena real del laboratorio —corrección, reintento y `consolidate`— leída a
mano: exit 3 y cada resultado apuntando a su corrección. `make gui-lab`,
`acceptance.sh`, `eventos.sh` y `make test` no se repitieron esta sesión.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido; sin examen elegido
  no hay lista, y para eso está «Abrir otro resultado…».
- La consolidación existe en el motor pero **todavía no se ve ni se exporta**
  desde la aplicación (T061): un alumno cerrado en dos correcciones sigue
  saliendo sin nota en pantalla. El laboratorio no puede encender la máquina
  apagada, así que esa cadena la prueban los tests y no el laboratorio.
- Un reintento exige el mismo PLAN: si lo que estaba mal era el `aula.yaml`,
  esa clase se corrige entera otra vez.

## Siguiente tarea recomendada

**T061** (`READY`, P1): enseñar y exportar la cadena consolidada desde la
aplicación. También `READY`: T058 (examen y proyector) y T059.
