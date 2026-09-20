# Tests que no han pasado a Heimdall GUI

La suite de `teuton-gui` tenía 24 ficheros de vitest y 15 de Playwright. Aquí
queda escrito qué se ha quedado fuera al sembrar `gui/` y por qué (T051).

Ninguno se ha retirado por fallar. Todos probaban código que ya no existe: el
que hablaba con Teutón, el que adivinaba el progreso contando caracteres o el
que manejaba pantallas que aún no se han vuelto a escribir.

## Retirados porque probaban el contrato de Teutón

| Test | Qué probaba |
|---|---|
| `fake-teuton.test.ts` | El doble del binario `teuton` usado en las pruebas. |
| `results.test.ts` | Lectura de `resume.json` y `case-NN.json`. |
| `run.test.ts` | Lanzamiento del proceso `teuton` y su salida. |
| `ipc-runs.test.ts` | Los canales IPC de aquella ejecución. |
| `progress.test.ts` | La barra de progreso contando caracteres de la salida. |
| `partial.test.ts` | Ejecuciones con `--case`, opción de la CLI vieja. |
| `config.test.ts` | Edición de `config.yaml`. |
| `validation.test.ts` | Validación de `config.yaml` y `start.rb`. |
| `preflight.test.ts` | Comprobaciones previas atadas a aquel proyecto. |
| `output-dir.test.ts` | El directorio de salida que fijaba Teutón. |
| `unreachable.test.ts` | Máquinas inalcanzables leídas de la salida de Teutón. |

Todo esto lo cubre ahora el motor, y la GUI lo recibirá por el contrato nativo:
eventos NDJSON y artefacto canónico (ADR-0017).

## Retirados porque su pantalla todavía no existe

| Test | Vuelve con |
|---|---|
| `analytics.test.ts` | T054, sobre el modelo real. |
| `grading.test.ts`, `moodleCsv.test.ts` | T053, con la nota del artefacto. |
| `integrity.test.ts`, `names.test.ts` | T053, con la matriz de resultados. |
| `stall.test.ts`, `notices.test.ts` | T052, con la ejecución en marcha. |
| `redact.test.ts`, `sanitize.test.ts` | T052, cuando vuelva a haber salida que redactar. |
| `helpers.ts`, `setup.ts`, `fixtures/` | Auxiliares de los anteriores. |

## Playwright

Los quince escenarios de extremo a extremo se han retirado enteros: todos
arrancan la aplicación contra un proyecto de Teutón. Los que describen
comportamiento que Heimdall mantiene —una sola instancia, cierre con una
corrección en marcha, modo examen, datos hostiles, máquina apagada— se
reescriben cuando haya ejecución real, en T052.

## Lo que sí se ha conservado

`store.test.ts` (ajustes del profesor, reescrito para los de Heimdall) y un
`engine.test.ts` nuevo, que comprueba que la aplicación reconoce el motor y
rechaza lo que no lo sea.
