# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T061 hecha**: la cadena consolidada ya se ve y se exporta desde la aplicación.

En Resultados, una corrección que repite otra ofrece leer toda la cadena junta.
El alumno que quedó entero en la segunda vuelta aparece con su nota final, y
cada comprobación dice de qué corrección sale y qué se intentó antes. Las notas
de la cadena se exportan con las mismas reglas que las de una corrección
suelta: quien siga sin nota sale sin nota y con el motivo. Si el motor rechaza
la cadena, en pantalla queda el motivo y ninguna nota. La aplicación no suma
nada: llama al motor y enseña lo que publica (ADR-0019).

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `version`. `run`:
  `--secrets=stdin|env`, `--var`, `--cname`, `--case`, `--concurrency`,
  `--host-concurrency`, `--events=ndjson`, `--retry=<artefacto>` y, congeladas,
  `--compat=teuton2` y `--export=json`. Exit: 0 ok · 2 config · 3 parcial ·
  4 cancelado · 1 sin escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf` y
  `Consolidate` (ADR-0019); el rastro del intento anterior no entra en ninguna
  nota. `plan`: los dos YAML y nueve validaciones. `assert`: cinco aserciones.
  `report`: escritura atómica y redacción. `events`: NDJSON (ADR-0017).
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno y selección de reintento. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el roto, en el 2299.
  `acceptance.sh` recorre A-1 a A-14 y `eventos.sh` E-1 a E-10.
- `gui/`: árbol Node independiente; `make gui-check` (111 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Histórico, Ajustes, Ayuda. Resultados
  lleva lo que quedó sin comprobar, manda el reintento a Inicio, **exporta las
  notas a CSV** y, si repite otra corrección, **enseña y exporta la cadena
  consolidada** llamando a `heimdall consolidate`; la escala del profesor va con
  las preferencias de pantalla. El histórico lee `var/run-*.json` del examen, 50
  como mucho, sin tocar legacy.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` y `make gui-check` (111 tests) verdes · `npm run typecheck` y
`npm run build` sin errores · la aplicación real, abierta sobre una cadena de
dos artefactos: la nota final en pantalla, cada comprobación con su corrección
y sus intentos, y una cadena de otro examen rechazada con su motivo y sin
ninguna nota. `make gui-lab`, `acceptance.sh`, `eventos.sh` y `make test` no se
repitieron esta sesión.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido; sin examen elegido
  no hay lista, y para eso está «Abrir otro resultado…».
- La cadena solo se ofrece desde una corrección que repite otra, y se prueba
  con artefactos: el laboratorio no puede encender una máquina apagada.
- Un reintento exige el mismo PLAN: si lo que estaba mal era el `aula.yaml`,
  esa clase se corrige entera otra vez.

## Siguiente tarea recomendada

**T058** (`READY`, P1): modo examen y modo proyector. Detrás, T059 cierra la
fase 5 con el inventario de lo heredado.
