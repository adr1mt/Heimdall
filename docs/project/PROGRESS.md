# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-22 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T081, T082 y T083 · Revisión, auditoría y versión 0.9.0.** Antes T080.

- T080, demasiado grande, partida en T081 (revisión de fallos), T082
  (secretos), T083 (documentación y versión) y T084 (examen real de aula).
- `docs/MODOS-DE-FALLO-HEIMDALL.md`: los 16 fallos del sistema viejo, uno a
  uno. **Solo queda abierto F-12**, corregir con clave SSH, que ya era T023.
- Auditoría de la contraseña con el laboratorio levantado: cero coincidencias
  en `argv` del proceso vivo, terminal, `var/`, eventos, reintento, vuelta de
  sesión, aula generada, exportaciones y copias.
- **Versión 0.9.0**, un solo número en `VERSION`: el motor se sella al
  compilar, la aplicación lo lleva en su paquete y `test/version.sh` vigila
  que no se separen. Paquete 0.9.0 construido y `make gui-paquete` verde.
- `docs/GUIA.md` (guía del profesor) y `docs/NOTAS-DE-VERSION.md`.
- Verde: motor 163 tests, aplicación 357, `test/secrets.sh`, `test/version.sh`
  y `make gui-paquete`.

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

**T070** (exámenes del curso en formato nativo), que es lo que desbloquea
**T084**: el examen real de aula, la prueba que falta para la 1.0.0 y que
ejecuta Adrià.
