# ADR-0005 · PASS / FAIL / UNEVALUATED más causa técnica

- Ampliada por ADR-0015: la causa `OUTPUT_OVERFLOW` hace nueve.
- Estado: **aceptada** · 2026-09-19
- Contexto: `KEEP-DROP-CHANGE.md` §Taxonomía, `03-ESTADOS-Y-NOTA.md`, F-07

## Contexto

En Teuton, avería y suspenso son el mismo `check: false`. El `conn_status`
existe pero es por alumno, tiene dos etiquetas para cuatro averías distintas y
no está en el `case-NN.json`. Con un corte a mitad de examen (`s06-drop`) el
alumno se queda con un 33 que nadie puede interpretar.

La propuesta preliminar (`PASS FAIL ERROR TIMEOUT NOT_RUN CANCELLED`) mezcla dos
ejes y repite el cajón de sastre.

## Decisión

Dos ejes, **por comprobación**:

1. Académico, tres valores: `PASS`, `FAIL`, `UNEVALUATED`.
2. Causa técnica, ocho valores, con sentido solo si `UNEVALUATED`: `NONE`,
   `CONNECT_FAILED`, `AUTH_FAILED`, `TIMEOUT`, `CONNECTION_LOST`, `NOT_RUN`,
   `CANCELLED`, `ENGINE_ERROR`. Más un `detail` libre de una frase.

«Ejecución completa» se define de forma operativa: canal abierto, comando
enviado, exit status recibido y ambos flujos leídos hasta EOF. Si falta alguna,
es `UNEVALUATED`.

El estado del alumno (`OK`/`PARTIAL`/`NOT_EVALUATED`/`EXCLUDED`) es derivado, no
almacenado.

## Consecuencias

- `UNEVALUATED` nunca entra en la nota, y la respuesta a «¿esto resta?» está en
  el tipo, no en el sitio donde se consume.
- Un exit 127 del servidor del alumno es `FAIL`, no avería: la máquina
  respondió.
- Se revisaron cuatro fusiones posibles y se rechazaron las cuatro: cada causa
  cambia lo que el profesor debe hacer después.
