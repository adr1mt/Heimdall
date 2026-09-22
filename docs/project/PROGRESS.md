# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-22 · **Fase**: 6 — Realineación de producto

## Última sesión

**T119: las notas se leen como las escribe un profesor.**

- Comparación de Heimdall con teuton-gui delante de Adrià, con el mismo
  cuestionario demo y la misma clase DEMO-15 en las dos aplicaciones.
- La aplicación escribía los 100 puntos del motor como si fueran la nota.
  Ahora convierte: la marca de aprobado es el 5 y el 100 es el 10, con una
  recta a trozos que pasa por (0,0), (marca, mitad) y (100, máximo). La marca
  por defecto pasa de 50 a 70 (Adrià, 22-09-2026), que es lo que él aprueba.
- La conversión vive en `lib/scale.ts` y la usan igual la pantalla y los
  ficheros que se exportan: antes solo convertía la exportación, así que la
  pantalla y la hoja de Moodle podían decir cosas distintas del mismo alumno.
- El motor no se ha tocado: sigue publicando 0-100 y el artefacto no guarda
  ninguna nota convertida.
- Del mismo repaso salen T120-T125, todas de GUI: abrir la carpeta desde
  Inicio, Clases sin modo edición, aclarar «Exámenes», la contraseña en
  cristiano y el modo examen a la vista, el resumen de Resultados y dejar
  Analíticas en tres cosas.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `session`, `version`, con
  `--secrets`, `--events=ndjson`, `--retry`, `--session`, `--cname`. Exit: 0 · 2 config ·
  3 parcial · 4 cancelado · 1 sin escribir.
- Motor completo y probado: `model` puro, `plan` con sus nueve validaciones,
  `assert`, `report` atómico, `events`, `engine` y `ssh` (ADR-0011).
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`, el roto en el 2299. `acceptance.sh`,
  `eventos.sh`, `sesion.sh`.
- `gui/`: árbol Node independiente; `make gui-check` (331 tests), `gui-build`,
  `gui-lab`, **`gui-editor`**. **Las nueve secciones están construidas**:
  Inicio, Clases, Exámenes, Corregir, Resultados, Analíticas, Histórico,
  Ajustes y Ayuda. Proyector: vista completa aparte. En el directorio de
  datos de usuario: `classes.json` (ADR-0021) y `projects.json`; de cada clase
  sale su aula dentro de la carpeta del examen (ADR-0022).

## Pruebas ejecutadas

`make check` y `make gui-check` (331) verdes, `typecheck` verde. Contra el
laboratorio, con la aplicación construida: `make gui-lab` (S-0…S-4, H-1, X-1,
X-2, **B-1…B-3**), `make gui-editor` (D-1…D-7) y el modo examen entero
(E-1…E-5, P-0…P-5, C-1…C-3, S-5). Un examen escrito desde el formulario
corrige el laboratorio: alumne01, 100/100. `make gui-paquete` (P-1…P-3) verde.
`make test` no se repitió; la actualización se prueba sin red.

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

**Paquete P6** (T120, T121, T122, T124, T125): lo que salió de comparar las
dos aplicaciones. **T123** toca secretos y va sola, sin encadenar.

Sin fecha: T059, T070, T080, T023.
