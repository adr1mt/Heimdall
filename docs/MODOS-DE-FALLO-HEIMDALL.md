# Los 16 modos de fallo, revisados sobre Heimdall

Qué hace Heimdall con cada fallo documentado en
[docs/research/FAILURE-MODES.md](research/FAILURE-MODES.md). Ese documento
describe **Teuton** y es histórico; este dice en qué estado queda cada caso
aquí, con la evidencia que lo sostiene.

Estados: **corregido** · **no aplicable** (el mecanismo no existe en Heimdall)
· **abierto** (queda trabajo, con su tarea).

Evidencia ejecutada el 22-09-2026: `make check` (163 tests del motor, verde),
la suite de la GUI (352 tests, verde) y las comprobaciones de línea de órdenes
que se citan abajo. Los tests de `test/acceptance.sh` y los de integración SSH
piden el laboratorio podman y **no se ejecutaron ese día**; se citan como lo
que verifica cada caso, no como ejecutados.

| id | Estado | Qué hace Heimdall |
|---|---|---|
| F-01 | corregido | No existe ruta de ejecución local |
| F-02 | corregido | Una clave mal escrita es error de PLAN con fichero y línea |
| F-03 | corregido | Un alumno roto no toca a los demás |
| F-04 | corregido | Todo comando tiene tope de tiempo |
| F-05 | corregido | Concurrencia con tope por máquina y por clase |
| F-06 | corregido | Sin aula no hay alumno inventado: exit 2 |
| F-07 | corregido | Avería técnica y suspenso son cosas distintas |
| F-08 | corregido | Misma nota con cualquier idioma del equipo |
| F-09 | corregido | Sin shell: el código de salida es el del comando |
| F-10 | corregido | Los errores se explican; nunca una traza |
| F-11 | no aplicable | No hay macros ni `tt_skip` |
| F-12 | **abierto** | Solo contraseña; la clave SSH es T023 |
| F-13 | corregido | Dos correcciones a la vez no se pisan |
| F-14 | corregido | El CSV viaja como dato, no como fórmula |
| F-15 | corregido | Lo no evaluado se repite sin mover el denominador |
| F-16 | corregido | Cancelar deja escrito lo que ya había |

---

## F-01 · Un host de loopback se corrige en la máquina del profesor

**Corregido por construcción.** El motor no tiene ninguna ruta de ejecución
local: `grep -rn "os/exec"` sobre el módulo Go no devuelve nada. Todo comando
sale por `internal/ssh`, sea cual sea la dirección del host, y no hay
comparación de subcadena que decida nada. Un `127.0.0.1:2201` es una máquina
como cualquier otra.

El laboratorio de pruebas vive en `127.1.2.3` (regla de seguridad, `test/lab.sh`)
precisamente para que ningún test pueda apoyarse en esa confusión.

## F-02 · Un typo borra la comprobación y encoge el denominador

**Corregido.** Las claves del examen y del aula se validan de forma estricta y
el denominador se fija en el PLAN, antes de tocar ninguna máquina (ADR-0002,
ADR-0004).

Comprobado el 22-09-2026 sobre `testdata/proto` con `contiene` escrito
`contienee`:

```
heimdall run: la configuración no es válida
…/examen.yaml:12: clave desconocida "contienee"
exit=2
```

No se escribió nada en el directorio de salida. Tests:
`TestParseReportsEveryUnknownKeyAtOnce`, `TestParseRejects`,
`TestComputeScoreDenominatorComesFromThePlan`,
`TestPlanIsIdenticalForEveryStudent`; A-1 en `test/acceptance.sh`.

## F-03 · Un alumno que revienta aborta la clase entera

**Corregido.** Cada alumno corre aislado y un fallo suyo, incluido un pánico
del propio motor, se queda en su ficha como error técnico.

Tests: `TestBrokenStudentDoesNotTouchTheOther`, `TestPanicBecomesEngineError`,
`TestBudgetStopsOnlyThatStudent`, `TestArtifactIsWrittenWhenEveryStudentFails`;
A-4 en `test/acceptance.sh`.

## F-04 · Sin timeout de comando

