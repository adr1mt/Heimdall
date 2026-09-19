# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-19 · **Fase**: 0 — Bootstrap y contratos

## Última tarea terminada

**T003 — `Classify` y `ComputeScore` puros.** El camino de un error técnico
hacia la nota está cerrado por construcción: solo hay `PASS` o `FAIL` si la
causa es `NONE`, la ejecución terminó, hay código de salida y hay aserción.
Cualquier otra combinación sale `UNEVALUATED`.

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
  reloj: hay un test que parsea el paquete y lo comprueba.
- `ComputeScore` y `StudentStatusOf` nunca devuelven `EXCLUDED` (sale del
  inventario); `RunStatusOf` nunca devuelve `CANCELLED` ni `INVALID_CONFIG`.
- El golden vive en `internal/model/testdata/`, no en el `testdata/` raíz, que
  sigue reservado para exámenes e inventarios.
- `Makefile` con `check`, `test`, `build`, `lab` y `lab-down`. `make lab`
  levanta `alu1` y `alu2` en `127.1.2.3:2201-2202` con podman.

## Pruebas ejecutadas

`make check` verde en 0,4 s, 50 casos · `gofmt -l` sin salida. Se verificó por
mutación: ignorar la causa cuando hay ejecución, publicar nota final con algo
sin evaluar, dar 0 a quien no se pudo mirar, contar lo no evaluado como fallo y
meter `os` en el paquete. Las cinco las detecta la suite.

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

## Decisiones inesperadas de esta sesión

- Comparar pesos acumulados con una holgura de `1e-9`: un examen de
  0,1 + 0,2 + 0,7 deja un residuo de coma flotante que, sin ella, negaría la
  nota final a un alumno que la merece.
- `Classify` devuelve `ENGINE_ERROR` ante una entrada contradictoria (causa
  `NONE` sin ejecución completa) en vez de adivinar. Es un fallo nuestro y debe
  poder contarse.

## Siguiente tarea recomendada

Tres `READY` P0: **T004** (parseo de los dos YAML), **T007** (aserciones) y
**T009** (escritura atómica); T006 es P1. Toca **T004**: es la que desbloquea
T005 y, con ella, el subcomando `check`.
