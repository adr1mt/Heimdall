# ADR-0007 · Un único modelo canónico en JSON

- Estado: **aceptada** · 2026-09-19
- Contexto: `04-MODELO-RESULTADO.md`

## Contexto

Teuton escribe cinco formatos paralelos, con información distinta en cada
familia (`resume.*` lleva el estado técnico, `case-NN.*` el detalle), y ninguno
es la fuente de verdad. La GUI tiene que cruzar dos ficheros para construir una
fila de alumno.

## Decisión

El motor produce **un artefacto**: `var/run-<ulid>.json`, con `schema_version`,
escritura atómica y cuatro capas estrictamente separadas —`ExecutionResult`,
`AssertionResult`, `CheckResult`, `Score`—, donde cada capa solo lee la
anterior. NDJSON, GUI, Moodle, HTML y el escritor legacy **derivan** de él.

Además se mantiene `var/run-<id>.partial.json`, reescrito atómicamente cada vez
que un alumno termina, para que una muerte del proceso deje material útil.

Nombres de campo en inglés; claves del YAML en español.

## Consecuencias

- Un error técnico no tiene camino hacia la nota: `Score` solo mira
  `CheckResult.Status` y `Weight`.
- El artefacto es auditable meses después: `run_id`, `engine_version`, hashes de
  examen e inventario, comando saneado, stdout y stderr, causa y `detail`.
- Nada de campos polimórficos como el `result` de Teuton.
- Un dato que solo exista en un formato derivado **no existe**: si hace falta,
  se añade al canónico.
