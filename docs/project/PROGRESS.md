# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 4 — Compatibilidad con la GUI

## Última sesión

Se intentó **T041** (pasar los 40 escenarios e2e de la GUI contra el binario
nuevo) y resultó más grande de lo previsto. Queda dividida en `T043` → `T041` →
`T044`. No se tocó código. Lo comprobado:

- La suite e2e de la GUI, recién construida y contra su teutón falso, pasa
  entera: 40 en verde, 2 saltados (los de la app empaquetada).
- El motor **no** puede correr esos escenarios todavía: los proyectos que monta
  la suite son de Teutón (`config.yaml`, `start.rb`) y el motor pide
  `examen.yaml` y `aula.yaml`; sale con 2 antes de tocar ninguna máquina. Es
  **T043**.
- Una veintena de escenarios simulan averías (proceso colgado, informe
  truncado, notas imposibles, resumen viejo) que un motor real no puede
  producir a petición: prueban las defensas de la GUI, no el motor. Son
  **T044**.

Antes: **T042** (la GUI ya puede conducir el motor: `version` se identifica,
`check` publica el número exacto de comprobaciones y `run --export=json` escribe
los ficheros viejos con progreso en vivo, `--cname` y `--case`; con esa bandera
una ejecución parcial sale con 0). **T040**, los tres ficheros que lee la GUI,
sin credenciales dentro. **T032**, salida desbordada (ADR-0015). Cambio de
nombre a Heimdall (ADR-0014; la carpeta del repositorio sigue siendo `Evalon`).
**T031**, 16 alumnos a la vez (ADR-0013). **T014**, errores con fichero y línea.
**T030**, cien alumnos contra un mismo servidor (ADR-0012). **T022**, el examen
real de KEA y BIND. **T021**, identidad de las máquinas por ejecución (ADR-0011).

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `version`. `run` acepta `--secrets=stdin|env`,
  `--var=dir`, `--concurrency=N`, `--host-concurrency=N`, `--compat=teuton2` y
  la fachada de la GUI (`--export=json`, `--cname`, `--case`) en `compat.go`.
  Exit: 0 ok · 2 config inválida · 3 parcial · 4 cancelado · 1 ni se pudo
  escribir; con `--export=json` el 3 se traduce a 0. Secretos nunca por `argv`.
- `internal/model`: artefacto, `Classify`, `ComputeScore`, `StudentStatusOf`,
  `RunStatusOf`; puro. `internal/plan`: los dos YAML y las nueve validaciones.
  `internal/assert`: `contiene`, `no_contiene`, `igual_a`, `exit_code`,
  `cerca_de`. `internal/report`: escritura atómica, `latest.json`, redacción.
  `internal/legacy`: `resume.json`, `case-NN.json`, `moodle.csv`.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, `panic` recuperado por alumno, parcial tras cada alumno.
- `internal/ssh`: 2 reintentos (ninguno en `AUTH_FAILED` ni cambio de
  identidad), identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el alumno roto, puerto 2299.
- `testdata/`: `proto/`, `salida-grande/`, `clave-desconocida/`, `formato/`,
  `cuestionario/`. `test/acceptance.sh` recorre A-1 a A-14 con `jq`.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · `make test` verde contra el
laboratorio (integración de `engine` y `ssh`, `secrets.sh`, `acceptance.sh` con
13 de 14, `ra2.sh` con sus 13, `carga.sh` con A-15) · la GUI con las banderas
tal cual las manda (`run --export=json [--case=1]`) · `npm run test:e2e` de la
GUI, 40 verdes y 2 saltados.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar (F-11).
- **A-10**: los ficheros viejos ya se escriben, pero el script de aceptación
  todavía lo marca `PEND`; queda comprobarlo allí con `jq`.
- Una avería anterior a saber la máquina se anota como `desconocido` en el
  resumen viejo: el formato solo tiene sitio para una etiqueta por máquina.
- `systemctl is-active` sin `dbus` contesta con error y la comprobación sale
  suspensa, no sin evaluar. Es correcto, pero conviene saberlo.

## Siguiente tarea recomendada

**T043** (`READY`, P0): que el motor sepa evaluar el proyecto que la GUI abre
hoy. Es lo que bloquea la prueba de aceptación con la GUI.
