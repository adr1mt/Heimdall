# ADR-0017 · El contrato nativo con la GUI: eventos NDJSON y esquema del artefacto

- Estado: **aceptada** · 2026-09-20
- Cierra: **D-9**
- Contexto: ADR-0016, ADR-0007, `09-CONTRATO-GUI.md`

## Contexto

D-9 llevaba aplazado desde el principio: primero el escritor legacy, el formato
de eventos después. ADR-0016 lo puso del revés. Si Heimdall GUI se escribe
sobre un contrato nativo, el contrato es lo primero, porque todo lo demás
cuelga de él.

La GUI vieja calculaba el progreso contando caracteres que el motor imprimía, y
deducía si una comprobación estaba sin evaluar. Las dos cosas son inferencias
sobre un texto pensado para leerlo una persona.

## Decisión

Dos piezas y ninguna más.

1. **Eventos NDJSON por `stdout`**, una línea por objeto, con `--events=ndjson`.
   Cinco eventos: `run.start`, `student.start`, `check.end`, `student.end`,
   `run.end`. Cada línea lleva `event`, `seq` monótono y `ts`.
2. **El esquema del artefacto**, publicado en
   `docs/design/schema/run-result.schema.json`, para que la GUI lo lea sin
   adivinar.

Las reglas que las sostienen:

- **El artefacto es la fuente de verdad; los eventos son el progreso.** Nada
  viaja por el flujo que el artefacto no tenga. Perder un evento cuesta
  progreso, nunca una nota.
- **La salida del alumnado no entra en el flujo.** Es dato no confiable y sin
  tamaño máximo. `check.end` lleva estado, causa, detalle y duración; el texto
  está en el artefacto, acotado.
- **`run.start` fija el denominador antes de tocar ninguna máquina**, y publica
  aparte `expected_checks`, que es el total de la barra de progreso y no el
  denominador. Confundirlos es lo que hacía que un alumno roto moviera la nota
  de los demás.
- **Los dos ejes viajan separados**: `status` académico y `cause` técnica. La
  GUI deja de inferir.
- **`contract_version` solo sube si un campo cambia de significado o
  desaparece.** Añadir no la mueve, y un consumidor ignora lo que no conoce.
- **`--events` y `--export` son incompatibles**: los dos escriben en `stdout`.

El paquete `internal/events` es nuevo y de primer nivel: el contrato es una
pieza publicada, con su versión y sus reglas, y meterlo en `internal/report`
—que escribe el artefacto, atómicamente, en disco— habría mezclado dos
responsabilidades con ciclos de vida distintos.

## Alternativas descartadas

- **Un evento por byte de progreso, como la GUI vieja.** Es lo que se está
  quitando.
- **Un socket o un puerto.** Una tubería que ya existe basta, y no abre nada a
  la red en el ordenador del profesor.
- **Emitir el artefacto entero como evento final.** Duplica la fuente de verdad
  y obliga a sostener en memoria lo que ya está en disco.
- **Publicar la salida de los comandos en el flujo.** Es exactamente el dato
  que hay que acotar; la GUI lo lee del artefacto cuando el profesor abre una
  comprobación.

## Consecuencias

- La barra de progreso de la GUI pasa a ser exacta: cuenta comprobaciones
  anunciadas, no caracteres.
- `INCOMPLETE` deja de ser una inferencia: llega dicho, con su causa.
- `test/eventos.sh` es el consumidor de prueba y la aceptación del contrato
  (E-1 a E-10, sobre el laboratorio).
- El esquema no puede desincronizarse del modelo: los tests lo recorren campo a
  campo.
- El motor emite el contrato nativo **y** conserva la fachada congelada, que no
  recibe nada de esto y se borra en T060.
