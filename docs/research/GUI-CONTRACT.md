# Qué necesita Teuton GUI del motor

Estado de la GUI en este equipo **[PRUEBA]**: `npm run typecheck` limpio,
**192 tests unitarios** en verde (1,02 s) y **40 escenarios e2e** de la UAT
hostil en verde (~60 s, tras `npm run build`). `npm run verify:parsing` contra
la salida real de 100 alumnos: 9 comprobaciones, todas correctas.

No es un frontend que haya que rescatar. Es código sano cuya complejidad está,
en buena parte, **compensando defectos del motor**.

---

## 1. La superficie de acoplamiento es pequeña

Toda la dependencia de Teuton cabe en esta tabla. Es lo único que un motor
sucesor tiene que reproducir (o sustituir por algo mejor).

| # | Punto de contacto | Dónde | Forma |
|---|---|---|---|
| C1 | `teuton version` | `main/teuton.ts:216` | stdout que case con `/version\s+([\d.]+)/i` |
| C2 | `teuton check [--cname=X] .` | `main/ipc.ts:390` | exit code + stdout con la tabla «DSL Stats» |
| C3 | `teuton run --export=json [--cname=X] [--case=1,2] .` | `main/teuton.ts:309` | proceso con `cwd` = proyecto |
| C4 | Progreso en vivo | `lib/progress.ts` | un carácter (`.` `F` `S`) por comprobación en stdout, entre «Started at» y «Finished in» |
| C5 | Ubicación de la salida | `main/results.ts:220` | `tt_outdir` o `var/<tt_testname>` leídos del config **antes** de lanzar |
| C6 | `var/<test>/resume.json` | `main/results.ts:180` | `cases[]` con `id, members, grade, letter, moodle_id, skip, conn_status` |
| C7 | `var/<test>/case-NN.json` | `main/results.ts:163` | `config`, `groups[].targets[]`, `results.grade` |
| C8 | `var/<test>/moodle.csv` | `main/results.ts:313` | se lee tal cual |
| C9 | `teuton run --export=FORMATO .` | `main/ipc.ts:486` | exportación a otro formato bajo demanda |
| C10 | Formato del `config.yaml` | `lib/config.ts` | YAML con `global:` y `cases:`, claves con `:` opcionales |
| C11 | Formato del `start.rb` | editor de texto | se edita, no se interpreta |

Nueve de los once son **datos** (ficheros y códigos de salida). Solo C4 y C11
dependen de detalles de implementación de Ruby.

## 2. Asimetría entre `resume.json` y `case-NN.json` **[PRUEBA]**

Esta es la causa de más código defensivo en la GUI:

| Dato | `resume.json` | `case-NN.json` |
|---|---|---|
| nota | sí | sí |
| `conn_status` (estado técnico) | **sí** | **no** |
| `moodle_id` | sí | no |
| `skip` | sí | vía `config.tt_skip` |
| detalle por comprobación | no | sí |
| estado técnico por comprobación | **no existe en ninguno** | |

Consecuencias medidas:

- La GUI tiene que **cruzar los dos ficheros** para construir una fila de alumno
  (`analytics.ts:buildMatrix` recibe `StudentRow[]`, no `LoadedResults`,
  precisamente por esto).
- La regla «máquina apagada, no examen suspendido» es una **inferencia**:
  `isUnevaluated(row) = connErrors > 0 && grade === 0`. Con un corte a mitad de
  examen (F-07, nota 33 con `conn_status: error`) la inferencia no aplica y la
  GUI conserva deliberadamente el 33. Está documentado como compromiso conocido.
- `resume.json` **no lleva** el detalle, así que un `case-NN.json` ilegible hace
  desaparecer al alumno de la matriz aunque siga en la lista. De ahí
  `parseFirstJsonValue` y el array `warnings`.

## 3. Código de la GUI que existe solo por defectos del motor

Cada entrada es código real, con su test, que **desaparecería** con un motor que
emitiera eventos y estados explícitos.

| Módulo / mecanismo | Compensa | Se puede borrar si… |
|---|---|---|
| `lib/progress.ts` (246 líneas, máquina de estados incremental) | C4: no hay progreso legible por máquina | el motor emite un evento NDJSON por comprobación |
| `parseTargetsFromCheckOutput` + `computeExpectedTotal` | el total de comprobaciones hay que adivinarlo de `teuton check` | el motor anuncia el total en un evento `run.start` |
| `checkMonitorHealth` (watchdog de 30 s) + `cycleLimitMs` | F-04: no hay timeout de comando | el motor tiene timeout por comprobación y siempre termina |
| `parseFirstJsonValue` + `warnings` | F-13: dos ejecuciones se pisan el JSON | escritura atómica (`rename`) y un bloqueo por proyecto |
| filtrado de `case-*.json` contra los ids del `resume` | Teuton nunca borra informes viejos | el motor escribe un único artefacto por ejecución, con su id |
| comparación de `mtime` caso vs resumen | F-16: la ejecución puede morir a medias | la ejecución es atómica o se marca `partial` explícitamente |
| `isUnevaluated` + `MatrixStudent.unreachable` | F-07: no hay estado técnico por comprobación | cada comprobación lleva su estado (`ERROR`, `TIMEOUT`, …) |
| `lib/redact.ts` (modo proyector) | secretos en `command` y en el config volcado | el informe no lleva secretos (ver `SECURITY.md` §6) |
| Registro de «mejor nota» + copias horarias | F-03/F-05/F-16: la nota buena se pierde si la máquina se apaga o la pasada muere | sigue teniendo valor pedagógico, pero deja de ser un salvavidas |
| `resolveViaLoginShell` (`bash -lc command -v teuton`) | Teuton es un gem de Ruby en una ruta que el escritorio no ve | binario único |
| `looksLikeTeuton` | C1: hay que verificar que el binario es el correcto | sigue siendo buena idea |

