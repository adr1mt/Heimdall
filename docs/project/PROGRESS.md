# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**T115 hecho: corregir es elegir la clase y pulsar.** «Corregir» es una
sección propia: el examen abierto, la clase entre las guardadas, las
credenciales de esa corrección, el avance y el panel de sesión. Inicio se queda
solo con el examen. **Ya no se elige ningún fichero de aula**: la petición
lleva la clase y la aplicación escribe su aula antes de cada corrección
(ADR-0022). El histórico dice el nombre de la clase, no el fichero generado.

El aula generada gana `usuario` en el alumno: sin eso, un examen que dice
`${alumno.usuario}` no se podía corregir desde una clase.

**Revisión visual de Clases** antes de T115, con la aplicación construida. De
ahí sale **T117**: con muchas columnas propias, al desplazar la tabla se pierde
de vista de quién es cada fila. No bloquea P2.

**P2**: un examen no pertenece a una clase; el mismo examen se corrige con
2SMX C y con 2SMX D. T106 (Clases, ADR-0021) y T107 (aula generada, ADR-0022)
siguen enteros.

**Dirección**: Teutón GUI (`workspace/teuton-gui`) es la referencia canónica de
interfaz. Fase 6: P1 visual (hecho), P2 clases y proyectos, P3 editor, P4 uso
en clase, P5 protección.

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
- `gui/`: árbol Node independiente; `make gui-check` (219 tests), `gui-build`,
  `gui-lab`. Vistas vivas: Inicio (el examen abierto), **Corregir** (clase,
  credenciales, modo examen, avance y sesión), Clases, Resultados (Lista y
  Matriz, exportación, reintento, cadena), Histórico, Ajustes, Ayuda. Modo
  proyector en la barra lateral. Las clases viven en `classes.json`, en el
  directorio de datos de usuario (ADR-0021), y de cada clase sale su aula
  dentro de la carpeta del examen (ADR-0022).

## Pruebas ejecutadas

`make gui-check` (219) y `typecheck` verdes. Contra el laboratorio, con la
aplicación construida y el flujo nuevo: `make gui-lab` entero verde (S-0…S-4,
H-1, X-1, X-2); el mismo examen corregido con **dos clases distintas**, cada
una con su artefacto y sus alumnos, sin elegir más fichero que el examen; el
modo examen E-1…E-5 verde; el histórico enseñando «Laboratorio». **P-2 del
guion del examen falla** (el detalle técnico de una comprobación no se abre en
Resultados): apuntado como T118, no lo toca T115. `make check` y `make test` no
se repitieron esta sesión.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: legacy escrito pero marcado `PEND`; se cierra o se retira en T060.
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen, 5 min.
- El proyector tapa las máquinas, no los nombres del alumnado.
- Inicio todavía pide el fichero del examen: lo arregla T108 (Inicio =
  proyectos).
- P-2 del guion `examen-lab` en rojo; no se ha averiguado desde cuándo (T118).
- Los datos de alumnado quedan fuera de toda copia de seguridad hasta T113.

## Siguiente tarea recomendada

Resto del **paquete P2**: **T116** (pegar una clase desde una hoja de cálculo)
y **T108** (Inicio como lista de proyectos). Después, **T117** (fijar
identificador y nombre al desplazar la tabla de Clases) y **T118**. Pendiente
de fase 5 y sin fecha: **T059**.
