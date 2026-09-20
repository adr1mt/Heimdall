# ADR-0015 · Una novena causa técnica: `OUTPUT_OVERFLOW`

- Estado: **aceptada** · 2026-09-20
- Amplía [ADR-0005](0005-taxonomia-estados.md) · Contexto: [ADR-0013](0013-alumnos-en-paralelo.md), T032

## Contexto

El motor deja de leer un flujo cuando pasa de 8 MB y corta la sesión: es lo que
impide que un `cat` accidental de un fichero enorme se lleve la memoria por
delante. Hasta ahora, esa comprobación salía `UNEVALUATED` con
`CONNECTION_LOST`, porque el corte lo provocábamos nosotros cerrando la sesión.

El motivo mentía. `CONNECTION_LOST` manda al profesor a mirar la red o la
máquina del alumno, y lo que hay que arreglar es el comando del examen. Se
detectó midiendo el escalado por tamaño de salida (ADR-0013).

## Decisión

Se añade una novena causa técnica, `OUTPUT_OVERFLOW`: el comando produjo más
salida de la que el motor está dispuesto a leer y se dejó de leer antes de que
terminara.

- El eje académico no cambia: sigue siendo `UNEVALUATED`. Los 64 kB
  conservados son el principio de la salida y no dicen nada de lo que venía
  después, así que no se evalúa la aserción sobre ellos. Un `no_contiene` que
  pasara sobre un prefijo sería un aprobado inventado.
- Lo conservado sí llega al informe, con `bytes_total` y `truncated`, para que
  el profesor vea qué estaba respondiendo la máquina.
- `ExecutionResult` lleva un `overflow` que distingue este corte de una caída
  de red. No lo mira nadie que calcule la nota.
- Los topes (64 kB conservados, corte duro a 8 MB) no se tocan.

## Consecuencias

- Ningún alumno suspende por una salida enorme: sigue sin evaluarse y sigue sin
  entrar en el denominador.
- El escritor legacy traduce la causa nueva a `error`, como las demás.
- El conjunto cerrado de causas de ADR-0005 pasa de ocho a nueve. Las tablas
  exhaustivas de `internal/model` crecen con ella.
