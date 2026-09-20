# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 1 — Rebanada vertical

## Última tarea terminada

**T010 (el motor completo de una pasada).** El motor ya corrige a toda la clase
de una vez: dos alumnos a la vez, cada uno con su propia conexión, su propio
tiempo y su propio resultado. Un alumno con la máquina apagada, con una avería
o con un fallo interno del motor no le cambia ni un punto a los demás: sale en
el informe con sus comprobaciones sin evaluar y explicadas, nunca suspendidas.
Cada alumno tiene un tiempo máximo propio; lo que no dé tiempo a comprobar sale
como no ejecutado, no como fallo. Si el profesor para la corrección a media, el
informe se escribe igual con lo que hubiera.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module evalon`,
  directiva `go 1.26`. Nombre provisional (D-7).
- `cmd/evalon`: `check` y `version` funcionan; `run` sigue sin implementar.
  Exit codes: 0 ok · 2 config inválida · 3 parcial · 4 cancelado; el 1 libre.
- `internal/model`: artefacto completo, `Classify`, `ComputeScore`,
  `StudentStatusOf`, `RunStatusOf`. Puro, con test que lo comprueba.
- `internal/plan`: los dos YAML, las nueve validaciones del §5, sustituciones y
  hashes. `internal/assert`: `contiene`, `igual_a`, `exit_code`, puras.
- `internal/report`: escritura atómica, parciales por alumno, `latest.json`,
  ULID propio y filtro de redacción de secretos.
- `internal/engine` (nuevo): `Run` recorre el PLAN, pool de 2, una sesión por
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

`make check` verde · `gofmt -l` sin salida · `go test -race -tags=integration
./internal/engine` verde contra el laboratorio: el prototipo da PASS/PASS/PASS,
FAIL en el comando inexistente y UNEVALUATED/TIMEOUT en `sleep 30`; provisional
80, sin nota final; el alumno del puerto cerrado sale entero con
`CONNECT_FAILED` y no mueve ni un número del otro; la contraseña no aparece en
el artefacto. 10 tests rápidos de `internal/engine` (alumno roto, panic,
cancelación, presupuesto, sesión única, excluido, secreto sin valor).
`go test -race -tags=integration ./internal/ssh` verde, 12 tests (timeouts,
reintentos, 300 MB cortados, contraseña fuera de `argv`, TOFU).

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, criterio A-11).
- Teuton se ejecuta con `HOME` aislado (`workspace/sshlab/fakehome`): una
  entrada ed25519 en el `known_hosts` real lo tumba (F-12).
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar (F-11).
- El golden es de redacción manual; sale uno real en T013.

## Siguiente tarea recomendada

**T011** (CLI `run`, secretos por stdin y por env, P0), ya `READY`. Falta
enganchar el motor al binario: leer los secretos sin pasar por `argv`, atender
al Ctrl-C y escribir el artefacto con el código de salida que corresponda.
