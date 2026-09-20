# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 2 — Formato completo y robustez de ejecución

## Última tarea terminada

**T022 (el examen RA2 del curso, corregido entero).** El examen real de
servicios de red —las dieciséis comprobaciones de KEA y BIND, con sus mismos
pesos— se corrige de principio a fin contra un laboratorio de dos máquinas. La
entrega completa saca 100 y la entrega con cuatro errores y el servidor DNS
parado saca 69, y el informe dice de cada suspenso qué se esperaba y qué había.
Al formato no le falta nada: las dieciséis se escriben sin inventar ninguna
forma nueva de comprobar. Cierra la fase 2.

Antes, **T021** (identidad de las máquinas, D-3 cerrada). Como el alumnado
examina sobre máquinas virtuales de usar y tirar, el motor deja de guardar la
identidad de las máquinas entre exámenes: la apunta durante la corrección, la
escribe en el informe y rechaza a la máquina que cambie de identidad a mitad.
Nunca se toca el fichero de claves del profesor. La entrada con clave SSH se
queda fuera: el aula usa contraseña (T023, sin empezar).

Antes, **T020**: comprobar que algo **no** está, que un valor aparece **cerca**
de otro, y corregir un cuestionario sin ejecutar nada en ninguna máquina.
**T013**: ADR-0010 y `docs/design/ejemplo-run.json`. **T012**: los catorce
criterios del hito, trece en verde, en `ACEPTACION-FASE1.md`.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module evalon`,
  directiva `go 1.26`. Nombre provisional (D-7).
- `cmd/evalon`: `check`, `run` y `version`. `run` acepta `--secrets=stdin|env`
  (por defecto `env`), `--var=dir` y `--concurrency=N`. Exit codes: 0 ok · 2
  config inválida · 3 parcial · 4 cancelado · 1 ni se pudo escribir el informe.
  Los secretos entran por una línea JSON leída byte a byte, con corte a los 5 s
  y el buffer a cero, o por las variables que nombra el `aula.yaml` y solo esas.
  Nunca por `argv`.
- `internal/model`: artefacto completo, `Classify`, `ComputeScore`,
  `StudentStatusOf`, `RunStatusOf`. Puro. `internal/plan`: los dos YAML, las
  nueve validaciones del §5, sustituciones y hashes. `internal/assert`:
  `contiene`, `no_contiene`, `igual_a`, `exit_code` y `cerca_de`, puras. Una
  comprobación `valor:` no abre sesión y se anota `transport: "inventory"`.
  `internal/report`: escritura atómica, parciales, `latest.json`, ULID propio y
  redacción de secretos.
- `internal/engine`: pool de 2, una sesión por host y alumno, presupuesto por
  alumno, `panic` recuperado por alumno, parcial tras cada alumno, `ExitCode`
  (0/3/4). `CheckSecrets` antes de conectar.
- `internal/ssh`: `Dial` con 2 reintentos y ninguno en `AUTH_FAILED` ni en un
  cambio de identidad; registro de identidades por ejecución, en memoria, con la
  huella en `warnings` (ADR-0011); sin pty, 64 kB por flujo, corte duro a 8 MB,
  envoltura `timeout -k 5s N` con aviso si no la hay.
- `test/lab.sh` (`make lab`, `lab-status`, `lab-down`): contenedor `alu1` en
  `127.1.2.3:2201`, idempotente; el alumno roto usa el puerto cerrado 2299.
  Credenciales ficticias en `test/README.md`.
- `testdata/`: `proto/` (5 comprobaciones, peso 6, idéntico al §5 y verificado),
  `salida-grande/` (A-6), `clave-desconocida/` (A-13), `formato/` (E2) y
  `cuestionario/` (E1, diez preguntas sin ninguna máquina). `test/acceptance.sh`
  (`make test`) recorre A-1 a A-14 con `jq` y `/usr/bin/time`, una línea por
  criterio; A-2, A-3 y A-14 también como test puro en `internal/model`.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · `make test` verde contra el
laboratorio: integración de `engine` y `ssh`, `test/secrets.sh`,
`test/acceptance.sh` con 13 de los 14 criterios y `test/ra2.sh` con los 13
suyos (examen RA2 entero, `make lab-ra2`). Además, contra el laboratorio:
la anticomprobación de un alumno inalcanzable sale `UNEVALUATED` y nunca `PASS`,
y una máquina que cambia de identidad se rechaza con el motivo escrito.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, criterio A-11).
- Teuton se ejecuta con `HOME` aislado (`workspace/sshlab/fakehome`): una
  entrada ed25519 en el `known_hosts` real lo tumba (F-12). Al motor nuevo ya no
  le afecta: no lee ese fichero.
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar (F-11).
- **A-10 sigue pendiente**: pide los ficheros del formato viejo, que los escribe
  T040 (fase 3). El script lo marca `PEND` y no rompe el exit code.
- `systemctl is-active` sin `dbus` en la máquina del alumno contesta con error
  y la comprobación sale suspensa, no sin evaluar. Es correcto —el comando
  respondió— pero conviene saberlo al montar una imagen de examen.
- Un valor del tipo equivocado en una clave conocida escapa jerga de Go al
  mensaje de error (`plan.NearSpec`). Anotado como T014.

## Siguiente tarea recomendada

Fase 2 cerrada. **T030** (concurrencia acotada global y por host, fase 3) queda
`READY` al terminar T022. También sigue `READY` **T014** (P2): un examen mal
escrito debe explicarse en español con fichero, línea y clave.
