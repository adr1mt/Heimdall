# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-20 · **Fase**: 5 — Heimdall GUI sobre el contrato nativo

## Última sesión

**T055, hecha. D-8 cerrada con ADR-0018.** Ante un alumno incompleto la
aplicación no hace nada por su cuenta: enseña qué falta —en comprobaciones y en
peso, que no son la misma cifra— y ofrece dos salidas. Dejarlo pendiente es lo
normal. Repetir solo repite lo que no se pudo comprobar: lo que salió bien y lo
que salió mal no se vuelve a intentar. El reintento se guarda aparte, dice de
qué corrección viene y conserva, comprobación a comprobación, qué era y por qué
causa la vez anterior. Nada automático convierte un «sin evaluar» en suspenso ni
inventa una nota final. Marcar a mano queda fuera del MVP.

Consolidar una cadena de correcciones para cerrar la nota de quien quedó entero
entre dos pasadas es **T057**, nueva y bloqueada por T054.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`; en shell no
  interactiva hay que exportar el `PATH` a mano. `go.mod`: `module heimdall`.
- `cmd/heimdall`: `check`, `run`, `version`. `run`: `--secrets=stdin|env`,
  `--var`, `--cname`, `--case`, `--concurrency`, `--host-concurrency`,
  `--events=ndjson`, `--retry=<artefacto>` y, congeladas, `--compat=teuton2` y
  `--export=json`. `--retry` no se combina con `--case` ni con la fachada.
  Exit: 0 ok · 2 config inválida · 3 parcial · 4 cancelado · 1 ni se pudo
  escribir.
- `internal/model` (puro): `Classify`, `ComputeScore`, `StudentStatusOf`; el
  rastro del intento anterior está en el artefacto y no entra en ninguna nota.
  `plan`: los dos YAML y las nueve validaciones. `assert`: cinco aserciones.
  `report`: escritura atómica y redacción. `events`: contrato NDJSON (ADR-0017),
  con la procedencia del reintento en `run.start`.
- `internal/engine`: pool de 16, 4 aperturas por máquina, presupuesto por
  alumno, parcial tras cada alumno y selección de reintento. `internal/ssh`: 2
  reintentos, identidades en memoria (ADR-0011), 64 kB por flujo, corte a 8 MB.
- `test/lab.sh`: `alu1` en `127.1.2.3:2201`; el alumno roto, puerto 2299.
  `acceptance.sh` recorre A-1 a A-14 y `eventos.sh` E-1 a E-10.
- `gui/`: árbol Node independiente; `make gui-check` (70 tests), `gui-build` y
  `gui-lab`. Vistas: Inicio, Resultados, Ajustes, Ayuda. Resultados lleva el
  panel de lo que quedó sin comprobar y manda el reintento a Inicio, que pide
  otra vez las credenciales y lanza el motor con `--retry`.
- `workspace/teuton-gui` es referencia de solo lectura.

## Pruebas ejecutadas

`make check` y `make gui-check` (70 tests) verdes · `gofmt -l` sin salida ·
`acceptance.sh` (13 en verde, A-10 pendiente) y `eventos.sh` (E-1 a E-10)
verdes · `make gui-lab` verde (S-0 a S-4) · prototipo corregido contra el
laboratorio y reintentado sobre su artefacto: se repitió solo lo que quedó sin
evaluar, lo demás salió «no se repitió» con su resultado anterior anotado, y
cero coincidencias del secreto en `var/` y en los logs. `make test` no se
repitió.

## Problemas conocidos

- Laboratorio en **`127.1.2.3`**, nunca `127.0.0.x` (F-01, A-11).
- **A-10**: los ficheros legacy se escriben, pero el script de aceptación lo
  marca `PEND`. Con la capa congelada, se cierra o se retira en T060.
- El artefacto de un reintento parcial no da nota final, y es correcto: la
  cadena entera se lee en T057.
- Un reintento exige el mismo PLAN. Si lo que había mal era el `aula.yaml`, esa
  clase se corrige entera otra vez.

## Siguiente tarea recomendada

**T054** (`READY`, P1): histórico, modo examen y analíticas sobre el modelo
canónico. Desbloquea T057.