Estimación honesta: **entre 500 y 700 líneas de la GUI son andamio del motor**,
sobre ~4.900 de `src/`. No es la mayor parte de la app, pero sí buena parte de lo
más delicado.

## 4. Lo que la GUI hace bien y no debe tocarse

Todo esto es lógica de aula, no de motor, y sobreviviría intacta:

- El modelo de ejecución en segundo plano (Zustand global, `useRunManager` como
  único suscriptor, contexto congelado por pasada).
- El «modo examen» con cadena de `setTimeout`, el bloqueo de suspensión y la
  confirmación al cerrar.
- El registro de mejor nota por clase, las copias horarias y el CSV por clase.
- La conversión de nota configurable (0-100 del motor a la escala del profesor).
- Alumnos estancados, lista de atención, pre-vuelo, modo proyector.
- El aislamiento de seguridad: CSP, `contextIsolation`, `allowedRoots`.
- La UAT hostil: 40 escenarios + `fake-teuton.mjs` con 14 modos de fallo.

**No hay ninguna razón técnica para reescribir la GUI.**

## 5. Lo que el motor nuevo debería ofrecer

Derivado de los puntos anteriores, no de preferencias:

1. **Un evento por comprobación** (NDJSON por stdout), con id de alumno, id de
   comprobación, estado, peso y duración. Borra C4 y `progress.ts` enteros.
2. **Un evento inicial** con el número total de comprobaciones **por alumno**,
   emitido tras resolver el plan. Con tests declarativos ese número es exacto,
   cosa que hoy es imposible (`c14-check`).
3. **Estado técnico por comprobación y por alumno**, no una etiqueta derivada de
   la nota. Borra `isUnevaluated` y arregla el caso del corte a mitad.
4. **Un único artefacto JSON por ejecución**, con id de ejecución y escritura
   atómica. Borra `parseFirstJsonValue`, el filtrado por ids y la comparación de
   `mtime`.
5. **Informes sin secretos**, por construcción.
6. **Terminar siempre**: timeout por comprobación y por ejecución, y cancelación
   que **escribe lo que haya** con los no ejecutados marcados como tales. Borra
   el watchdog.
7. **Códigos de salida discriminantes**: 0 = todo evaluado, y códigos distintos
   para «configuración inválida», «ejecución parcial», «cancelado». Hoy una nota
   falsa por typo de DSL sale con 0 (F-02).

## 6. La ruta de migración que sugiere la evidencia

El acoplamiento real es C1-C11, y `fake-teuton.mjs` ya es una **especificación
ejecutable** de ese contrato: 316 líneas que imitan a Teuton 2.10.6 con 14 modos
de avería, verificadas contra informes reales en
`tests/fixtures/teuton-2.10.6/`.

Eso da un camino de migración sin salto al vacío:

1. El motor nuevo emite NDJSON **y** escribe los mismos `resume.json` /
   `case-NN.json` (un formateador de compatibilidad, no el formato nativo).
2. La GUI funciona con él **sin cambiar una línea**, y la UAT de 40 escenarios
   sirve de prueba de aceptación del motor.
3. Solo entonces se sustituye C4 por el consumo de NDJSON, y después C6/C7 por el
   artefacto nativo, borrando el andamio de la tabla §3 módulo a módulo.

Cada paso es reversible y verificable con suites que ya existen.

## 7. Decisiones de la dirección preliminar que la GUI confirma o corrige

| Decisión | Veredicto |
|---|---|
| Binario único | **Confirmada.** `resolveViaLoginShell`, `gemBinDirs` y el `manualPathError` de Ajustes existen porque Teuton es un gem. |
| NDJSON para la GUI | **Confirmada**, y es la que más código borra (§3). |
| Estados técnicos separados de resultados académicos | **Confirmada**, y hace falta **por comprobación**, no solo por alumno: si no, el caso de `s06-drop` sigue sin solución. |
| Adaptar la GUI, no reescribirla | **Confirmada.** El acoplamiento son 11 puntos y buena parte es leer ficheros. |
| Sin DSL Ruby ejecutable en el MVP | **Confirmada**, con una salvedad: el editor de `start.rb` y el flujo de proyectos de la GUI asumen dos ficheros (script + config). Mantener esa forma (`examen.yaml` + `aula.yaml`) reduce el cambio a un cambio de extensión y de resaltado. |