**Corregido.** Cada comprobación lleva su tope de tiempo, y el proceso remoto
se mata con `timeout -k` en la máquina del alumno cuando allí hay coreutils. Si
no lo hay, se avisa en `warnings`: el comando podría quedar corriendo allí,
pero la corrección no se queda esperando.

Tests: `TestRunKillsTheRemoteProcessOnTimeout`, `TestHostWithoutCoreutilsTimeout`
(integración SSH); A-5 en `test/acceptance.sh`.

## F-05 · La concurrencia sin límite provoca ceros

**Corregido.** Hay tope de alumnos en paralelo y tope de conexiones
simultáneas contra una misma máquina (ADR-0012, ADR-0013), configurables en el
examen y por línea de órdenes.

Tests: `TestHostConcurrencyIsNeverExceeded`, `TestHostConcurrencyIsPerHost`,
`TestOneSessionPerHost`, `TestPlanDefaultsFeedTheEngine`; carga en
`test/carga.sh`.

## F-06 · Sin inventario se inventa un alumno con un 100

**Corregido.** Comprobado el 22-09-2026: un directorio con examen y sin aula
termina con exit 2, el mensaje nombra el fichero que falta y no se escribe
artefacto. Un directorio vacío da exit 2 con el modo de uso. Una referencia de
contraseña sin variable definida también es error de PLAN, nunca una contraseña
vacía (`TestMissingSecretIsNotAnEmptyPassword`).

## F-07 · Error técnico y fallo académico son lo mismo

**Corregido.** Es el núcleo del diseño (ADR-0005, ADR-0006): una comprobación
que no se pudo medir queda `UNEVALUATED` con su causa, nunca suspensa, y quien
tiene algo sin evaluar no recibe nota final.

Tests: la tabla de causas se prueba de forma exhaustiva en `internal/model`;
A-2 y A-3 en `test/acceptance.sh`.

## F-08 · La nota depende del idioma del equipo del profesor

**Corregido, con una condición que es del examen, no del motor.** A-12 corre el
mismo examen bajo `es_ES.UTF-8` y bajo `LC_ALL=C` y compara las notas: idénticas
(`test/acceptance.sh`, verificado en la aceptación de la fase 1).

La condición: el motor no fija el idioma de la máquina del alumno. Lo que hace
que la nota no dependa de él es que las aserciones se escriben sobre datos
estables —`systemctl is-active`, `id -un`, un código de salida— y no sobre
mensajes traducidos. Está en la regla de calidad y en la guía de traducción de
exámenes. **Aceptado así**: forzar `LC_ALL=C` en cada comando daría una falsa
sensación de seguridad sobre un examen que compare textos del sistema.

## F-09 · Exit codes inconsistentes según los metacaracteres

**Corregido.** Los comandos son vectores de argumentos y no hay shell en ningún
punto (ADR-0003, regla de arquitectura 7). Un valor sustituido entra tal cual,
con espacios, comillas o `;`. El código de salida es siempre el del comando.

Tests: `TestExitCode`, `TestClassifyExitCode127IsAcademic`,
`TestRunSeparatesTheTwoStreamsAndReportsTheExitCode`.

## F-10 · El manejador de errores revienta él mismo

**Corregido.** Los errores de configuración llevan fichero y línea; no hay
trazas de pila en el artefacto; un pánico del motor se convierte en
`ENGINE_ERROR` con su detalle. Los exit codes son discriminantes: 0, 2, 3, 4
(`TestExitCodesAreDiscriminant`, `TestPanicBecomesEngineError`).

## F-11 · `tt_skip` aborta la ejecución

**No aplicable.** No hay macros, ni `method_missing`, ni `tt_skip`. Dejar a un
alumno fuera es una operación normal y probada, y no mueve el denominador de
los demás: `TestExcludedStudentIsReportedWithoutGrade`,
`TestExcludedStudentDoesNotMoveTheOthersDenominator`.

## F-12 · Las claves SSH modernas tumban la ejecución

**Abierto, pero sin el daño original.** Heimdall autentica **solo por
contraseña** (`internal/ssh/session.go`), así que el fallo no se puede dar; a
cambio, quien quiera corregir con clave todavía no puede. Es la tarea **T023**
(P2).

Los dos agravantes de Teuton ya no existen: no se lee ni se escribe el
`known_hosts` del profesor, y la identidad de cada máquina se anota por
ejecución (ADR-0011, `TestAChangedIdentityIsRefused`).

