# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**T113: las notas tienen copia de seguridad.** Un commit.

- Al terminar cada corrección, Heimdall guarda las notas **fuera de la carpeta
  del examen**, en su propia carpeta de datos. Si el profesor borra la carpeta
  del examen, las notas siguen ahí.
- La copia lleva la nota de cada alumno y el resultado de cada comprobación.
  No lleva la salida de las máquinas ni ninguna contraseña.
- En Histórico hay un apartado nuevo: se ven las copias, cuáles siguen en la
  carpeta y cuáles solo quedan en copia, y un botón las devuelve.
- Restaurar **solo puede añadir**: una corrección que ya está en la carpeta se
  queda intacta, con su detalle entero. Nunca baja una nota ya guardada.
- Se guardan las 50 correcciones más recientes de cada examen.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `session`, `version`, con
  `--secrets`, `--events=ndjson`, `--retry`, `--session`. Exit: 0 · 2 config ·
  3 parcial · 4 cancelado · 1 sin escribir.
- Motor completo y probado: `model` puro, `plan` con sus nueve validaciones,
  `assert`, `report` atómico, `events`, `engine` y `ssh` (ADR-0011).
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`, el roto en el 2299. `acceptance.sh`,
  `eventos.sh`, `sesion.sh`.
- `gui/`: árbol Node independiente; `make gui-check` (306 tests), `gui-build`,
  `gui-lab`, **`gui-editor`**. **Las nueve secciones están construidas**:
  Inicio, Clases, Exámenes, Corregir, Resultados, Analíticas, Histórico,
  Ajustes y Ayuda. Modo proyector en la barra lateral. En el directorio de
  datos de usuario: `classes.json` (ADR-0021) y `projects.json`; de cada clase
  sale su aula dentro de la carpeta del examen (ADR-0022).

## Pruebas ejecutadas

`make check` y `make gui-check` (306) verdes, `typecheck` verde. Contra el
laboratorio, con la aplicación construida: `make gui-lab` (S-0…S-4, H-1, X-1,
X-2, **B-1…B-3**), `make gui-editor` (D-1…D-7) y el modo examen entero
(E-1…E-5, P-0…P-3, C-1…C-3, S-5). Un examen escrito desde el formulario
corrige el laboratorio: alumne01, 100/100. Del paquete real, `make gui-paquete`
(P-1…P-3) verde. `make test` no se repitió.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: legacy escrito pero marcado `PEND`; se cierra o se retira en T060.
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen, 5 min.
- El proyector tapa las máquinas, no los nombres del alumnado.
- La copia guarda las notas, no las pruebas: una corrección recuperada de una
  copia no enseña la salida de las máquinas, y lo dice en la propia pantalla.
- El paquete se construye para Linux x64. Windows y macOS quedan fuera
  (decisión del 2026-09-21).
- El editor reescribe el YAML con su propio formato: mismo examen, otra
  disposición. Los comentarios del fichero no sobreviven a un guardado.

## Siguiente tarea recomendada

**T114**, actualización automática, desbloqueada por T072.

Sin fecha: T059, T060, T070, T080, T111, T112, T023.
