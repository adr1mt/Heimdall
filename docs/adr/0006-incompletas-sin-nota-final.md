# ADR-0006 · Una evaluación incompleta no produce nota final

- Estado: **aceptada** · 2026-09-19
- Contexto: `03-ESTADOS-Y-NOTA.md` §5

## Contexto

Con `UNEVALUATED` fuera de la nota aparece un riesgo nuevo: calcular la nota
sobre lo poco que se pudo evaluar. Un alumno con una comprobación superada de
peso 2 y dos sin evaluar de peso 4 daría «2/2 = 100».

## Decisión

Por alumno se publican seis valores: `obtained`, `evaluable`, `total`,
`unevaluated`, `provisional_score` y `final_score`, más un `status`.

`final_score` es **`null`** mientras exista una comprobación `UNEVALUATED` de
peso mayor que 0. `provisional_score` se calcula siempre que haya algo evaluado
y va siempre acompañado de `unevaluated` y `status`. El campo **no se llama
`score`** a propósito.

Un alumno que no se pudo evaluar no saca 0: saca `NOT_EVALUATED`.

La resolución de un incompleto es del profesor, fuera del motor, y si algún día
se registra será un artefacto aparte con autor y fecha, nunca una reescritura
del `run-<id>.json`.

## Alternativas descartadas

- **Umbral de tolerancia** («si lo no evaluado pesa menos del 5 %, publicar»):
  arbitrario, y la comprobación caída puede ser la que más pesa pedagógicamente.
- **«Si no responde a nada es un 0, no entregó»**: el cable, el switch o el DHCP
  del aula producen el mismo síntoma.

Se admite la posibilidad futura de una bandera explícita
`--asumir-fallo-tecnico-como-cero`, registrada en el artefacto y nunca por
defecto. No está en el MVP.
