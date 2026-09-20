# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 1 — Rebanada vertical

## Última tarea terminada

**T005 — resolución del PLAN y subcomando `check`.** `evalon check <directorio>`
dice cuántas comprobaciones tiene el examen y cuánto pesan en total, sin abrir
ninguna conexión y sin escribir nada. Fase 0 cerrada.

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
- `Makefile` con `check`, `test`, `build`, `lab` y `lab-down`. `make lab`
  levanta `alu1` y `alu2` en `127.1.2.3:2201-2202` con podman.

## Pruebas ejecutadas

`make check` verde en 0,7 s · `gofmt -l` sin salida. `./bin/evalon check
testdata/proto` imprime 5 comprobaciones y peso 6 y sale 0; el proyecto
inválido sale 2 sin crear `var/`. Verificado por mutación en T004 (5 casos) y
en T005: referencia ausente convertida en cadena vacía, secreto admitido en el
examen y en un campo libre, peso negativo, contraseña literal, dos aserciones,
alumno excluido con comprobaciones y aula sin alumnos evaluables. Las ocho las
detecta la suite.

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

- Una aserción por comprobación, exactamente una: el diseño hablaba de
  «aserciones incompatibles» sin decir cuáles.
- El alumno excluido no se resuelve: no se le piden hosts ni campos. Pedírselos
  empujaría a inventar datos de inventario.
- `${alumno.X}` ve también `id`, `nombre` y `moodle_id`.
- Las cuatro, con su motivo, en `DECISIONS.md`.

## Siguiente tarea recomendada

Fase 0 cerrada (T001-T005). Quedan `READY`: **T007** (aserciones, P0), **T009**
(escritura atómica, P0) y **T006** (laboratorio SSH, P1). Toca **T007**: es
lógica pura, se prueba sin máquinas y T010 la necesita. T006 hay que hacerlo
antes que T008, que es lo único que toca red.
