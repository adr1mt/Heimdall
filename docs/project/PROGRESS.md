# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**Paridad con Teutón GUI terminada.** Cinco tareas, cinco commits.

- **T108**: Inicio es la lista de exámenes. Un examen es una carpeta con su
  `examen.yaml` dentro; se abre la carpeta y la aplicación lo encuentra. No se
  elige ningún fichero y no hay ninguna ruta en pantalla. Los recientes viven
  en `projects.json` y sobreviven al cierre. Sin examen abierto, las secciones
  que son de un examen se ven apagadas y no se abren.
- **T116**: pegar una clase desde una hoja de cálculo, con vista previa. Una
  fila incompleta se enseña en rojo y no entra. Una contraseña pegada no se lee
  nunca y se dice qué columna se ha dejado fuera.
- **T117**: identificador y nombre fijos al desplazar la tabla de Clases.
- **T109**: editor del examen. Un solo modelo: formulario y vista YAML son el
  mismo examen, en los dos sentidos. Quien dice si vale es el motor
  (`heimdall check` en carpeta aparte, sin tocar máquinas) y su mensaje
  —fichero y línea— es lo que sale en pantalla; no se escribe hasta que lo
  acepta. Todo valor esperado va entrecomillado: `igual_a: yes` sin comillas es
  un booleano.
- **T110**: Analíticas, sobre el mismo artefacto que Resultados. Quien no tiene
  nota no entra en la distribución como un cero, y una máquina caída va antes
  que cualquier nota baja.
- **T118**: era del guion, no del producto: buscaba la celda en «Lista», que no
  tiene ninguna. Nuevo P-0 para que no se repita la confusión.

De Teutón GUI ya no queda nada por copiar. Fase 6: P1…P4 hechos; queda P5.

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
- `gui/`: árbol Node independiente; `make gui-check` (283 tests), `gui-build`,
  `gui-lab`, **`gui-editor`**. **Las nueve secciones están construidas**:
  Inicio, Clases, Exámenes, Corregir, Resultados, Analíticas, Histórico,
  Ajustes y Ayuda. Modo proyector en la barra lateral. En el directorio de
  datos de usuario: `classes.json` (ADR-0021) y `projects.json`; de cada clase
  sale su aula dentro de la carpeta del examen (ADR-0022).

## Pruebas ejecutadas

`make check` y `make gui-check` (283) verdes, `typecheck` verde. Contra el
laboratorio, con la aplicación construida: `make gui-lab` (S-0…S-4, H-1, X-1,
X-2), `make gui-editor` (D-1…D-7) y el modo examen **entero verde** por primera
vez (E-1…E-5, P-0…P-3, C-1…C-3, S-5). Un examen escrito desde el formulario
corrige el laboratorio: alumne01, 100/100. `make test` no se repitió.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: legacy escrito pero marcado `PEND`; se cierra o se retira en T060.
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen, 5 min.
- El proyector tapa las máquinas, no los nombres del alumnado.
- Los datos de alumnado quedan fuera de toda copia de seguridad hasta T113.
- El editor reescribe el YAML con su propio formato: mismo examen, otra
  disposición. Los comentarios del fichero no sobreviven a un guardado.

## Siguiente tarea recomendada

**T072**, el instalador para Linux con el motor dentro: es lo único que falta
para usar la aplicación sin compilar nada. Después **P5**: T113 y T114.
Sin fecha: T059, T060, T070, T080, T111, T112, T023.
