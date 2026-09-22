# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-22 · **Fase**: 6 — Realineación de producto

## Última sesión

**Paquete P4: proyector dedicado (T111) y exportación a Moodle (T112).**

- El proyector quita la barra lateral, agranda la letra y tapa las direcciones.
  Lo que se proyecta es la pantalla en la que estés, con su matriz de OKs. Se
  sale con Esc o con el botón. Un primer intento lo cambió por un tablero de
  fichas; Adrià lo rechazó y se deshizo: la matriz es la protagonista.
- «Exportar a Moodle» en los tres sitios donde ya salían notas: corrección,
  cadena y sesión de examen. Fichero aparte de tres columnas —alumno, correo y
  nota— que Moodle importa tal cual; empareja por correo (Adrià, 22-09-2026).
  Sin nota final, celda vacía y nunca un cero; sin correo no se puede ir, y la
  aplicación lo dice antes de guardar.

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
- `gui/`: árbol Node independiente; `make gui-check` (329 tests), `gui-build`,
  `gui-lab`, **`gui-editor`**. **Las nueve secciones están construidas**:
  Inicio, Clases, Exámenes, Corregir, Resultados, Analíticas, Histórico,
  Ajustes y Ayuda. Proyector: vista completa aparte. En el directorio de
  datos de usuario: `classes.json` (ADR-0021) y `projects.json`; de cada clase
  sale su aula dentro de la carpeta del examen (ADR-0022).

## Pruebas ejecutadas

`make check` y `make gui-check` (329) verdes, `typecheck` verde. Contra el
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

**T080**, hardening, auditoría de secretos y release. Después, T070.

Sin fecha: T059, T070, T080, T023.
