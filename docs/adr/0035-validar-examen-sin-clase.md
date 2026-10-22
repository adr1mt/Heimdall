# ADR-0035 · Validación del examen independiente de la clase

- Estado: **aceptada** · 2026-10-22 · T203
- Amplía el contrato CLI de ADR-0017; conserva la fase PLAN de ADR-0002.

## Contexto

Guardar o validar un examen exigía una clase seleccionada. Incluso cambiar
su nombre quedaba bloqueado sin alumnado. La autoría del examen debe ser
independiente del grupo con el que se corregirá.

## Decisión

`check --exam-only` valida el examen sin leer aula ni generar datos ficticios.
Comparte las reglas del examen y la gramática de referencias con la resolución
del PLAN. Los campos `${alumno.campo}` no se resuelven durante la autoría.
La existencia de esos datos, direcciones, credenciales y los límites que
dependen del número de alumnos se comprueban en el PLAN completo.

La GUI valida con esta operación antes de guardar y al pulsar Validar, sin
consultar clases. Los errores del examen siguen bloqueando su guardado y
conservando el borrador visible. El guardado conserva los bytes y las versiones
recuperables de ADR-0034. La interfaz explica que los datos de clase se
comprobarán antes de corregir.

`check` ordinario y `run` siguen requiriendo el PLAN completo. La validación
de autoría no afirma que una clase concreta pueda corregirse ni publica un
hash de PLAN. No cambia el contrato de eventos, el artefacto ni las notas.
