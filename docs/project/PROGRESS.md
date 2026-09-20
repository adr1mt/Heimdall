# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 1 — Rebanada vertical

## Última tarea terminada

**T006 (laboratorio SSH).** Ya se levanta con un comando la máquina de pruebas
contra la que se probará la conexión, igual en cualquier sesión y en cualquier
equipo, y se borra sin dejar rastro. Con eso desbloqueado, lo siguiente es el
trozo que se conecta a las máquinas de los alumnos (T008).

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`. `~/.profile`
  lo añade al `PATH`; en shell no interactiva hay que exportarlo a mano.
  `go.mod`: `module evalon`, `go 1.22`. El nombre es provisional (D-7).
- `cmd/evalon`: `check` y `version` funcionan; `run` sigue sin implementar.
  Exit codes: 0 ok · 2 config inválida · 3 parcial · 4 cancelado; el 1 libre.
- `internal/model` tiene el artefacto completo (T002) más `Classify`,
  `ComputeScore`, `StudentStatusOf` y `RunStatusOf`. Ni red, ni disco, ni
  reloj: hay un test que parsea el paquete y lo comprueba. `EXCLUDED` sale del
  inventario, nunca del cálculo.
- `internal/assert` evalúa `contiene`, `igual_a` y `exit_code` como funciones
  puras sobre `ExecutionResult`. `Eval` devuelve error si la ejecución no se
  completó: sin ejecución fiable no hay comparación, y por tanto no hay FAIL.
  Un tipo de aserción desconocido es error, nunca «no coincide».
- `internal/report` escribe `var/run-<ulid>.json` con temporal y `rename`,
  `var/run-<ulid>.partial.json` por alumno, `var/latest.json` como symlink.
  ULID propio (26 caracteres, sin dependencia nueva). Filtro de redacción:
  sustituye los secretos conocidos por `[oculto]` y añade un `Warning`
  `SECRET_REDACTED`; trabaja sobre una copia, no toca el artefacto del motor.
- `internal/plan` lee los dos YAML (T004) y resuelve el PLAN (T005): las nueve
  validaciones del §5, sustitución `${alumno.X}` y `${host.ip|puerto|usuario}`,
  hashes del examen, del aula y del plan resuelto. El esquema conoce
  `cerca_de`, `no_contiene` y `valor:`; evaluarlos es de fase 2.
- Un secreto `${MAYUSCULAS}` fuera de `password_ref` es error de PLAN, también
  en los campos libres del alumno: por ahí entraría en un comando.
- `testdata/proto/` existe ya (5 comprobaciones, peso 6, `alumne02` contra un
  puerto cerrado). Lo creó T005 para poder probar `check`; T012 lo revisará.
- Única dependencia externa: `gopkg.in/yaml.v3`. Ficheros de prueba: los del
  diseño en `testdata/formato/`, los malformados junto a su paquete.
- `Makefile` con `check`, `test`, `build`, `lab`, `lab-down` y `lab-status`.
  Los tres últimos llaman a `test/lab.sh`, que levanta un único contenedor
  `alu1` en `127.1.2.3:2201`, espera a que escuche y es idempotente. El alumno
  roto usa `127.1.2.3:2299`, puerto cerrado, sin segundo contenedor.
  Credenciales ficticias y HOME aislado documentados en `test/README.md`.

## Pruebas ejecutadas

`make check` verde · `gofmt -l` sin salida · `go test -race -count=2
./internal/report` verde: 8 tandas simultáneas dejan 8 ficheros completos y
ningún temporal; un subproceso que se manda un SIGKILL deja un `partial.json`
válido con el alumno ya terminado; un secreto inyectado en un stderr simulado
sale como `[oculto]` con su aviso. `make lab` dos veces seguidas desde cero deja `127.1.2.3:2201` escuchando,
un `ssh` manual con las credenciales de prueba entra y devuelve 0, y
`make lab-down` deja el equipo sin contenedores ni puertos abiertos.
`./bin/evalon check testdata/proto` imprime
5 comprobaciones y peso 6 y sale 0; el proyecto inválido sale 2 sin crear
`var/`. Verificado por mutación en T004 (5 casos) y T005 (8 casos).

## Problemas conocidos

- Laboratorio SSH en **`127.1.2.3`, no `127.0.0.1`**: con `127.0.0.x` Teuton
  ejecuta en local (F-01) y el criterio A-11 comprueba que el motor nuevo no.
- Ejecutar Teuton con `HOME` aislado (`workspace/sshlab/fakehome`): una entrada
  ed25519 en el `known_hosts` real tumba la ejecución (F-12).
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo, con un
  error que no lo explica.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar: allí `tt_skip: true`
  aborta la ejecución (F-11).
- El golden es de redacción manual, con hashes de relleno; sale uno real en T013.

## Decisiones inesperadas de la sesión

- El laboratorio se queda en un solo contenedor: el alumno roto no necesita
  máquina, le basta un puerto cerrado.
- `assert.Eval` devuelve error, no un resultado «no coincide», cuando la
  ejecución no se completó o la aserción no está soportada.
- ULID implementado en el propio repo en vez de añadir una dependencia.
- Anteriores (una aserción por comprobación, alumno excluido sin resolver,
  `${alumno.X}` sobre `id`/`nombre`/`moodle_id`) y sus motivos: `DECISIONS.md`.

## Siguiente tarea recomendada

**T008** (sesión SSH, exec, límites de salida y timeouts, P0), ya `READY`.
Desbloquea T010 y el resto de la fase 1.
