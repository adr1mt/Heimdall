# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T054, hecha, después de dividirla** en histórico (T054), exportación de notas
(T056), modo examen y proyector (T058) e inventario de lo heredado (T059).

Lo entregado es el histórico: una vista nueva que lista las correcciones
guardadas del examen elegido, de la más reciente a la más antigua, leyendo los
artefactos y nada más. Abrir una enseña la misma pantalla que el día que se
corrió, sin tocar ninguna máquina. Una corrección con el fichero roto no
desaparece de la lista: sale con el motivo. Un examen sin correcciones lo dice
y no es un error. Y se puede abrir a mano un resultado de otra carpeta.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `version`. `run`: `--secrets=stdin|env`,
  `--var`, `--cname`, `--case`, `--concurrency`, `--host-concurrency`,
  `--events=ndjson`, `--retry=<artefacto>` y, congeladas, `--compat=teuton2` y
  `--export=json`. Exit: 0 ok · 2 config inválida · 3 parcial · 4 cancelado ·
  1 ni se pudo escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf`; el
  rastro del intento anterior no entra en ninguna nota. `plan`: los dos YAML y
  las nueve validaciones. `assert`: cinco aserciones. `report`: escritura
  atómica y redacción. `events`: contrato NDJSON (ADR-0017).
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno y selección de reintento. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el roto, en el 2299.
  `acceptance.sh` recorre A-1 a A-14 y `eventos.sh` E-1 a E-10.
- `gui/`: árbol Node independiente; `make gui-check` (79 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, **Histórico**, Ajustes, Ayuda.
  Resultados lleva el panel de lo que quedó sin comprobar y manda el reintento
  a Inicio. El histórico lee `var/run-*.json` del proyecto del examen, como
  mucho las 50 más recientes, y no mira nada de la capa legacy.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` y `make gui-check` (79 tests) verdes · `gofmt -l` sin salida ·
`make gui-lab` verde: S-0 a S-4 y **H-1**, que reabre la última corrección
desde el histórico y compara la pantalla carácter a carácter contra el
laboratorio real. `acceptance.sh`, `eventos.sh` y `make test` no se repitieron.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido; sin examen elegido no
  hay lista, y para eso está «Abrir otro resultado…».
- El artefacto de un reintento parcial no da nota final: la cadena entera se
  lee en T057. Y un reintento exige el mismo PLAN: si lo que estaba mal era el
  `aula.yaml`, esa clase se corrige entera otra vez.

## Siguiente tarea recomendada

**T056** (`READY`, P1): sacar las notas fuera —CSV y escala del profesor—.
También `READY`: T057 (cadena de correcciones) y T058 (examen y proyector).
