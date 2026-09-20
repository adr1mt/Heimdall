# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 3 — Concurrencia, cancelación y límites

## Última tarea terminada

**Cambio de nombre: el proyecto se llama Heimdall** (antes `Evalon`). Módulo,
CLI, binario, documentación y scripts renombrados; `docs/research/` intacto por
ser evidencia histórica. ADR-0014; D-7 queda cerrada. La carpeta del
repositorio sigue llamándose `Evalon` hasta que se renombre a mano.

Antes, **T031 (cuántos alumnos a la vez, ya no a ojo).** Medido: una clase de 30
alumnos con máquina propia se corrige ahora en la mitad de tiempo (de 25 s a
13 s), porque el motor lleva 16 alumnos a la vez en vez de 8. La memoria no lo
paga: se queda en 11-16 MB siempre, tanto con 10 alumnos como con 100, y tanto
si una máquina contesta 1 MB como si contesta 300. Teuton llegaba a 970 MB con
esos 300 MB. Cien alumnos contra un solo servidor siguen en 3 s y sin un solo
cero técnico. ADR-0013 y `make rendimiento`; D-6 queda cerrada.

Antes, **T014 (los errores del examen se leen en español).** Un examen mal escrito ya
no contesta con jerga del motor: `cerca_de: 3` dice «la clave "cerca_de" debe
ser un bloque de claves», con el fichero y la línea. El motor comprueba la
forma de cada valor antes de leerlo, así que ningún mensaje de la librería de
YAML llega al profesor. Verificado con un test de tabla que prueba un valor del
tipo equivocado en cada clave de `examen.yaml` y de `aula.yaml`.

**T030**: cien alumnos contra un mismo servidor se corrigen sin perder
ni una comprobación, con cuatro conexiones a la vez por máquina y ocho alumnos
en paralelo (ADR-0012).

**T022**: el examen real de KEA y BIND corregido entero contra el
laboratorio (100 y 69); cierra la fase 2. **T021**: identidad de las máquinas
por ejecución (ADR-0011). **T020**: `no_contiene`, `cerca_de` y cuestionarios
sin máquina.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`,
  directiva `go 1.26`.
- `cmd/heimdall`: `check`, `run` y `version`. `run` acepta `--secrets=stdin|env`
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
- `internal/engine`: pool de 16 y 4 aperturas de sesión por máquina de destino
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

## Siguiente tarea recomendada

**T032** (`READY`, P2): una máquina que contesta más de 8 MB deja hoy la
comprobación sin evaluar por conexión perdida; hay que aprovechar los 64 kB
que sí se leyeron. Nadie suspende por ello, así que no corre prisa.
