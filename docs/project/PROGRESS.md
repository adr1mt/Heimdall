# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**T072: la aplicación se instala con el motor dentro.** Un commit.

- `make gui-dist` deja en `gui/dist` un AppImage y un `.deb` con el motor
  dentro. Quien lo instala no instala nada más: ni Go, ni Ruby, ni contenedores.
- Sin nada elegido en Ajustes, la aplicación usa el motor que lleva dentro. Una
  ruta elegida a mano sigue mandando sobre él; un `heimdall` a secas guardado
  por una instalación antigua ya no ata a la aplicación al motor del sistema.
- `make gui-paquete` comprueba el paquete construido, no el árbol de
  desarrollo: P-1 lleva el motor, P-2 con el entorno vacío corrige igual que el
  compilado del repositorio, P-3 arranca sin ningún `heimdall` en el `PATH`.

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

`make check` y `make gui-check` (290) verdes, `typecheck` verde. Contra el
laboratorio, con la aplicación construida: `make gui-lab` (S-0…S-4, H-1, X-1,
X-2), `make gui-editor` (D-1…D-7) y el modo examen **entero verde** por primera
vez (E-1…E-5, P-0…P-3, C-1…C-3, S-5). Un examen escrito desde el formulario
corrige el laboratorio: alumne01, 100/100. Del paquete real, `make gui-paquete`
(P-1…P-3) verde. `make test` no se repitió.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: legacy escrito pero marcado `PEND`; se cierra o se retira en T060.
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen, 5 min.
- El proyector tapa las máquinas, no los nombres del alumnado.
- Los datos de alumnado quedan fuera de toda copia de seguridad hasta T113.
- El paquete se construye para Linux x64. Windows y macOS quedan fuera
  (decisión del 2026-09-21).
- El editor reescribe el YAML con su propio formato: mismo examen, otra
  disposición. Los comentarios del fichero no sobreviven a un guardado.

## Siguiente tarea recomendada

**T113**, copias de seguridad de las notas: es área crítica (persistencia de
notas), una tarea por sesión y sin encadenar. Después **T114**, actualización
automática, que T072 ha desbloqueado.

Sin fecha: T059, T060, T070, T080, T111, T112, T023.
