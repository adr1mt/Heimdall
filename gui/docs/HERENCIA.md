# Inventario de lo heredado de Teuton GUI

Veredicto, utilidad a utilidad, de todo lo que `docs/research/GUI-CONTRACT.md`
§3 y §4 registró de la GUI vieja. Cerrado en T059.

De Teuton GUI se conservan la base técnica, la apariencia y el flujo de
trabajo; nunca su contrato (ADR-0016). Una utilidad se conserva cuando resuelve
un problema de aula, y se retira cuando solo existía para tapar un defecto del
motor viejo. No se reimplementa nada por haber existido (principio 10).

Ninguna entrada queda sin veredicto.

## §3 — Andamio del motor viejo

Las once entradas están **retiradas**. Ninguna tiene código en `gui/src`:
`grep` de cada nombre en el árbol de la GUI no devuelve nada.

| Utilidad de la GUI vieja | Veredicto | Motivo |
|---|---|---|
| `lib/progress.ts` | Retirada | El motor emite un evento NDJSON por comprobación. El progreso se lee, no se adivina. |
| `parseTargetsFromCheckOutput` + `computeExpectedTotal` | Retiradas | El denominador se fija en el PLAN antes de tocar ninguna máquina (principio 6) y viaja en el evento de arranque. |
| `checkMonitorHealth` (watchdog de 30 s) + `cycleLimitMs` | Retiradas | El motor tiene timeout por comprobación y presupuesto por alumno: siempre termina (principio 5). |
| `parseFirstJsonValue` + sus `warnings` | Retirados | El artefacto se escribe con fichero temporal y `rename`: o está entero o no está. |
| Filtrado de `case-*.json` contra los ids del resumen | Retirado | Una ejecución escribe un único artefacto con su identificador. No hay informes viejos que descartar. |
| Comparación de `mtime` caso contra resumen | Retirada | Una ejecución parcial se marca como tal y sale con código 3. No se deduce del reloj del disco. |
| `isUnevaluated` + `MatrixStudent.unreachable` | Retiradas | Cada comprobación lleva su estado y su causa en el artefacto (principios 2 y 3). La GUI lee lo que el motor declara. |
| `lib/redact.ts` | Retirada | El artefacto no puede llevar secretos: una referencia `${MAYUSCULAS}` en un `cmd` o en un valor esperado es error de PLAN (ADR-0009). El modo proyector de hoy tapa máquinas, no contraseñas. |
| `resolveViaLoginShell` (`bash -lc command -v teuton`) | Retirada | Binario único. La aplicación empaquetada lleva el motor dentro y cae al `PATH` como último recurso. |
| `looksLikeTeuton` | Conservada, reescrita | Sigue siendo buena idea comprobar que el binario elegido es el correcto. Hoy es `parseEngineVersion`, que solo acepta un programa que se identifique como Heimdall. |
| Registro de «mejor nota» + copias horarias | Conservadas, con otro sentido | Dejaron de ser un salvavidas contra ejecuciones que se pierden. Se conservan por valor pedagógico: la mejor ronda completa de una sesión de examen la decide el motor (ADR-0020), y la copia de notas vive fuera de la carpeta del examen (T113). |

Queda una referencia a Teuton en `tests/engine.test.ts`: una línea de versión
de ejemplo con el prefijo de la fachada congelada. Se borra con ella en T060.
Las cadenas `TEUTON_SECRET_TEST_*` de `scripts/` son solo nombres de variable
de una prueba de fuga de secretos; se renombran en T060.

## §4 — Lógica de aula

Todo **conservado**: es trabajo de profesor, no de motor. Nada de esto dependía
del contrato viejo.

| Utilidad | Veredicto | Dónde vive hoy |
|---|---|---|
| Ejecución en segundo plano con un único suscriptor | Conservada | `stores/run.ts` |
| Modo examen encadenado, bloqueo de suspensión y confirmación al cerrar | Conservado | `lib/exam.ts`, `lib/chain.ts`, `main/close-guard.ts`, `powerSaveBlocker` en `main/ipc.ts` |
| Mejor nota por clase, copias y CSV | Conservados | `main/session.ts`, `main/backup.ts`, `lib/export.ts` |
| Conversión de la nota a la escala del profesor | Conservada | `lib/export.ts`: el motor publica 0-100 y la GUI convierte |
| A quién atender primero | Conservada | `lib/analytics.ts` y la pantalla de Analíticas |
| Modo proyector | Conservado | `lib/projector.ts` |
| Aislamiento de seguridad (CSP, `contextIsolation`) | Conservado | `main/index.ts` y `renderer/index.html` |
| Suite hostil con motor falso | Conservada, rehecha | Los guiones de `scripts/` contra el laboratorio podman, más 306 tests de `gui-check`. El `fake-teuton.mjs` no sobrevive: hablaba el contrato viejo. |
