# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 1 — Rebanada vertical

## Última tarea terminada

**T013 (la fase 1, registrada).** El ejemplo del modelo de resultado ya no es
una redacción a mano: es la salida real del laboratorio
(`docs/design/ejemplo-run.json`). Se cierra la duda sobre cómo hablamos con las
máquinas de los alumnos (ADR-0010) con mediciones, no con preferencias: un
examen con una máquina apagada y un comando eterno dentro acaba en 4,8 s, y un
alumno que escupe 300 MB deja el motor en 15,5 MB, igual que uno que escupe 1.
El profesor puede ver resultados parciales a los 3,2 s.

Antes, **T012**: un script comprueba solo, uno por uno, los catorce criterios
del hito (trece en verde, A-10 espera al formato viejo). Salida literal en
`docs/design/ACEPTACION-FASE1.md`.

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
  `contiene`, `igual_a`, `exit_code`, puras. `internal/report`: escritura
  atómica, parciales, `latest.json`, ULID propio y redacción de secretos.
- `internal/engine`: pool de 2, una sesión por host y alumno, presupuesto por
  alumno, `panic` recuperado por alumno, parcial tras cada alumno, `ExitCode`
  (0/3/4). Las aserciones que faltan y las comprobaciones `valor:` salen
  `ENGINE_ERROR` explicado (T020). `CheckSecrets` antes de conectar.
- `internal/ssh`: `Dial` con 2 reintentos y ninguno en `AUTH_FAILED`;
  `known_hosts` propio en `var/` con TOFU (D-3, provisional); sin pty, 64 kB por
  flujo, corte duro a 8 MB, envoltura `timeout -k 5s N` con aviso si no la hay.
- `test/lab.sh` (`make lab`, `lab-status`, `lab-down`): contenedor `alu1` en
  `127.1.2.3:2201`, idempotente; el alumno roto usa el puerto cerrado 2299.
  Credenciales ficticias en `test/README.md`.
- `testdata/`: `proto/` (5 comprobaciones, peso 6, idéntico al §5 y verificado),
  `salida-grande/` (A-6) y `clave-desconocida/` (A-13). `test/acceptance.sh`
  (`make test`) recorre A-1 a A-14 con `jq` y `/usr/bin/time`, una línea por
  criterio; A-2, A-3 y A-14 también como test puro en `internal/model`.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · `make test` verde contra el
laboratorio: integración de `engine` y `ssh` (22 tests), `test/secrets.sh` y
`test/acceptance.sh` con 13 de los 14 criterios en verde, los cinco que protegen
la nota incluidos. Salida literal en `docs/design/ACEPTACION-FASE1.md`.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, criterio A-11).
- Teuton se ejecuta con `HOME` aislado (`workspace/sshlab/fakehome`): una
  entrada ed25519 en el `known_hosts` real lo tumba (F-12).
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar (F-11).
- **A-10 sigue pendiente**: pide los ficheros del formato viejo, que los escribe
  T040 (fase 3). El script lo marca `PEND` y no rompe el exit code.
- Un valor del tipo equivocado en una clave conocida escapa jerga de Go al
  mensaje de error (`plan.NearSpec`). Anotado como T014.

## Siguiente tarea recomendada

**T014** (mensajes de error del YAML sin jerga de Go, P2), ya `READY`. Un examen
mal escrito debe explicarse en español con fichero, línea y clave; hoy un valor
del tipo equivocado escupe el nombre de un tipo interno.
