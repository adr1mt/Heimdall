# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T058 hecha**: modo examen y modo proyector.

El modo examen corrige la clase una y otra vez mientras dura la práctica, sin
tocar nada: se elige cada cuántos minutos, sale la primera vuelta sola y la
siguiente empieza cuando termina la anterior, nunca antes, así que no hay dos
correcciones a la vez. La contraseña se escribe una sola vez y no vuelve a
pedirse. Mientras el examen está en marcha el ordenador no se suspende ni se
apaga la pantalla, y cerrar la ventana pregunta antes: si se cierra, lo
corregido se conserva y lo que falte queda sin evaluar, nunca suspenso.

El modo proyector agranda la pantalla un 25 % y tapa las direcciones de las
máquinas allí donde salían —avisos, órdenes y salida del alumno—, de modo que
proyectar la corrección no reparte el acceso a la máquina de un compañero. Los
nombres se quedan: los eligió el profesor.

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
- `gui/`: árbol Node independiente; `make gui-check` (125 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Histórico, Ajustes, Ayuda. Inicio lleva
  el **modo examen** (cadena de vueltas, una cada vez) y la barra lateral el
  **modo proyector**. Resultados lleva lo que quedó sin comprobar, manda el reintento a Inicio, **exporta las
  notas a CSV** y, si repite otra corrección, **enseña y exporta la cadena
  consolidada** llamando a `heimdall consolidate`; la escala del profesor va con
  las preferencias de pantalla. El histórico lee `var/run-*.json` del examen, 50
  como mucho, sin tocar legacy.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make gui-check` (125 tests) y `make gui-lab` verdes · `npm run typecheck` y
`npm run build` sin errores · `gui/scripts/examen-lab.ts` contra el laboratorio,
con la aplicación construida: catorce criterios en verde, incluida la cadena
real de dos vueltas con `CHAIN=1` (nunca más de un motor vivo en toda la
cadena), el proyector sin ninguna dirección en pantalla y las dos respuestas
del aviso al cerrar. `make check`, `acceptance.sh`, `eventos.sh` y `make test`
no se repitieron esta sesión.

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
- El modo examen corrige la clase entera en cada vuelta; no reintenta solo lo
  que falló. El intervalo más corto que se ofrece es de 5 minutos.
- El proyector tapa las máquinas, no los nombres del alumnado.

## Siguiente tarea recomendada

**T062** (`READY`, P1): la regla de la sesión de examen —mejor nota completa y
`FINALIZADO`—, con su ADR. Detrás van T063 (motor) y T064 (pantalla). A la par,
**T059** sigue `READY` y cierra la fase 5 con el inventario de lo heredado.

El modo examen de T058 encadena vueltas, pero cada vuelta sigue siendo una
corrección suelta: nadie conserva todavía la mejor nota de la sesión ni deja
fuera a quien ya terminó. Eso es D-10 y se resuelve en el motor, no en la
aplicación.
