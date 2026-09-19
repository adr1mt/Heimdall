# ADR-0003 · Examen declarativo en YAML, sin lenguaje ejecutable

- Estado: **aceptada** · 2026-09-19
- Contexto: `KEEP-DROP-CHANGE.md` D-1, `01-TRADUCCION-EXAMENES.md`

## Contexto

El `start.rb` es Ruby sin sandbox: `instance_eval`, `method_missing` catch-all y
`respond_to_missing? -> true`. De ahí salen F-02, el denominador variable, la
imposibilidad de contar comprobaciones y la inyección desde el `config.yaml`.

El riesgo obvio era que un YAML declarativo no diera para los exámenes reales.
Se ha comprobado traduciendo dos exámenes reales del curso: un cuestionario de
10 preguntas y el Examen RA2 (KEA + BIND, 16 comprobaciones por SSH). **Ninguno
usa bucles ni condicionales.** Hacen falta dos primitivas nuevas (`cerca_de`,
que sustituye a `grep -A N`, y `valor:`, que evalúa un campo del inventario sin
ejecutar nada) y ninguna capacidad de scripting.

## Decisión

El examen es un `examen.yaml` declarativo con las 14 capacidades de
`02-FORMATO.md` §1. Sin `if`, sin bucles, sin expresiones, sin macros, sin
inclusión de ficheros y **sin comandos como cadena de shell**: los comandos son
vectores de argumentos.

## Consecuencias

- Una clave desconocida es error de validación, no una macro inexistente.
- Desaparece la inyección de comandos y la dependencia del shell y del `locale`.
- Las tuberías a `grep` del material real se traducen a aserciones del motor,
  que además explican mejor por qué falló una comprobación.
- Si algún día aparece una necesidad real de expresividad, se resuelve con una
  primitiva nueva y acotada, no reabriendo el lenguaje.
