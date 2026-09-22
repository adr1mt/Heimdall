# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-22 · **Fase**: 6 — Realineación de producto

## Última sesión

**T123 · El modo examen a la vista.** Paquete P6, GUI.

- Con el modo examen encendido, la pantalla «Corregir» dice con palabras, sin
  desplegar nada, que cada alumno se queda con su **mejor vuelta entera**, que
  debajo se indica **de qué vuelta sale** su nota y **cada cuántos minutos** se
  vuelve a corregir.
- Mientras no haya ninguna vuelta terminada se ven **los alumnos de la clase**
  listados, sin nota y diciendo por qué todavía no la tienen.
- La franja de cinco datos (vuelta, siguiente, activos, finalizados, progreso)
  se queda como estaba. Ningún número nuevo se calcula aquí.
- `npm run typecheck` y `npm test` (352 tests) verdes. No se lanzó la app.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen, 5 min.
- El proyector no tapa los nombres del alumnado: el profesor eligió la clase.
- La copia guarda las notas, no las pruebas: una corrección recuperada no
  enseña la salida de las máquinas, y lo dice en la propia pantalla.
- El paquete es Linux x64; Windows y macOS quedan fuera (2026-09-21).
- La actualización automática solo toca el AppImage; el `.deb` lo lleva apt.
  No hay ninguna release publicada contra la que probarla de verdad.
- El editor reescribe el YAML con su formato: mismo examen, otra disposición,
  y los comentarios del fichero no sobreviven a un guardado.

## Siguiente tarea recomendada

**T070** o **T080** (P1, sin paquete). T023 queda como P2.
