# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**P2 redefinido.** Un examen no pertenece a una clase: el mismo «Examen DHCP»
se corrige con 2SMX C y con 2SMX D. El flujo será abrir proyecto → Corregir →
elegir clase → corregir. Teutón GUI es la referencia funcional directa y no se
inventa modelo nuevo.

**T107 hecho**: la aplicación escribe el aula a partir de la clase elegida, y
el profesor no ve ningún fichero. Nombre reservado por clase, así que un aula
escrita a mano nunca se pisa, y se rehace en cada corrección, así que un cambio
de IP llega solo (ADR-0022). La clase gana el puerto y **columnas propias**
—`subdominio`, `p1`…`p10`—, que es lo que ya tenía Teutón GUI y lo que hace que
cualquier clase sirva para cualquier examen.

**T106** (ADR-0021): pantalla de Clases con crear, editar, duplicar y eliminar,
guardadas fuera del repositorio y sin contraseñas. Se conserva entera; solo cae
el selector de clase que quedó en Inicio, que se muda a Corregir en T115.

**Dirección**: Teutón GUI (`workspace/teuton-gui`) es la referencia canónica de
interfaz. Fase 6: P1 visual (hecho, T100–T105), P2 clases y proyectos, P3
editor, P4 uso en clase, P5 protección.

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
  `classes.json`, en el directorio de datos de usuario (ADR-0021), y de cada
  clase sale su aula dentro de la carpeta del examen (T107, ADR-0022).

## Pruebas ejecutadas

`make check` verde. `make gui-check` (213) y `typecheck` verdes. El aula
generada, probada contra el motor real: `check` en verde con el examen de RA2 y
con el cuestionario (que pide `p1`…`p10`), y **el examen del prototipo
corregido de verdad con dos clases distintas sobre el laboratorio**, cada una
con su artefacto y sus alumnos. Cero apariciones de la contraseña en toda la
carpeta del examen. El aula escrita a mano, intacta después de generar. La
pantalla de Clases con columnas propias, mirada con la aplicación construida.
Los scripts de aceptación y `make test` no se repitieron esta sesión.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero la aceptación lo marca `PEND`;
  se cierra o se retira en T060.
- Un reintento exige el mismo PLAN.
- Intervalo mínimo del modo examen, 5 minutos.
- El proyector tapa las máquinas, no los nombres del alumnado.
- Inicio todavía pide dos ficheros: lo arreglan T115 (Corregir con selector de
  clase) y T108 (Inicio = proyectos).
- El histórico enseña el nombre del fichero de aula, que ahora es generado y
  feo. Tiene que decir el nombre de la clase: se arregla en T115.
- Los datos de alumnado quedan fuera de toda copia de seguridad hasta T113.

## Siguiente tarea recomendada

Resto del **paquete P2** en una sesión: **T107** (pegar desde una hoja de
cálculo y generar el aula desde la clase) y **T108** (espacio de trabajo de
exámenes). Pendiente de fase 5 y sin fecha: **T059**.
