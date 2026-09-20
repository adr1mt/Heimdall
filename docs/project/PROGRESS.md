# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T063 hecha**: el motor ya publica la sesión de examen y la vuelta siguiente
deja fuera a quien ha terminado.

Dos cosas nuevas. Una, se puede pedir la sesión entera de una práctica: de cada
alumno dice la nota que vale, de qué vuelta sale, si ya ha terminado y qué dijo
cada vuelta. No escribe nada: se lee y ya está.

Dos, quien ya tiene el examen entero bien deja de ser molestado. La vuelta
siguiente no abre ni una conexión contra su máquina —comprobado contra el
laboratorio, mirando el registro de la máquina— y en el resultado de esa vuelta
sale con el motivo escrito: «en la vuelta 1 ya lo tenía todo bien». Nunca un
cero ni un «sin evaluar». Su nota sigue siendo la de aquella vuelta. Los demás
reciben exactamente las mismas comprobaciones y los mismos pesos de siempre.

Una sesión que no sea de este examen para la corrección antes de tocar ninguna
máquina y dice cuál no encaja.

Falta que se vea en pantalla: eso es T064.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `session`, `version`. `run`:
  `--secrets=stdin|env`, `--var`, `--cname`, `--case`, `--concurrency`,
  `--host-concurrency`, `--events=ndjson`, `--retry=<artefacto>`,
  `--session=<vuelta>` (repetible) y, congeladas,
  `--compat=teuton2` y `--export=json`. Exit: 0 ok · 2 config · 3 parcial ·
  4 cancelado · 1 sin escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf`,
  `Consolidate` (ADR-0019) y `BuildSession` (ADR-0020: mejor vuelta completa;
  `ACTIVE`/`FINISHED` derivados, `FINISHED` solo con el peso entero; una vuelta
  que deja al alumno fuera no le quita la nota que ya tenía). El rastro de los
  intentos anteriores no entra en ninguna nota. `plan`: los dos YAML y nueve validaciones. `assert`: cinco
  aserciones. `report`: escritura atómica y redacción. `events`: NDJSON.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno, selección de reintento y `ExcludeFinished`
  (deja fuera a los terminados sin tocar el denominador). `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`, el roto en el 2299;
  `acceptance.sh` recorre A-1 a A-14, `eventos.sh` E-1 a E-10 y `sesion.sh`
  S-1 a S-8 sobre `testdata/sesion`.
- `gui/`: árbol Node independiente; `make gui-check` (125 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Histórico, Ajustes, Ayuda. Inicio
  lleva el **modo examen** (vueltas encadenadas, una cada vez) y la barra
  lateral el **modo proyector**. Resultados enseña lo no comprobado, manda el
  reintento a Inicio, **exporta a CSV** y **enseña la cadena consolidada**
  llamando a `heimdall consolidate`. El histórico lee `var/run-*.json` del
  examen. `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` verde. `acceptance.sh`, `eventos.sh` y el nuevo `sesion.sh`
(S-1 a S-8) verdes contra el laboratorio. `make gui-check`, `make gui-lab` y
`make test` no se repitieron esta sesión; quedaron verdes antes.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido; sin examen elegido no
  hay lista, y para eso está «Abrir otro resultado…».
- Un reintento exige el mismo PLAN: si lo que estaba mal era el `aula.yaml`,
  esa clase se corrige entera otra vez.
- El modo examen de la aplicación sigue enseñando la última vuelta, no la
  mejor, y no le pasa la sesión al motor: eso llega en T064. Intervalo mínimo,
  5 minutos.
- El proyector tapa las máquinas, no los nombres del alumnado.

## Siguiente tarea recomendada

**T064** (`READY`, P1): que la aplicación encadene el examen sobre la sesión —la
mejor vuelta, quién ha terminado— en vez de sobre la última vuelta suelta. A la
par, **T059** sigue `READY` y cierra la fase 5 con el inventario de lo
heredado.
