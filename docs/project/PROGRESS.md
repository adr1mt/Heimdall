# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**T108 hecho: Inicio es la lista de exámenes.** «Abrir», «Nuevo» y los de
siempre, como en Teutón GUI. Un examen es una carpeta con su `examen.yaml`
dentro: se abre la carpeta y la aplicación encuentra el examen. **Ya no se
elige ningún fichero y no hay ninguna ruta en pantalla**: se lee el nombre que
el profesor le puso al examen.

«Nuevo» deja un examen con una comprobación real, corregible desde el primer
minuto. Los recientes viven en `projects.json` (ADR-0021) y sobreviven al
cierre; ilegible se vacía sin ruido, a diferencia de las clases: un atajo
perdido no es trabajo perdido. Sin examen abierto, Corregir, Resultados e
Histórico se ven apagados y no se abren. Abrir otro examen con una corrección
en marcha pregunta antes, la detiene sin matarla y no arrastra nada del
anterior: ni sesión, ni reintento, ni resultado.

**P2 cerrado salvo T116 y T117.** Queda pulido, no estructura.

**Dirección**: Teutón GUI (`workspace/teuton-gui`) es la referencia canónica de
interfaz. Fase 6: P1 visual y P2 clases y proyectos hechos; P3 editor, P4 uso
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
- `gui/`: árbol Node independiente; `make gui-check` (236 tests), `gui-build`,
  `gui-lab`. Vistas vivas: **Inicio** (lista de exámenes), **Corregir** (clase,
  credenciales, modo examen, avance y sesión), Clases, Resultados (Lista y
  Matriz, exportación, reintento, cadena), Histórico, Ajustes, Ayuda. Modo
  proyector en la barra lateral. En el directorio de datos de usuario:
  `classes.json` (ADR-0021) y `projects.json`; de cada clase sale su aula
  dentro de la carpeta del examen (ADR-0022).

## Pruebas ejecutadas

`make check` y `make gui-check` (236) verdes, `typecheck` verde. Contra el
laboratorio, con la aplicación construida y el flujo de proyectos:
`make gui-lab` verde (S-0…S-4, H-1, X-1, X-2) y el modo examen verde (E-1…E-5,
C-1…C-3, P-1, P-3, S-5). El examen que crea «Nuevo» se ha **corregido de
verdad**: alumne01 saca 100/100. **P-2 sigue en rojo** (T118, anterior a esta
sesión). `make test` no se repitió.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: legacy escrito pero marcado `PEND`; se cierra o se retira en T060.
- Un reintento exige el mismo PLAN. Intervalo mínimo del modo examen, 5 min.
- El proyector tapa las máquinas, no los nombres del alumnado.
- P-2 del guion `examen-lab` en rojo; no se ha averiguado desde cuándo (T118).
- Los datos de alumnado quedan fuera de toda copia de seguridad hasta T113.

## Siguiente tarea recomendada

Fin del **paquete P2**: **T116** (pegar una clase desde una hoja de cálculo) y
**T117** (fijar identificador y nombre al desplazar la tabla de Clases).
Después, el paquete **P3**: **T109**, el editor del examen, que es la última
pantalla que Teutón GUI tenía y Heimdall no. Pendiente de fase 5 y sin fecha:
**T059**.
