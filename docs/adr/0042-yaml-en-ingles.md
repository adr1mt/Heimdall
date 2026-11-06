# ADR-0042 · YAML exclusivamente en inglés

- Estado: **aceptada** · 2026-11-05
- Sustituye el idioma de las claves de `02-FORMATO.md` y la sintaxis de
  referencias de ADR-0004; mantiene sus garantías de denominador fijo.

## Contexto

Adrià pide expresamente pasar a inglés y descartar la compatibilidad con los
exámenes existentes. No se implementan alias, detección de dialectos ni
conversores. La interfaz y las explicaciones continúan en español.

## Decisión

El examen usa `exam`, `version`, `hosts`, `defaults`, `groups`, `group`,
`checks`, `id`, `description`, `on`, `cmd`, `checker`, `value`, `weight`,
`timeout`, `sudo`, `contains`, `not_contains`, `equals`, `exit_code` y `near`.
El bloque `near` usa `anchor`, `lines` y `contains`.

El inventario usa `classroom`, `version`, `common`, `hosts`, `timeouts`,
`connect`, `student`, `students`, `id`, `name`, `moodle_id`, `excluded`,
`ip`, `port`, `user` y `password_ref`. `password` sigue siendo un campo
reconocido exclusivamente para rechazar credenciales literales.

Las referencias son `${student.campo}` y `${host.ip|port|user}`. Los campos
libres y textos no se traducen obligatoriamente; se puede escribir
`${student.respuesta}`. Los campos antiguos de identidad `nombre` y
`excluido` se rechazan en filas de alumnos, para que no se interpreten como
datos libres y cambien silenciosamente la identidad o la exclusión.

`version` conserva su significado de revisión del documento, no es un
selector de sintaxis. Los nombres de archivo `examen.yaml`, `aula.yaml` y
el prefijo de inventarios generados no cambian: no son claves del lenguaje.
Las referencias de secretos son nombres libres en mayúsculas; por ejemplo
`${AULA_PASSWORD}` sigue siendo válido, no es una palabra reservada española.

## Consecuencias

- Se actualizan lectores/escritores, ejemplos, ayuda y fixtures mantenidos.
- Se rechazan claves antiguas o mezcladas antes de ejecutar una corrección.
- Cambian las huellas de las fuentes y las etiquetas de aserción que entran
  en el hash del PLAN; las pruebas de huella se fijan sobre el formato inglés.
  No se fuerza continuidad con sesiones de criterios anteriores.
- No se modifican los resultados JSON guardados ni el cálculo de nota.
  Los informes antiguos que necesiten releer fuentes españolas pueden dejar
  de regenerarse; no se promete compatibilidad de esas fuentes.
- El programa remoto RA1 y sus revisiones permanecen byte a byte iguales;
  solo cambia la clave YAML que lo selecciona y su marcador en el PLAN.
- No se convierten ni sobrescriben archivos personales o instalaciones.
