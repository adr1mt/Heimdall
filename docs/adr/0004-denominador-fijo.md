# ADR-0004 · Denominador fijo y parametrización sin decisión

- Estado: **aceptada** · 2026-09-19
- Contexto: `02-FORMATO.md` §2, `c14-check`

## Contexto

Los exámenes reales necesitan datos del alumno (IP, usuario, subdominio, las
respuestas de un cuestionario). Pero el condicional dependiente del alumno es
justo lo que produce el defecto de `c14-check`: dos alumnos examinados de cosas
distintas, los dos con un 100 y sin rastro en el informe.

## Decisión

Se separa **sustitución** de **decisión**.

Puede variar por alumno: argumentos, host, usuario y valores esperados. No puede
variar: qué comprobaciones existen, su id, su peso, el orden y el denominador
total.

Sintaxis única: `${alumno.<campo>}` y `${<host>.<ip|puerto|usuario>}` dentro de
un elemento del vector de argumentos o de un valor esperado. Una referencia
inexistente, o un campo que falta en un solo alumno, es error de PLAN.

Si dos grupos deben examinarse de cosas distintas: **dos ficheros de examen**,
con el hash del examen aplicado en el informe.

## Consecuencias

- El PLAN produce la misma lista y el mismo peso total para todos.
- Nunca hay que preguntarse si dos alumnos compartieron examen: se compara el
  hash.
- Un profesor que quiera un itinerario condicional tendrá que escribir dos
  exámenes. Es más trabajo y es intencionado.
