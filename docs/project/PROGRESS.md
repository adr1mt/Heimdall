# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 3 — Concurrencia, cancelación y límites

## Última tarea terminada

**T030 (la corrección de una clase entera contra un solo servidor).** Cien
alumnos examinándose sobre la misma máquina se corrigen sin que el motor pierda
ni una comprobación: ahora abre como mucho cuatro conexiones a la vez contra un
mismo destino y evalúa ocho alumnos en paralelo. Sin ese freno, el servidor
rechazaba cerca de la mitad de las conexiones —39 a 49 de cada 100 en la
medida— que es el fallo que en Teuton dejaba 53 ceros de 100. El informe dice
con qué topes se corrigió y el profesor puede cambiarlos. ADR-0012; D-6 queda
solo a falta de medir cuántos alumnos en paralelo convienen (T031).

Antes, **T022**: el examen real de KEA y BIND corregido entero contra el
laboratorio (100 y 69); cierra la fase 2. **T021**: identidad de las máquinas
por ejecución (ADR-0011). **T020**: `no_contiene`, `cerca_de` y cuestionarios
sin máquina.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module evalon`,
  directiva `go 1.26`. Nombre provisional (D-7).
- `cmd/evalon`: `check`, `run` y `version`. `run` acepta `--secrets=stdin|env`
  (por defecto `env`), `--var=dir`, `--concurrency=N` y
  `--host-concurrency=N`. Exit codes: 0 ok · 2 config inválida · 3 parcial · 4 cancelado · 1 ni se pudo escribir el informe.
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
- `internal/engine`: pool de 8 y 4 aperturas de sesión por máquina de destino
  (`hostgate.go`, solo la apertura: una sesión abierta no cuenta para
  `MaxStartups`), una sesión por host y alumno, presupuesto por alumno,
  `panic` recuperado por alumno, parcial tras cada alumno, `ExitCode`
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
`test/acceptance.sh` con 13 de los 14 criterios, `test/ra2.sh` con los 13 suyos
(examen RA2 entero, `make lab-ra2`) y `test/carga.sh` con A-15 (cien alumnos
contra un host). Además, contra el laboratorio: la anticomprobación de un alumno inalcanzable sale `UNEVALUATED` y nunca `PASS`,
y una máquina que cambia de identidad se rechaza con el motivo escrito.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, criterio A-11).
- Teuton se ejecuta con `HOME` aislado (F-12); al motor nuevo no le afecta.
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

**T031** (`READY`, P2): medir tiempo y memoria con 10, 30 y 100 alumnos y con
salidas de 1/20/100/300 MB, fijar con eso cuántos alumnos en paralelo y cerrar
D-6. También sigue `READY` **T014** (P2): un examen mal escrito debe explicarse
en español con fichero, línea y clave.
