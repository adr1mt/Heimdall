# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-22 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T081 · Los 16 modos de fallo, revisados.** Antes T080, dividida.

- T080 era demasiado grande y una de sus condiciones exige aula real: se
  parte en T081 (esta), T082 (secretos), T083 (documentación y versión) y
  T084 (examen real). T080 queda retirada.
- `docs/MODOS-DE-FALLO-HEIMDALL.md`: una entrada por fallo, con su evidencia.
  15 de 16 resueltos o sin sentido aquí. **Solo queda F-12**: corregir con
  clave SSH en vez de contraseña, que ya era la tarea T023.
- Comprobado en vivo: un examen con una palabra mal escrita se para antes de
  tocar ninguna máquina y dice fichero y línea; sin fichero de aula no se
  inventa ningún alumno.
- `make check` (163 tests) y la suite de la GUI (352) verdes. Los tests que
  piden el laboratorio podman no se ejecutaron.

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

**T082** (auditoría de secretos, tarea sola) o **T070** (exámenes del curso en
formato nativo). T023 sigue siendo P2, pero es el único modo de fallo abierto.
