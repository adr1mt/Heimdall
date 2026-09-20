# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 4 — Compatibilidad con la GUI

## Última tarea terminada

**T040 (la GUI actual ya encuentra sus ficheros).** Con `--compat=teuton2` el
motor deja en `var/<proyecto>/` el resumen, un informe por alumno y el CSV de
Moodle, en el formato viejo y sin una sola credencial dentro. Un alumno al que
no se pudo evaluar del todo sale con un cero **y** con la avería de su máquina
anotada: es lo único que impide que la GUI publique una nota incompleta como si
fuera definitiva. Sin la bandera no se escribe nada de eso, y el informe propio
del motor se escribe siempre. Comparado campo a campo con informes reales de
Teuton 2.10.6 y probado contra el laboratorio.

T040 era demasiado grande: la fachada de línea de órdenes que la GUI necesita
para lanzar y reconocer el motor es ahora **T042**, y T041 espera a las dos.

Antes: **T032**, una salida desbordada se explica como lo que es y no como una
caída de red (ADR-0015). **Cambio de nombre a Heimdall** (ADR-0014, cierra D-7;
la carpeta del repositorio sigue llamándose `Evalon`). **T031**, 16 alumnos a la
vez: una clase de 30 pasa de 25 s a 13 s con 11-16 MB de memoria (ADR-0013,
`make rendimiento`, cierra D-6). **T014**, los exámenes mal escritos se explican
en español con fichero y línea. **T030**, cien alumnos contra un mismo servidor
sin perder una comprobación (ADR-0012). **T022**, el examen real de KEA y BIND
corregido entero; cierra la fase 2. **T021**, identidad de las máquinas por
ejecución (ADR-0011). **T020**, `no_contiene`, `cerca_de` y cuestionarios sin
máquina.

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
  redacción de secretos. `internal/legacy` (capa temporal): con
  `--compat=teuton2`, `resume.json`, `case-NN.json` y `moodle.csv` en
  `var/<nombre del directorio del proyecto>/`.
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
- **A-10**: ya se escriben los ficheros del formato viejo, pero el script de
  aceptación todavía lo marca `PEND`; queda comprobarlo allí con `jq`.
- Una avería que ocurre antes de saber a qué máquina se iba se anota en el
  resumen viejo como `desconocido`: el formato antiguo solo tiene sitio para
  una etiqueta por máquina.
- `systemctl is-active` sin `dbus` en la máquina del alumno contesta con error
  y la comprobación sale suspensa, no sin evaluar. Es correcto —el comando
  respondió— pero conviene saberlo al montar una imagen de examen.

## Siguiente tarea recomendada

**T042** (`READY`, P1): la fachada de línea de órdenes que la GUI usa para
lanzar el motor, reconocerlo y ver el progreso en vivo. Con ella hecha se puede
pasar la UAT de los 40 escenarios (T041).
