# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-19 · **Fase**: 0 — Bootstrap y contratos

## Última tarea terminada

**T002 — Tipos canónicos de `RunResult`.** El modelo de resultados ya existe
como tipos Go con serialización JSON verificada: el ejemplo del diseño entra,
sale y vuelve idéntico byte a byte. Sin lógica de nota todavía.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`, del tarball
  oficial. `~/.profile` lo añade al `PATH`; en una shell no interactiva hay que
  exportarlo a mano.
- `go.mod`: `module evalon`, `go 1.22` (mínimo soportado, no lo instalado). El
  nombre es provisional, D-7 sigue abierta.
- `cmd/evalon` tiene `run`, `check` y `version`; `run` y `check` imprimen «no
  implementado» y salen con 2. Exit codes como constantes: 0 ok · 2 config
  inválida · 3 parcial · 4 cancelado; el 1 queda libre a propósito.
- `internal/model` tiene las ocho structs del artefacto, las seis
  enumeraciones como tipos `string` y `MarshalCanonical`. No tiene `Classify`
  ni `ComputeScore`: eso es T003.
- El golden vive en `internal/model/testdata/`, no en el `testdata/` raíz, que
  sigue reservado para exámenes e inventarios.
- `Makefile` con `check`, `test`, `build`, `lab` y `lab-down`. `make lab`
  levanta `alu1` y `alu2` en `127.1.2.3:2201-2202` con podman.

## Pruebas ejecutadas

`make check` verde en 0,6 s · `gofmt -l` sin salida. El round-trip se verificó
por mutación: cambiar `final_score: null` por `0` lo tumba, y reordenar dos
claves del golden también. Un test que pasa a la primera no demuestra nada.

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

- El artefacto se serializa **sin escape HTML**: la salida de `ip address show`
  lleva `<` y `>` y debe leerse tal cual, no escapada. Obliga a un
  `MarshalCanonical` propio: `json.Marshal` escapa por defecto.
- El decodificador de los tests rechaza claves desconocidas: una clave del
  diseño que el modelo no sepa guardar es un modelo roto, no un aviso.

## Siguiente tarea recomendada

Cuatro `READY` P0: **T003** (`Classify` y `ComputeScore`), **T004** (parseo de
los YAML), **T007** (aserciones) y **T009** (escritura atómica); T006 es P1.
Toca **T003**: ahí viven los tests que protegen la nota.
