# Contrato nativo motor ↔ GUI

Versión del contrato: **1**. Esquema del artefacto: `schema_version` **1**.

Es el único canal entre Heimdall GUI y el motor (ADR-0016, ADR-0017). No hay
otro: ni ficheros de Teuton, ni progreso por caracteres, ni adivinar leyendo
texto.

```
GUI ──► argv + secretos por stdin ──────────► motor
GUI ◄── eventos NDJSON por stdout ─────────── motor   (mientras corre)
GUI ◄── artefacto canónico JSON ───────────── motor   (el resultado)
```

## 1. Qué es cada mitad

**El artefacto es la fuente de verdad.** Está descrito en
[`schema/run-result.schema.json`](schema/run-result.schema.json) y en
[`04-MODELO-RESULTADO.md`](04-MODELO-RESULTADO.md). Todo el resultado está
ahí: notas, causas, salidas acotadas, avisos, hashes.

**Los eventos son el progreso.** Dicen qué está pasando, no guardan nada que
el artefacto no tenga. Una GUI que se pierda un evento pierde progreso y nunca
una nota. Por eso el flujo no lleva la salida de las máquinas del alumnado:
es dato no confiable y sin límite de tamaño, y su sitio es el artefacto, donde
va acotada.

## 2. Cómo se pide una ejecución

```bash
printf '%s' "$SECRETS_JSON" | heimdall run --secrets=stdin --events=ndjson --var=var <directorio>
```

- `--events=ndjson` enciende el flujo. Por defecto está **apagado**: sin la
  bandera, `stdout` lleva el resumen en prosa para el profesor.
- Con `--events=ndjson`, `stdout` es **solo** del flujo. El resumen en prosa no
  se imprime y los avisos del proceso van a `stderr`.
- `--events` y `--export` son incompatibles: los dos escriben en `stdout`.
  Pedir ambos es error de configuración (exit 2).
- Los secretos viajan por `stdin` en una línea JSON. Nunca por `argv`
  (ADR-0009). El sobre es `{"schema":1,"secrets":{…}}` y se manda **siempre**,
  también cuando el aula no pide ninguna contraseña: entonces `secrets` va
  vacío y el motor lo acepta. Que falte una credencial que el PLAN sí pide es
  error de configuración (exit 2) y el motor la nombra.
- `--retry=<artefacto>` repite **solo las comprobaciones que aquella ejecución
  dejó `UNEVALUATED`** (ADR-0018). El motor elige qué se repite leyendo ese
  fichero: la GUI nombra el artefacto y nada más, nunca una lista de alumnos ni
  de comprobaciones. Si el `plan_hash` no coincide con el PLAN recién resuelto,
  es error de configuración (exit 2) y no se toca ninguna máquina.
  `--retry` no se combina con `--compat`, `--export` ni `--case`.
- `--session=<vuelta>`, repetible, deja fuera de esta vuelta a quien la sesión
  ya dio por terminado (§8). No se combina con `--retry` ni con la fachada
  congelada.

Códigos de salida, sin cambios: `0` todo evaluado · `2` configuración inválida
· `3` ejecución parcial · `4` cancelada · `1` ni se pudo escribir.

## 3. Formato

Una línea, un objeto JSON, codificación UTF-8, sin sangrado y sin escapar
HTML. Toda línea lleva el sobre:

| Campo | Qué es |
|---|---|
| `event` | El nombre del evento |
| `seq` | Entero monótono desde 1. Un salto significa una línea perdida |
| `ts` | RFC 3339 con zona |

Los alumnos se evalúan en paralelo, así que **los eventos de alumnos distintos
se entrelazan**. Dentro de un alumno el orden sí es el del PLAN. Cada evento
dice de quién habla con `student_id`.

## 4. Los cinco eventos

### `run.start`

Primera línea, siempre. Fija lo que la ejecución va a hacer antes de tocar
ninguna máquina.

| Campo | Qué es |
|---|---|
| `contract_version` | Versión de este contrato. Si la GUI no la conoce, lo dice y para |
| `run_id`, `engine_version` | Identidad de la ejecución y del motor |
| `exam`, `inventory`, `plan_hash` | Ruta, `sha256` y versión de cada entrada |
| `plan` | El PLAN: `check_count`, `total_weight`, `check_ids`, concurrencias |
| `expected_checks` | `check_count` × alumnos no excluidos. El **total de la barra de progreso**, nunca el denominador |
| `students` | Todos los alumnos, con `excluded`, para dibujar la clase entera de una vez |
| `retry_of` | Opcional. Presente solo si la ejecución repite lo que otra dejó sin evaluar: `run_id`, `artifact`, `run_at`, `students` y `checks` |

