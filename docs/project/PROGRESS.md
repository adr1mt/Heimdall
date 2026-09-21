# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T066 hecha**: con el proyector encendido ya no se lee la dirección de la
máquina de nadie. Faltaba taparla en el motivo técnico de una comprobación
—«no se ha podido conectar con tal dirección»—, que es lo único que queda en
pantalla cuando la máquina ni siquiera respondió. Fuera del proyector el motivo
se sigue leyendo entero.

**T064 hecha** (sesión anterior): durante el examen la pantalla ya enseña lo
que vale cada alumno, no la última vuelta suelta.

En Inicio, mientras dura el examen, hay un panel con la clase: la nota con la
que se queda cada uno, de qué vuelta sale, quién ha terminado —y que ya no se
le corrige— y, desplegable, lo que dijo cada vuelta. Quien no tiene ninguna
vuelta entera sale sin nota y con el motivo, nunca con un cero. Se exporta
desde ahí, con una columna que dice de qué vuelta sale cada nota.

Ninguna de esas notas se calcula en la aplicación: se le piden al motor con las
vueltas de este examen, y viajan con la vuelta siguiente para que deje fuera a
los terminados.

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
  `Consolidate` (ADR-0019) y `BuildSession` (ADR-0020: mejor vuelta completa,
  `FINISHED` solo con el peso entero, y una vuelta que deja al alumno fuera no
  le quita la nota que ya tenía). `plan`: los dos YAML y nueve validaciones.
  `assert`: cinco aserciones. `report`: escritura atómica y redacción.
  `events`: NDJSON.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno, reintento y `ExcludeFinished` (deja fuera a
  los terminados sin tocar el denominador). `internal/ssh`: 2 reintentos,
  identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`, el roto en el 2299. `acceptance.sh`
  (A-1 a A-14), `eventos.sh` (E-1 a E-10) y `sesion.sh` (S-1 a S-8).
- `gui/`: árbol Node independiente; `make gui-check` (144 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Histórico, Ajustes, Ayuda. Inicio
  lleva el **modo examen** (vueltas encadenadas, una cada vez) y **el panel de
  la sesión**, que llama a `heimdall session` con las vueltas de este examen y
  manda la lista con la vuelta siguiente. La barra lateral, el **modo
  proyector**. Resultados enseña lo no comprobado, manda el reintento a Inicio,
  **exporta a CSV** y **enseña la cadena consolidada** con `heimdall
  consolidate`. El histórico lee `var/run-*.json` del examen.
  `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` verde. `make gui-check` verde (144 pruebas). `make gui-build`
verde. `gui/scripts/examen-lab.ts` contra el laboratorio: E-1 a E-5, **P-1 a
P-3**, C-1 a C-3 y S-5 en verde, con el proyector abriendo la comprobación de
un alumno cuya máquina no respondió (T066). La cadena (E-6, E-7, S-1 a S-4) no
se repitió esta sesión; quedó verde antes. `acceptance.sh`, `eventos.sh`,
`sesion.sh` y `make test` no se repitieron esta sesión; quedaron verdes antes.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido; para lo demás está
  «Abrir otro resultado…».
- Un reintento exige el mismo PLAN: si lo que fallaba era el `aula.yaml`, esa
  clase se corrige entera otra vez.
- Intervalo mínimo del modo examen, 5 minutos.
- El proyector tapa las máquinas, no los nombres del alumnado.
- El panel de la sesión se borra al empezar un examen nuevo: las vueltas del
  examen anterior no son de esta sesión.

## Siguiente tarea recomendada

**T066** (`READY`, P1): tapar la máquina también en el motivo técnico, que es lo
único que hoy se proyecta sin tapar. Después, **T059** cierra la fase 5 con el
inventario de lo heredado.
