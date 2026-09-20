# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 1 — Rebanada vertical

## Última tarea terminada

**T011 (ya se corrige desde la terminal).** Una orden corrige el prototipo de
punta a punta. La contraseña del aula entra por un canal privado, nunca escrita
en la orden: ningún otro usuario del equipo la ve mirando los procesos. Si el
profesor olvida pasarla, el programa para a los cinco segundos en vez de
quedarse colgado delante de la clase; si nombra una que no existe, para con un
error claro en vez de entrar con la contraseña vacía y suspender a todos. Al
acabar imprime quién se ha evaluado, quién no y dónde está el informe. Ctrl-C
para la corrección y el informe se escribe igual.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module evalon`,
  directiva `go 1.26`. Nombre provisional (D-7).
- `cmd/evalon`: `check`, `run` y `version` funcionan. `run` acepta
  `--secrets=stdin|env` (por defecto `env`), `--var=dir` y `--concurrency=N`.
  Exit codes: 0 ok · 2 config inválida · 3 parcial · 4 cancelado · 1 el motor no
  pudo ni escribir el artefacto.
- `cmd/evalon/secrets.go`: los secretos entran por una línea JSON
  (`{"schema":1,"secrets":{...}}`) leída byte a byte, con corte a los 5 s y el
  buffer puesto a cero, o por las variables que nombra el `aula.yaml` y solo
  esas. Nunca por `argv`.
- `internal/model`: artefacto completo, `Classify`, `ComputeScore`,
  `StudentStatusOf`, `RunStatusOf`. Puro. `internal/plan`: los dos YAML, las
  nueve validaciones del §5, sustituciones y hashes. `internal/assert`:
  `contiene`, `igual_a`, `exit_code`, puras. `internal/report`: escritura
  atómica, parciales, `latest.json`, ULID propio y redacción de secretos.
- `internal/engine`: `Run` recorre el PLAN, pool de 2, una sesión por
  host y alumno, presupuesto por alumno, `panic` recuperado por alumno
  (`ENGINE_ERROR` + aviso), parcial tras cada alumno y `ExitCode` (0/3/4). Las
  aserciones que faltan y las comprobaciones `valor:` salen `ENGINE_ERROR`
  explicado (T020). `CheckSecrets` antes de conectar: una referencia sin valor
  nunca es contraseña vacía.
- `internal/ssh`: `Dial` con 2 reintentos y sin reintento en `AUTH_FAILED`;
  `known_hosts` propio en `var/` con TOFU (D-3, provisional); `Run` sin pty,
  64 kB por flujo, corte duro a 8 MB, envoltura `timeout -k 5s N` cuando la
  máquina tiene coreutils y aviso cuando no.
- `test/lab.sh` (`make lab`, `lab-down`, `lab-status`): un contenedor `alu1` en
  `127.1.2.3:2201`, idempotente. Credenciales ficticias y HOME aislado en
  `test/README.md`. El alumno roto usa `127.1.2.3:2299`, puerto cerrado.
- `testdata/proto/` existe ya (5 comprobaciones, peso 6). Lo revisará T012.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · integración verde contra el
laboratorio: el prototipo da PASS/PASS/PASS, FAIL en el comando inexistente y
UNEVALUATED/TIMEOUT en `sleep 30`; provisional 80, sin nota final; el alumno del
puerto cerrado sale entero con `CONNECT_FAILED` sin mover un número del otro.
10 tests de `internal/engine` y 12 de `internal/ssh`.
`test/secrets.sh` verde contra el laboratorio (ya en `make test`): stdin vacío y
stdin colgado abortan con exit 2 (el segundo a los 5 s), referencia sin variable
exit 2, el prototipo completo exit 3, y cero coincidencias del secreto en `var/`,
en el terminal y en `/proc/<pid>/cmdline` con el proceso vivo. 7 tests nuevos en
`cmd/evalon`.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, criterio A-11).
- Teuton se ejecuta con `HOME` aislado (`workspace/sshlab/fakehome`): una
  entrada ed25519 en el `known_hosts` real lo tumba (F-12).
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar (F-11).
- El golden es de redacción manual; sale uno real en T013.

## Siguiente tarea recomendada

**T012** (los 14 criterios de aceptación de la rebanada vertical, P0), ya
`READY`. Toca comprobar uno por uno los criterios A-1 a A-14 con `jq` sobre el
artefacto real y repasar `testdata/proto/`, que hasta ahora nadie ha revisado.
