# `LegacyTeutonWriter` — capa temporal eliminable

> **CAPA TEMPORAL.** Existe para validar el motor nuevo contra la UAT de Teuton
> GUI (40 escenarios) sin tocar la GUI. Se borra entera —paquete, tests y
> bandera— cuando la GUI consuma el artefacto canónico. No se le añade ninguna
> funcionalidad que no exija esa UAT.

Dirección **única**:

```
RunResult canónico  ──►  resume.json + case-NN.json + moodle.csv
```

Nunca al revés. El escritor no lee ficheros de Teuton, no los interpreta y no
influye en el cálculo de la nota: recibe un `RunResult` ya cerrado.

---

## 1. Ubicación y activación

- Paquete `internal/legacy` (bajo `internal/`, para que no pueda ser importado
  desde fuera del módulo).
- Se activa con `--compat=teuton2`. Sin la bandera no escribe nada.
- Escribe en `var/<testname>/`, que es donde `main/results.ts` de la GUI mira
  (C5).
- El artefacto canónico **se escribe siempre**, con o sin la bandera.

## 2. Superficie que hay que imitar

De los 11 puntos de acoplamiento de `GUI-CONTRACT.md`, el escritor cubre los de
datos; los tres de CLI los cubre una fachada mínima en el mismo paquete:

| Punto | Qué hace la capa |
|---|---|
| C1 `teuton version` | `evalon --compat=teuton2 version` imprime `Teuton version 2.10.6 (evalon <ver>)`. Case con `/version\s+([\d.]+)/i` y con `looksLikeTeuton` |
| C2 `teuton check` | Ejecuta el PLAN sin tocar máquinas e imprime la tabla «DSL Stats» con `\| Targets \| N \|`. Con PLAN declarativo **N es exacto**, no una estimación (arregla `c14-check`) |
| C3 `run --export=json --cname --case` | Banderas aceptadas; `--case=1,3` selecciona alumnos por posición |
| C4 progreso | Imprime `Started at …`, un carácter por comprobación (`.` PASS, `F` FAIL **y** UNEVALUATED, `S` alumno excluido), y `Finished in …`. Es lo que `scanProgressChunk` cuenta |
| C6 `resume.json` | Ver §3 |
| C7 `case-NN.json` | Ver §4 |
| C8 `moodle.csv` | CSV con librería de verdad y prefijo defensivo contra fórmulas (F-14) |
| C9 otros formatos | **No se implementa.** La GUI lo ofrece bajo demanda; en compat devuelve error explícito |
| C5 ubicación | `tt_outdir` o `var/<testname>` |
| C10/C11 formato de entrada | No aplican: el proyecto nuevo usa `examen.yaml`/`aula.yaml` |

## 3. `resume.json`

```
cases[].id           índice 1-based, "01", "02", … en el orden del PLAN
cases[].members      StudentResult.Name
cases[].moodle_id    StudentResult.MoodleID
cases[].skip         Status == EXCLUDED
cases[].grade        ver la regla de abajo
cases[].letter       "✓" si grade == 100 · "?" si 0 < grade < 50 · "✗" si grade == 0
cases[].conn_status  { "<host>": "<etiqueta legacy>" } por cada host con avería
config               SOLO claves no sensibles: tt_testname, tt_title, tt_sequence
results              start_time, finish_time, duration
hall_of_fame         {} siempre
```

### La regla de la nota, que es la decisión delicada

| Score.Status canónico | `grade` legacy | `conn_status` |
|---|---|---|
| `COMPLETE` | `final_score` | `{}` |
| `INCOMPLETE` | **0** | se rellena con la causa dominante |
| `NOT_EVALUATED` | **0** | se rellena |
| `EXCLUDED` | 0, `skip: true` | `{}` |

Se escribe **0 y no `provisional_score`** para un `INCOMPLETE` a propósito: la
GUI actual infiere «no evaluado» con `connErrors > 0 && grade === 0`
(`GUI-CONTRACT.md` §2). Emitir 0 + `conn_status` es lo único que hace que la GUI
existente **no publique una nota incompleta como si fuera final**. Es feo, es
deliberado, y desaparece con la capa.

Mapeo de causas a etiquetas que la GUI ya conoce:

