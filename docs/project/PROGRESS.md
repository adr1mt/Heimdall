# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**T106**: el profesor apunta sus grupos una vez y los reutiliza. «Clases» es
pantalla nueva: crear, editar, duplicar y eliminar un grupo, y por alumno el
identificador, el nombre, el correo o Moodle, la máquina y el usuario. La clase
sobrevive al cierre. Inicio dice «2SMX A · 15 alumnos» en vez de nombrar un
fichero; el fichero de aula y las contraseñas bajan a detalles avanzados, que
se abren solos cuando falta algo. Ninguna contraseña llega al disco, y es
estructural: se serializa campo a campo desde el modelo.

**ADR-0021** fija dónde viven los datos propios de la aplicación. Un fichero de
clases ilegible no se sustituye por una lista vacía: se avisa y no se guarda
nada encima, al revés que con los ajustes.

**T106 salió del paquete P2** por la regla de áreas críticas: guarda datos de
alumnado en disco. T107 y T108 siguen siendo paquete.

**Dirección fijada**: Teutón GUI (`workspace/teuton-gui`) es la referencia
canónica de interfaz. Fase 6 en cinco paquetes: P1 visual (hecho, T100–T105),
P2 clases y proyectos, P3 editor, P4 uso en clase, P5 protección.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `session`, `version`, con
  `--secrets`, `--events=ndjson`, `--retry`, `--session`. Exit: 0 · 2 config ·
  3 parcial · 4 cancelado · 1 sin escribir.
- Motor completo y probado: `model` puro, `plan` con sus nueve validaciones,
  `assert`, `report` atómico, `events`, `engine` y `ssh` (ADR-0011).
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`, el roto en el 2299. `acceptance.sh`
  (A-1…A-14), `eventos.sh` (E-1…E-10), `sesion.sh` (S-1…S-8).
- `gui/`: árbol Node independiente; `make gui-check` (167 tests), `gui-build`,
  `gui-lab`. Vistas vivas: Inicio (modo examen y panel de sesión), Resultados
  (Lista y Matriz, exportación, reintento, cadena), Histórico, Ajustes, Ayuda.
  Modo proyector en la barra lateral. Clases (T106) guarda los grupos en
  `classes.json`, en el directorio de datos de usuario (ADR-0021).

## Pruebas ejecutadas

`make check` verde. `make gui-check` (190) y `typecheck` verdes. Las clases,
probadas con la aplicación construida y un directorio de datos de usar y tirar:
una clase de 15 alumnos guardada y releída, el editor, el borrado con
confirmación y el estado vacío. Una contraseña colada por IPC **no** llega al
`classes.json` real. Los scripts de aceptación y `make test` no se repitieron
esta sesión; quedaron verdes antes.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero la aceptación lo marca `PEND`;
  se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido.
- Un reintento exige el mismo PLAN.
- Intervalo mínimo del modo examen, 5 minutos.
- El proyector tapa las máquinas, no los nombres del alumnado.
- Clase y fichero de aula se eligen por separado hasta T107, que generará el
  aula desde la clase.
- Los datos de alumnado quedan fuera de toda copia de seguridad hasta T113.

## Siguiente tarea recomendada

Resto del **paquete P2** en una sesión: **T107** (pegar desde una hoja de
cálculo y generar el aula desde la clase) y **T108** (espacio de trabajo de
exámenes). Pendiente de fase 5 y sin fecha: **T059**.
