# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-22 · **Fase**: 6 — Realineación de producto

## Última sesión

**Paquete P4: proyector dedicado (T111) y exportación a Moodle (T112).**

- El proyector es una vista aparte que ocupa toda la ventana: sin barra lateral
  ni menús, y en la pared solo nombre, nota, avance, estado y FINALIZADO. No hay
  nada que tapar porque no entra nada que tapar. Se sale con Esc o con el botón.
- «Exportar a Moodle» en los tres sitios donde ya salían notas: corrección,
  cadena y sesión de examen. Fichero aparte de tres columnas —alumno, correo y
  nota— que Moodle importa tal cual; empareja por correo (Adrià, 22-09-2026).
  Sin nota final, celda vacía y nunca un cero; sin correo no se puede ir, y la
  aplicación lo dice antes de guardar.
- Queda T119: el tapado de direcciones ya no tiene camino desde la interfaz.

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
- `gui/`: árbol Node independiente; `make gui-check` (324 tests), `gui-build`,
  `gui-lab`, **`gui-editor`**. **Las nueve secciones están construidas**:
  Inicio, Clases, Exámenes, Corregir, Resultados, Analíticas, Histórico,
  Ajustes y Ayuda. Proyector: vista completa aparte. En el directorio de
  datos de usuario: `classes.json` (ADR-0021) y `projects.json`; de cada clase
  sale su aula dentro de la carpeta del examen (ADR-0022).

## Pruebas ejecutadas

`make check` y `make gui-check` (324) verdes, `typecheck` verde. Contra el
laboratorio, con la aplicación construida: `make gui-lab` (S-0…S-4, H-1, X-1,
X-2, **B-1…B-3**), `make gui-editor` (D-1…D-7) y el modo examen entero
(E-1…E-5, P-0…P-5, C-1…C-3, S-5). Un examen escrito desde el formulario
corrige el laboratorio: alumne01, 100/100. Del paquete real, `make gui-paquete`
(P-1…P-3) verde. `make test` no se repitió.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen, 5 min.
- El proyector no tapa los nombres del alumnado: el profesor eligió la clase.
- La copia guarda las notas, no las pruebas: una corrección recuperada de una
  copia no enseña la salida de las máquinas, y lo dice en la propia pantalla.
- El paquete se construye para Linux x64. Windows y macOS quedan fuera
  (decisión del 2026-09-21).
- El editor reescribe el YAML con su propio formato: mismo examen, otra
  disposición. Los comentarios del fichero no sobreviven a un guardado.

## Siguiente tarea recomendada

**T114**, actualización automática (paquete P5). Después, T080.

Sin fecha: T059, T070, T080, T119, T023.
