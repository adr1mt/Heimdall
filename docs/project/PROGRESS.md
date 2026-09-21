# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**T060: fuera la capa del motor viejo.** Un commit.

- Heimdall ya no sabe escribir los ficheros del programa antiguo ni se hace
  pasar por él. Se fue el paquete entero, las banderas que lo encendían y la
  línea de versión con su nombre.
- Se queda `--cname`: dejó de ser andamio el día que cada clase tuvo su propia
  aula dentro de la carpeta del examen. Ahora está escrito como contrato vivo.
- El laboratorio de pruebas tiene su propia receta de contenedor, con su propia
  contraseña de mentira. Ya no depende de material del sistema viejo.
- El criterio A-10 queda retirado: pedía ficheros de un formato que ya no
  existe.

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