`plan.check_count` es el denominador y no se mueve: ni una avería, ni una
cancelación, ni un alumno roto lo cambian (ADR-0004). Un reintento tampoco: en
él siguen llegando `check.end` de todas las comprobaciones del PLAN, y las que
no se repiten llegan `UNEVALUATED` con causa `NOT_RUN`, así que
`expected_checks` sigue siendo exacto y la barra no miente.

### `student.start`

Un trabajador ha cogido a un alumno. `student_id`, `name`.

### `check.end`

Una comprobación terminada. Los dos ejes del modelo, separados:

| Campo | Qué es |
|---|---|
| `student_id`, `check_id`, `group`, `weight` | De quién y de qué |
| `status` | `PASS` \| `FAIL` \| `UNEVALUATED` |
| `cause` | Causa técnica. `NONE` siempre que `status` no sea `UNEVALUATED` |
| `detail` | Una frase para el profesor. Nunca una traza |
| `duration_ms` | Duración del comando; `null` si no se llegó a ejecutar |

No lleva `stdout`, ni `stderr`, ni la aserción. Eso está en el artefacto.

### `student.end`

| Campo | Qué es |
|---|---|
| `student_id`, `status` | `OK` \| `PARTIAL` \| `NOT_EVALUATED` \| `EXCLUDED` |
| `score` | El objeto `Score` completo, igual que en el artefacto |

Quien lea `provisional_score` o `final_score` sin mirar `score.status` lo está
haciendo mal: mientras quede algo sin evaluar, `final_score` es `null` y no un
cero (ADR-0006).

### `run.end`

Última línea. Una GUI que no la vea debe dar la ejecución por **inacabada**,
haga lo que haga el proceso.

| Campo | Qué es |
|---|---|
| `status` | `COMPLETE` \| `PARTIAL` \| `CANCELLED` \| `INVALID_CONFIG` |
| `exit_code` | El mismo con el que sale el proceso |
| `artifact` | Ruta del artefacto canónico. Vacía solo si no se pudo escribir |
| `counts` | `students`, `pass`, `fail`, `unevaluated` |
| `warnings` | Los avisos de la ejecución |

## 5. Compatibilidad

`contract_version` sube **solo** si un campo cambia de significado o
desaparece. Añadir un campo o un evento nuevo no la mueve, así que un
consumidor debe **ignorar lo que no conozca** en lugar de fallar.

Un PLAN inválido no abre el flujo: el proceso sale con 2 y escribe el error en
`stderr`, con fichero y línea, antes de tocar ninguna máquina.

## 6. Ejemplo

Prototipo de dos alumnos, uno correcto y uno con la máquina apagada, recortado:

```jsonl
{"event":"run.start","seq":1,"ts":"…","contract_version":1,"run_id":"01M2Z…","plan":{"check_count":5,"total_weight":6,…},"expected_checks":10,"students":[…]}
{"event":"student.start","seq":2,"ts":"…","student_id":"alumne01","name":"Alumna Uno"}
{"event":"check.end","seq":4,"ts":"…","student_id":"alumne01","check_id":"p1-hostname","weight":1,"status":"PASS","cause":"NONE","duration_ms":6}
{"event":"check.end","seq":8,"ts":"…","student_id":"alumne01","check_id":"p5-lento","weight":1,"status":"UNEVALUATED","cause":"TIMEOUT","detail":"el comando no terminó en 3s y se ha matado en la máquina del alumno","duration_ms":3005}
{"event":"student.end","seq":9,"ts":"…","student_id":"alumne01","status":"PARTIAL","score":{"obtained":4,"evaluable":5,"total":6,"unevaluated":1,"provisional_score":80,"final_score":null,"status":"INCOMPLETE"}}
{"event":"check.end","seq":10,"ts":"…","student_id":"alumne02","check_id":"p1-hostname","weight":1,"status":"UNEVALUATED","cause":"CONNECT_FAILED","detail":"no se ha podido conectar con 127.1.2.3:2299 tras 3 intentos","duration_ms":null}
{"event":"student.end","seq":15,"ts":"…","student_id":"alumne02","status":"NOT_EVALUATED","score":{"obtained":0,"evaluable":0,"total":6,"unevaluated":6,"provisional_score":null,"final_score":null,"status":"NOT_EVALUATED"}}
{"event":"run.end","seq":16,"ts":"…","status":"PARTIAL","exit_code":3,"artifact":"var/run-01M2Z….json","counts":{"students":2,"pass":3,"fail":1,"unevaluated":6},"warnings":[…]}
```

