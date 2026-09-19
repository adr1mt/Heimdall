# ADR-0008 · Compatibilidad con Teuton como adaptador temporal

- Estado: **aceptada** · 2026-09-19
- Contexto: `GUI-CONTRACT.md` §6, `06-LEGACY-WRITER.md`

## Contexto

La GUI tiene 192 tests unitarios y **40 escenarios e2e** de una UAT hostil, todos
en verde. El acoplamiento con el motor son 11 puntos, nueve de ellos ficheros.
Cambiar a la vez el motor y el contrato con la GUI significa perder la red de
seguridad justo en el salto.

## Decisión

Un `LegacyTeutonWriter` en `internal/legacy`, activado con `--compat=teuton2`,
transforma el `RunResult` canónico en `resume.json` + `case-NN.json` +
`moodle.csv`. **Solo en esa dirección.** El artefacto canónico se escribe
siempre, con o sin la bandera.

Queda marcado como capa temporal: no recibe ninguna funcionalidad que la UAT no
exija, y se elimina en un solo commit cuando ningún test de la GUI lea los
ficheros de Teuton.

## Pérdidas conocidas al convertir

`UNEVALUATED` se aplana a `check: false`; la causa por comprobación se reduce a
una etiqueta por alumno y host; no hay `provisional_score`, ni stderr, ni
`truncated`, ni `remote_process`, ni hashes, ni `warnings`.

La más grave: un incompleto sin error de conexión sería indistinguible de un 0.
Por eso el escritor emite `grade: 0` **y** rellena `conn_status` también para
`TIMEOUT`, que es lo único que hace que la GUI actual no publique una nota
incompleta como final.

## Consecuencias

- La UAT de 40 escenarios pasa a ser prueba de aceptación del motor nuevo.
- Cada paso de la migración es reversible y verificable con suites existentes.
- Se acepta a sabiendas un escritor feo y con reglas artificiales, a cambio de
  no quedarse sin red.
