# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 0 — Bootstrap y contratos

## Última tarea terminada

**T004 — parseo estricto de `examen.yaml` y `aula.yaml`.** Los dos ficheros del
profesor se leen con las claves en español. Una clave que el formato no conoce
se rechaza con fichero y línea, y se listan todas las del fichero de una vez.
Un `timeout` mal escrito es un error, nunca un valor por defecto silencioso.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`. `~/.profile`
  lo añade al `PATH`; en shell no interactiva hay que exportarlo a mano.
- `go.mod`: `module evalon`, `go 1.22` (mínimo soportado, no lo instalado). El
  nombre es provisional, D-7 sigue abierta.
- `cmd/evalon` tiene `run`, `check` y `version`; `run` y `check` imprimen «no
  implementado» y salen con 2. Exit codes: 0 ok · 2 config inválida · 3 parcial
  · 4 cancelado; el 1 queda libre a propósito.
- `internal/model` tiene el artefacto completo (T002) más `Classify`,
  `ComputeScore`, `StudentStatusOf` y `RunStatusOf`. Ni red, ni disco, ni
  reloj: hay un test que parsea el paquete y lo comprueba. `EXCLUDED` sale del
  inventario, nunca del cálculo.
- `internal/plan` lee los dos YAML (T004): herencia de `comun:` host a host,
  `por_defecto:` para peso y timeout, campos libres del alumno accesibles por
  nombre. El esquema conoce `cerca_de`, `no_contiene` y `valor:` para no
  perderlos al parsear; evaluarlos es de fase 2.
- Única dependencia externa: `gopkg.in/yaml.v3`. Se descartó `go-cmp` en los
  tests para no abrir un ADR por una comodidad.
- Ficheros de prueba: el examen y el aula del diseño en `testdata/formato/`;
  los malformados y el golden del modelo, junto a su paquete.
- `Makefile` con `check`, `test`, `build`, `lab` y `lab-down`. `make lab`
  levanta `alu1` y `alu2` en `127.1.2.3:2201-2202` con podman.

## Pruebas ejecutadas

`make check` verde en 0,5 s · `gofmt -l` sin salida. En T004 se verificó por
mutación: aceptar claves desconocidas, convertir un timeout mal formado en el
valor por defecto, dejar que `por_defecto:` pise el valor propio de una
comprobación, no heredar de `comun:` y descartar los campos libres del alumno.
Las cinco las detecta la suite.

## Problemas conocidos

- Laboratorio SSH en **`127.1.2.3`, no `127.0.0.1`**: con `127.0.0.x` Teuton
  ejecuta en local (F-01) y el criterio A-11 comprueba que el motor nuevo no.
- Ejecutar Teuton con `HOME` aislado (`workspace/sshlab/fakehome`): una entrada
  ed25519 en el `known_hosts` real tumba la ejecución (F-12).
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo, con un
  error que no lo explica.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar: allí `tt_skip: true`
  aborta la ejecución (F-11).
- El golden es de redacción manual, con hashes de relleno; sale uno real en T013.

## Decisiones inesperadas de la sesión

- `KnownFields(true)` de yaml.v3 no vale para este formato: no llega a los
  tipos anidados y rechazaría los campos libres del alumno. El paquete recorre
  el árbol del YAML contra las structs y da la línea de cada clave desconocida.
  Detalle en `DECISIONS.md`.
- `password:` sigue en el esquema del inventario a propósito: sin él, una
  contraseña literal saldría como «clave desconocida» y no como lo que es.

## Siguiente tarea recomendada

Tres `READY` P0: **T005** (resolución del PLAN y subcomando `check`), **T007**
(aserciones) y **T009** (escritura atómica); T006 es P1. Toca **T005**: cierra
la fase 0 y es la que da al profesor el número de comprobaciones y el peso
total sin encender ninguna máquina.