Alumne02 no saca un cero: sale **sin evaluar**, con la causa dicha.

## 7. La consolidación de una cadena

Aparte del flujo y del artefacto, el motor publica una tercera cosa que la GUI
lee: la **consolidación** de una cadena de correcciones (ADR-0019).

```
heimdall consolidate <resultado.json>
```

Lee la cadena hacia atrás siguiendo `retry_of`, la escribe por `stdout` y no
toca ningún fichero. Sale con `0` si en toda la cadena no queda nada por
evaluar, `3` si queda algo y `2` si la cadena no es válida —otro `plan_hash`,
un eslabón que no está—, con el motivo en `stderr`.

Lo que imprime lleva `kind: "consolidation"` y su propia versión,
`consolidation_version`, distinta de la del artefacto: **no es una ejecución y
no puede leerse como tal**. Cada comprobación dice de qué ejecución sale
(`from_run`) y qué intentos hubo antes (`attempts`). No lleva comandos ni
salida de las máquinas: eso sigue en el artefacto de la ejecución que los
produjo.

La nota consolidada la calcula el motor con la misma función que la de una
ejecución suelta. La GUI la enseña; no la suma.

## 8. La sesión de examen

La cuarta cosa que el motor publica es la **sesión de examen** (ADR-0020): las
vueltas de una misma práctica leídas como una sola.

```
heimdall session <vuelta1.json> <vuelta2.json> …
```

Las vueltas se dan **de la más antigua a la más reciente**, en el orden en que
se corrieron: el motor no las reordena, porque «de qué vuelta sale la nota»
dejaría de ser cierto si lo hiciera. Escribe por `stdout` y no toca ningún
fichero. Sale con `0` si todos los alumnos de la sesión tienen ya una nota
cerrada, `3` si alguno todavía no, y `2` si las vueltas no forman sesión —otro
`plan_hash`, un fichero que no se puede leer, la misma vuelta dos veces—, con
el motivo en `stderr`.

Lo que imprime lleva `kind: "session"` y su propia versión, `session_version`.
**No es una consolidación y no se pide por `consolidate`**: una cadena de
reintento vale por lo más reciente y una sesión por la mejor vuelta completa,
y mezclarlas pondría la nota equivocada. De cada alumno dice la nota que vale,
de qué vuelta sale (`from_round`, `from_run_id`), si está `FINISHED` y qué dijo
cada vuelta (`rounds`, con `counts` en la que manda). No lleva comandos ni
salida de las máquinas: eso sigue en el artefacto de cada vuelta.

### La vuelta siguiente

```
heimdall run --session=<vuelta1.json> --session=<vuelta2.json> … <examen>
```

`--session` se repite una vez por vuelta, en el mismo orden, y deja fuera de
esta vuelta a los alumnos que la sesión ya dio por **terminados**: no se abre
ni una conexión contra su máquina. Salen en el artefacto con `status:
"EXCLUDED"` y un `reason` que dice por qué y de qué vuelta viene su nota;
nunca como un cero ni como sin evaluar.

Lo que **no** cambia es el PLAN: `check_ids`, pesos, `total_weight` y
`plan_hash` son los mismos que en las demás vueltas. Dejar a alguien fuera es
una decisión de ejecución, no de nota. `--session` no se combina con `--retry`
—son las dos reglas distintas— ni con la fachada congelada.

## 9. Cómo se verifica

[`test/eventos.sh`](../../test/eventos.sh) es el consumidor de prueba: lee una
ejecución entera del laboratorio con nada más que el flujo y el artefacto al
que apunta, y comprueba E-1 a E-10 con `jq`. Entre ellos, que el flujo y el
artefacto digan exactamente lo mismo comprobación a comprobación, que no
aparezca ninguna contraseña, que ninguna línea se desborde y que una ejecución
cancelada cierre el flujo.

[`test/sesion.sh`](../../test/sesion.sh) hace lo propio con la sesión: corre
dos vueltas seguidas contra el laboratorio con un alumno que llega al examen
entero y comprueba S-1 a S-8, entre ellos que la segunda vuelta no deja ni una
línea nueva en el registro de `sshd` de su máquina y que su nota de sesión
sigue siendo la de la vuelta en que la sacó.

El esquema no se puede desincronizar de los tipos en silencio: los tests de
`internal/report` lo recorren campo a campo contra el modelo.
