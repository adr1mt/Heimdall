# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 4 — Compatibilidad con la GUI

## Última tarea terminada

**T042 (la GUI ya puede conducir el motor).** `version` se identifica como el
motor que la GUI espera y dice además qué es de verdad; `check` publica la
tabla con el número exacto de comprobaciones por alumno, que es lo que hace
exacta la barra de progreso; `run --export=json` escribe los ficheros del
formato antiguo y va imprimiendo el progreso en vivo, con `--cname` para elegir
aula y `--case=1,3` para evaluar solo a algunos. Cualquier otro `--export` es
error explícito antes de tocar nada. Una ejecución parcial sale con 0 **solo**
bajo `--export=json`, porque la GUI tira los informes de todo lo que no termine
con 0; sin la bandera los códigos propios (0/2/3/4) siguen intactos.

Antes: **T040**, los tres ficheros que lee la GUI actual (`--compat=teuton2`),
sin una sola credencial dentro. **T032**, la salida desbordada (ADR-0015).
**Cambio de nombre a Heimdall** (ADR-0014; la carpeta del repositorio sigue
llamándose `Evalon`). **T031**, 16 alumnos a la vez (ADR-0013). **T014**,
errores de examen con fichero y línea. **T030**, cien alumnos contra un mismo
servidor (ADR-0012). **T022**, el examen real de KEA y BIND; cierra la fase 2.
**T021**, identidad de las máquinas por ejecución (ADR-0011).

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`,
  directiva `go 1.26`.
- `cmd/heimdall`: `check`, `run` y `version`. `run` acepta `--secrets=stdin|env`
  (por defecto `env`), `--var=dir`, `--concurrency=N`,
  `--host-concurrency=N`, `--compat=teuton2` y la fachada de la GUI
  (`--export=json`, `--cname=X`, `--case=1,3`), en `cmd/heimdall/compat.go`.
  Exit codes: 0 ok · 2 config inválida · 3 parcial · 4 cancelado · 1 ni se pudo
  escribir el informe; con `--export=json`, el 3 se traduce a 0.
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
(examen RA2 entero, `make lab-ra2`) y `test/carga.sh` con A-15. Además, contra
el laboratorio y con las banderas tal cual las manda la GUI
(`run --export=json [--case=1]`): diez caracteres de progreso para dos alumnos
de cinco comprobaciones, salida 0 con un alumno roto, los tres ficheros en
`var/proto/` y cero rastros de la contraseña en ellos.

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

**T041** (`READY`, P0): apuntar la GUI al binario nuevo y pasar sus 40
escenarios e2e, sin tocar una línea de la GUI. `npm run build` **antes**, o
fallan las 40 con un error que no lo explica.
