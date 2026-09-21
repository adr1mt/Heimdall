# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-21 · **Fase**: 6 — Realineación de producto

## Última sesión

**T067**: un examen cuya aula no pide ninguna contraseña ya se corrige entero
desde la aplicación, con Corregir y en modo examen. Antes el motor daba por
error que no llegara ninguna credencial; ahora «no hace falta ninguna» es una
respuesta válida y sigue siendo error que falte una que el aula sí pide, con el
nombre de la que falta. Nada cambia para las aulas con contraseña.

**Dirección fijada**: Teutón GUI (`workspace/teuton-gui`) es la referencia
canónica de interfaz. La fase 6 la realinea en cinco paquetes: P1 visual, P2
clases y proyectos, P3 editor, P4 uso en clase, P5 protección. Un paquete por
sesión; nota, motor, SSH, secretos, persistencia y contrato, una tarea.

**P1 hecho** (T100–T105): barra lateral con Inicio, Clases, Exámenes,
Resultados, Analíticas e Histórico, desactivado lo que aún no existe.
Resultados abre con cómo va la clase, una fila por alumno y la matriz de
comprobaciones; los bloques técnicos, en un renglón. Inicio dice qué examen y
qué clase hay por su nombre, y durante el examen la tira de la sesión. La marca
de aprobado está en Ajustes y no cambia ninguna nota.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `consolidate`, `session`, `version`, con
  `--secrets`, `--events=ndjson`, `--retry`, `--session` y las banderas
  congeladas. Exit: 0 · 2 config · 3 parcial · 4 cancelado · 1 sin escribir.
- Motor completo y probado: `model` puro (ADR-0019 y ADR-0020), `plan` con sus
  nueve validaciones, `assert`, `report` atómico, `events`, `engine` (pool,
  presupuesto, reintento, `ExcludeFinished`) y `ssh` (ADR-0011, 64 kB, 8 MB).
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`, el roto en el 2299.
  `acceptance.sh` (A-1…A-14), `eventos.sh` (E-1…E-10), `sesion.sh` (S-1…S-8).
- `gui/`: árbol Node independiente; `make gui-check` (167 tests), `gui-build`,
  `gui-lab`. Vistas vivas: Inicio (modo examen y panel de sesión), Resultados
  (Lista y Matriz, exportación, reintento, cadena), Histórico, Ajustes, Ayuda.
  Modo proyector en la barra lateral.

## Pruebas ejecutadas

`make check` verde. `make gui-check` (167) y `typecheck` verdes. El aula sin
contraseñas, corregida con el motor real sobre `testdata/cuestionario`. Las pantallas nuevas,
miradas con el motor real sobre `testdata/cuestionario` ampliado a 15 alumnos
ficticios. `make check`, los scripts de aceptación y `make test` no se
repitieron esta sesión; quedaron verdes antes.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero la aceptación lo marca `PEND`;
  se cierra o se retira en T060.
- El histórico se apoya en la carpeta del examen elegido.
- Un reintento exige el mismo PLAN.
- Intervalo mínimo del modo examen, 5 minutos.
- El proyector tapa las máquinas, no los nombres del alumnado.
- Inicio dice «Aula» a propósito: es el fichero, no una clase. Pasa a
  «Clase» en P2 (T106), no antes.

## Siguiente tarea recomendada

**T067** (`READY`, P0), en sesión propia y sin encadenar. Después, el **paquete
P2**: ADR-0021 + T106, T107 y T108 en una sola sesión.
