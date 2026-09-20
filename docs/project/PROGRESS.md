# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T062 hecha**: la regla de la sesión de examen (ADR-0020, cierra D-10).

Durante una práctica el alumnado instala, rompe y arregla. Hasta ahora cada
vuelta borraba a la anterior: quien lo tenía todo bien a las 10:20 y rompió
algo a las 10:40 se quedaba con lo de las 10:40. Ahora la nota de la práctica
es **la mejor vuelta que salió entera**: con 6, 8, 7 y 9, la nota es 9, y
siempre se dice de qué vuelta sale.

Solo compiten las vueltas completas: si la máquina se apaga en una vuelta
posterior, esa vuelta no cuenta y el 9 sigue en pie. Quien aún no tenga
ninguna vuelta entera no tiene nota y se dice por qué; nunca un cero. Quien
llega al total queda marcado como terminado sin que nadie lo apunte, y de cada
alumno se guarda lo que dijo cada vuelta.

Es solo la regla: el motor aún no la publica (T063) ni se ve en pantalla
(T064).

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `version`. `run`:
  `--secrets=stdin|env`, `--var`, `--cname`, `--case`, `--concurrency`,
  `--host-concurrency`, `--events=ndjson`, `--retry=<artefacto>` y, congeladas,
  `--compat=teuton2` y `--export=json`. Exit: 0 ok · 2 config · 3 parcial ·
  4 cancelado · 1 sin escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf`,
  `Consolidate` (ADR-0019) y `BuildSession` (ADR-0020: mejor vuelta completa y
  `FINISHED` derivado). El rastro de los intentos anteriores no entra en
  ninguna nota. `plan`: los dos YAML y nueve validaciones. `assert`: cinco
  aserciones. `report`: escritura atómica y redacción. `events`: NDJSON.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno y selección de reintento. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`, el roto en el 2299;
  `acceptance.sh` recorre A-1 a A-14 y `eventos.sh` E-1 a E-10.
- `gui/`: árbol Node independiente; `make gui-check` (125 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Histórico, Ajustes, Ayuda. Inicio
  lleva el **modo examen** (vueltas encadenadas, una cada vez) y la barra
  lateral el **modo proyector**. Resultados enseña lo no comprobado, manda el
  reintento a Inicio, **exporta a CSV** y **enseña la cadena consolidada**
  llamando a `heimdall consolidate`. El histórico lee `var/run-*.json` del
  examen. `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` verde, con los quince casos nuevos de la sesión de examen.
`make gui-check`, `make gui-lab`, `acceptance.sh`, `eventos.sh` y `make test`
no se repitieron esta sesión; quedaron verdes en la anterior.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido; sin examen elegido no
  hay lista, y para eso está «Abrir otro resultado…».
- Un reintento exige el mismo PLAN: si lo que estaba mal era el `aula.yaml`,
  esa clase se corrige entera otra vez.
- El modo examen corrige la clase entera en cada vuelta y sigue enseñando la
  última, no la mejor: eso llega en T064. Intervalo mínimo, 5 minutos.
- El proyector tapa las máquinas, no los nombres del alumnado.

## Siguiente tarea recomendada

**T063** (`READY`, P1): que el motor publique la sesión por la salida estándar
y deje fuera de la vuelta siguiente a quien ya terminó. Detrás va T064, que lo
enseña en pantalla. A la par, **T059** sigue `READY` y cierra la fase 5 con el
inventario de lo heredado.
