# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 1 — Rebanada vertical

## Última tarea terminada

**T008 (conexión con las máquinas).** El motor ya entra en la máquina de un
alumno, ejecuta un comando y cuenta con fidelidad qué pasó: si terminó, con qué
código, y qué escribió por cada lado. Nunca se queda colgado: si el comando se
pasa de tiempo, lo mata en la máquina del alumno y lo dice; si no puede matarlo,
avisa de que puede haber quedado algo corriendo. Una salida gigante ni llena la
memoria ni retrasa la corrección. Con la máquina apagada reintenta; con la
contraseña mal, no: reintentar podría bloquear la cuenta del alumno.

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
- `internal/ssh` (nuevo): `Dial` con 2 reintentos (1 s y 3 s más jitter) y sin
  reintento en `AUTH_FAILED`; `known_hosts` propio en `var/` con TOFU y aviso
  (D-3, provisional); `Run` sin pty, flujos separados, 64 kB conservados por
  flujo, corte duro a 8 MB que cierra la sesión, `bytes_total` real y corte en
  frontera de runa; envoltura `timeout -k 5s N` si la máquina tiene coreutils
  (`KILLED_REMOTE`) y aviso `REMOTE_TIMEOUT_UNAVAILABLE` si no (`UNKNOWN`).
  Dependencia nueva: `golang.org/x/crypto/ssh`, ya permitida.
- `test/lab.sh` (`make lab`, `lab-down`, `lab-status`): un contenedor `alu1` en
  `127.1.2.3:2201`, idempotente. Credenciales ficticias y HOME aislado en
  `test/README.md`. El alumno roto usa `127.1.2.3:2299`, puerto cerrado.
- `testdata/proto/` existe ya (5 comprobaciones, peso 6). Lo revisará T012.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · `go test -race -tags=integration
./internal/ssh` verde, 12 tests: comando normal con los dos flujos y su código;
`sleep 30` con 3 s da 3,1 s y `KILLED_REMOTE`; con el `timeout` escondido en el
contenedor da `UNKNOWN` y su aviso; puerto cerrado da `CONNECT_FAILED` en 3
intentos y 4,5 s; contraseña mala da `AUTH_FAILED` con 1 intento; 300 MB de
`/dev/zero` se cortan en 0,17 s con `bytes_total` real y sin crecer la memoria;
la contraseña no aparece en `argv`; TOFU escribe y no repite el aviso.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, criterio A-11).
- Teuton se ejecuta con `HOME` aislado (`workspace/sshlab/fakehome`): una
  entrada ed25519 en el `known_hosts` real lo tumba (F-12).
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar (F-11).
- El golden es de redacción manual; sale uno real en T013.

## Siguiente tarea recomendada

**T010** (motor: worker pool, presupuesto por alumno y cancelación, P0), ya
`READY`. Es la pieza que une PLAN, sesión SSH, aserciones y escritura.