## F-13 · Ejecuciones simultáneas se pisan los informes

**Corregido.** Cada corrección escribe en su propio directorio identificado por
ULID y el artefacto se escribe de forma atómica.
Tests: `TestConcurrentRunsDoNotCollide`, `TestWriteFinalAndLatest`.

## F-14 · CSV sin librería: inyección y filas duplicadas

**Corregido en la GUI**, que es quien exporta. El valor que empieza por `=`
viaja como dato, un separador dentro de un nombre no parte la línea en dos
alumnos y el fichero no lleva marca de orden de bytes.
Tests: `gui/tests/moodle.test.ts` (352 tests de la GUI, verdes el 22-09-2026).

## F-15 · Sin reintentos

**Corregido.** Lo que quedó sin evaluar se puede repetir sobre el mismo PLAN,
conservando el denominador y la evidencia del intento anterior (ADR-0018), y el
modo examen encadena vueltas quedándose con la mejor entera (ADR-0020).
Tests: los seis `TestRetry…` de `internal/engine` y `cmd/heimdall`.

Decisión deliberada que conviene recordar: unas credenciales rechazadas **no**
se reintentan (`TestDialNeverRetriesRejectedCredentials`). Reintentar ahí
bloquea cuentas, no arregla nada.

## F-16 · Cancelar no guarda nada

**Corregido.** El artefacto se escribe siempre, incluso con cancelación o con
todos los alumnos rotos; hay artefacto parcial tras cada alumno y lo pendiente
queda marcado como cancelado, con exit 4.
Tests: `TestPartialArtifactAfterEachStudent`,
`TestCancellationLeavesPendingChecksCancelled`,
`TestArtifactIsWrittenWhenEveryStudentFails`, `TestExitCodesAreDiscriminant`.

---

## Auditoría de secretos, de punta a punta (T082)

Ejecutada el 22-09-2026 con el laboratorio levantado y una contraseña
envenenada, `HEIMDALL_SECRET_TEST_12345`. Cero coincidencias en todos los
puntos comprobados.

Lado del motor, `test/secrets.sh`, todo verde:

- `argv` del proceso **vivo** (`/proc/<pid>/cmdline`);
- salida del terminal, `stdout` y `stderr`;
- todo lo escrito bajo `var/`, incluido `latest.json`;
- el flujo de eventos NDJSON que lee la aplicación;
- los artefactos de un reintento y de una vuelta de sesión de examen;
- stdin cerrado, stdin sin datos y referencia sin variable: exit 2, sin
  artefacto y sin contraseña vacía.

Lado de la aplicación, `gui/tests/secretos.test.ts`:

- el aula que genera lleva `password_ref: "${AULA_PASSWORD}"`, nunca el valor;
- una clase editada a mano con una contraseña dentro la pierde al leerla;
- los argumentos del motor no la llevan: sale por stdin y solo por ahí;
- las exportaciones (hoja de notas, CSV de Moodle, resumen) llevan notas, no
  la salida de las máquinas, ni aunque esa salida la contuviera;
- lo guardado en disco está cifrado y no es legible (`gui/tests/vault.test.ts`,
  ADR-0023), y las copias de seguridad guardan notas, no evidencias
  (`gui/tests/backups.test.ts`).

Dos observaciones, ninguna es un fallo:

1. **El artefacto no nombra la referencia.** La regla de seguridad dice que en
   el artefacto aparece la referencia y nunca el valor; lo que hay es menos:
   ni una cosa ni la otra. El artefacto registra el usuario y la dirección de
   cada máquina, que no son credenciales.
2. **Una columna del profesor es texto libre.** Las columnas propias de una
   clase viajan tal cual al aula generada. Quien escriba ahí a mano su
   contraseña la escribe en un fichero legible. No hay forma de distinguirlo
   de un dato del examen, y el sitio para la contraseña es la casilla de
   «Corregir», que sí la guarda cifrada.

---

## Lo que queda

| Qué | Dónde |
|---|---|
| Autenticación por clave SSH (F-12) | T023 |
| Documentación de usuario y versión | T083 |
| Un examen real de aula corregido entero | T084 |
