# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-22 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T081 y T082 · Los fallos revisados y la contraseña auditada.**

- T080 era demasiado grande: partida en T081 (revisión), T082 (secretos),
  T083 (documentación y versión) y T084 (examen real de aula).
- `docs/MODOS-DE-FALLO-HEIMDALL.md`: los 16 fallos del sistema viejo, uno a
  uno, con su evidencia. **Solo queda abierto F-12**, corregir con clave SSH
  en vez de contraseña, que ya era T023.
- Auditoría de la contraseña con el laboratorio levantado y un valor
  envenenado: **cero coincidencias** en `argv` del proceso vivo, terminal,
  `var/`, eventos, reintento, vuelta de sesión, aula generada, exportaciones
  y copias de seguridad.
- `test/secrets.sh` ahora cubre también eventos, reintento y sesión; la
  aplicación estrena `gui/tests/secretos.test.ts` (5 pruebas).
- Verde: motor 163 tests, `test/secrets.sh` entero, aplicación 357 tests.

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

**T083** (guía de instalación y primer examen, y número de versión) o **T070**
(exámenes del curso en formato nativo). T084, el examen real, la ejecuta Adrià.