| Cause | etiqueta legacy |
|---|---|
| `AUTH_FAILED` | `error_authentication_failed` |
| `CONNECT_FAILED` | `host_unreachable` |
| `CONNECTION_LOST`, `TIMEOUT`, `NOT_RUN`, `CANCELLED`, `ENGINE_ERROR` | `error` |

## 4. `case-NN.json`

```
config    tt_members, tt_moodle_id, tt_testname, tt_skip, host1_ip …  SIN credenciales
logs      []  (vacío: los logs de Teuton llevaban ANSI crudo y secretos)
groups[]  { title, targets[] }
results   { case_id, start_time, finish_time, duration,
            max_weight, good_weight, fail_weight, fail_counter, unique_fault: 0, grade }
```

Cada `CheckResult` se proyecta a un target legacy:

| Campo legacy | Origen |
|---|---|
| `target_id` | índice 1-based con dos dígitos |
| `description` | `Description` |
| `weight` | `Weight` |
| `check` | `Status == PASS` — **`FAIL` y `UNEVALUATED` dan los dos `false`** |
| `score` | `Weight` si PASS, si no 0 |
| `conn_type` | `"ssh"` o `"local"` (el transporte `inventory` se proyecta como `local`) |
| `duration` | `DurationMS / 1000` |
| `command` | `strings.Join(Command, " ")`, ya saneado |
| `output` | primera línea de stdout, o `"(N lines)"`, o el centinela `TEUTON_ERROR_SSH*` si `UNEVALUATED` |
| `expected` | texto legible de la aserción |
| `result` | número de coincidencias, o el centinela |
| `alterations` | `"find(<esperado>) & count"` |

`max_weight` legacy se toma del **PLAN**, no de las comprobaciones registradas.
Es la única forma de que el denominador legacy no encoja (F-02) — y ya es una
mejora sobre Teuton, aceptable porque la GUI solo lee el número.

## 5. Información que se pierde al convertir (lista completa)

Esto es lo que justifica que la capa sea temporal:

| Se pierde | Consecuencia práctica |
|---|---|
| **`UNEVALUATED`** | Se aplana a `check: false`, indistinguible de un suspenso dentro del `case-NN.json`. Solo se rescata a nivel de alumno vía `conn_status` + `grade: 0` |
| **La causa por comprobación** | El `conn_status` es por alumno y por host, y solo lleva la causa dominante. Un alumno con una comprobación en `TIMEOUT` y otra en `AUTH_FAILED` sale con una sola etiqueta |
| **`provisional_score`** | No hay campo. Un `INCOMPLETE` sale como 0 |
| **La distinción INCOMPLETE vs alumno que no hizo nada** | Solo se distinguen si hubo error de conexión. Un `TIMEOUT` sin error de conexión sale como 0 sin `conn_status` → indistinguible. **Es la pérdida más grave, y por eso el escritor rellena `conn_status` también para `TIMEOUT`** |
| **stdout y stderr completos** | El legacy solo tiene `output`; stderr se descarta |
| **`truncated` / `bytes_total`** | Sin campo |
| **`remote_process`** | Sin campo. Un posible proceso huérfano no se ve |
| **`connect_attempts`** | Sin campo |
| **hashes de examen e inventario, `run_id`** | Sin campo: un `resume.json` no es auditable meses después |
| **`warnings`** | Sin campo |
| **Pesos con decimales, peso 0** | Se conservan, pero la GUI no los muestra bien |

Norma: **un dato que solo exista en el formato legacy no existe.** Si la GUI
necesita algo, se añade al canónico y se proyecta.

## 6. Cómo se valida, y cuándo se borra

1. Ejecutar el motor con `--compat=teuton2` sobre un proyecto equivalente a
   `tests/fixtures/teuton-2.10.6/` y comparar los ficheros generados campo a
   campo con los de Teuton real (test de golden files en Go).
2. Apuntar la GUI al binario nuevo y pasar los **40 escenarios e2e** sin tocar
   una línea de la GUI (recordar `npm run build` antes: si no, fallan las 40 por
   una causa que no se explica).
3. Con la UAT en verde, empezar a sustituir C4 por NDJSON y C6/C7 por el
   canónico, borrando el andamio de `GUI-CONTRACT.md` §3 módulo a módulo.
4. **Criterio de borrado**: cuando ningún test de la GUI lea `resume.json` ni
   `case-NN.json`, se elimina `internal/legacy` entero en un solo commit.
