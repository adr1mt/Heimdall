# Primer prototipo vertical — especificación exacta

Objetivo: **demostrar la arquitectura**, no las funcionalidades. Si al terminar
hay dudas sobre si el diseño aguanta, el prototipo ha fallado aunque compile.

Tamaño estimado: **600-900 líneas de Go** más tests. Una sesión de trabajo.

---

## 1. Entorno

```bash
podman run -d --name alu1 -p 127.1.2.3:2201:22 teutonlab-ssh
```

`127.1.2.3`, **no** `127.0.0.1`: con `127.0.0.x` el Teuton viejo ejecutaba en
local; el motor nuevo debe conectar por SSH igualmente, y el criterio A-6 lo
comprueba.

El alumno roto apunta a `127.1.2.3:2299`, puerto cerrado. No hace falta un
segundo contenedor.

Go: instalarlo primero (no está en el equipo). Versión mínima **1.22**.

## 2. Estructura del módulo

```
cmd/evalon/main.go            CLI: run, check, version
internal/plan/                lectura y validación de YAML, resolución del PLAN
internal/model/               RunResult y tipos (04-MODELO-RESULTADO.md)
internal/ssh/                 sesión, exec, límites de salida, timeouts
internal/engine/              worker pool, presupuesto por alumno, cancelación
internal/assert/              contains, equals, not_contains, exit_code
internal/report/              escritura atómica del run-<id>.json
internal/legacy/              LegacyTeutonWriter (resume.json + case-NN.json)
testdata/                     examen.yaml, aula.yaml del prototipo
```

Dependencias externas permitidas: `golang.org/x/crypto/ssh`, un parser YAML
(`gopkg.in/yaml.v3`), un generador de ULID. **Ninguna más.**

## 3. Alcance funcional exacto

### Entra

| Pieza | Detalle |
|---|---|
| `examen.yaml` | 5 comprobaciones, 1 grupo, pesos 1/1/2/1/1 (total 6) |
| `aula.yaml` | 2 alumnos: `alumne01` → `127.1.2.3:2201`, `alumne02` → `127.1.2.3:2299` |
| Aserciones | `contiene`, `igual_a`, `exit_code`. **`cerca_de` y `no_contiene` no**, y `valor:` tampoco |
| Sustitución | `${alumno.<campo>}` en argumentos y valores esperados. Solo esa forma |
| PLAN | Valida los 9 puntos de `02-FORMATO.md` §5 y publica `check_count`, `total_weight`, `check_ids`, hashes |
| `check` | Subcomando que ejecuta solo el PLAN y no toca ninguna máquina |
| Transporte | SSH nativo, **una sesión por alumno y host**, reutilizada (K-6) |
| Autenticación | Contraseña, con el secreto por `--secrets=stdin` y por `--secrets=env` |
| `known_hosts` | Fichero propio del proyecto (`var/known_hosts`) con TOFU y aviso en `warnings`. Decisión provisional del prototipo, ver D-3 |
| Timeouts | Conexión 10 s, comprobación 20 s, alumno 2 min (bajo a propósito para poder probarlo) |
| `timeout` remoto | Detección `command -v timeout` y envoltura; `remote_process` en el resultado |
| Reintentos | 2 de conexión con espera; ninguno de comando |
| Concurrencia | Worker pool de 2, un alumno por worker |
| Cancelación | `SIGINT` → `CANCELLED` + artefacto parcial |
| Salida | Límite 64 kB por flujo, corte duro a 8 MB, `truncated` y `bytes_total` |
| Artefacto | `var/run-<ulid>.json` atómico + `var/run-<ulid>.partial.json` reescrito al cerrar cada alumno |
| Legacy | `--compat=teuton2` escribe `resume.json` y `case-01.json`/`case-02.json`. **Sin** fachada CLI (`version`, `check`, progreso), sin `moodle.csv` |
| Exit codes | 0 todo evaluado · 2 config inválida · 3 ejecución parcial · 4 cancelado |

### No entra

NDJSON, HTML, Moodle, SQLite, editor GUI, migrador, Starlark, telnet,
`ProxyJump`, SFTP, monitorización, detección de copias, `--case`, `excluido`,
variantes de examen, `cerca_de`, `valor:`, autenticación por clave, más de un
host lógico, resolución manual de incompletos.

## 4. Flujo que debe quedar visible en el código

```
main → plan.Load(examen, aula) ──(error)──► exit 2, mensaje con fichero y línea
          │
          ▼  Plan inmutable: mismos check_ids y total_weight para los 2 alumnos
       engine.Run(ctx, plan, secrets)
          │   worker pool de 2, un contexto por alumno
          ▼
       ssh.Session por alumno  →  exec por comprobación  →  ExecutionResult
          │
          ▼
       assert.Eval(ExecutionResult, aserción)  →  AssertionResult
          │
          ▼
       model.Classify(...)  →  CheckResult{Status, Cause}
          │
          ▼
       model.ComputeScore(plan, checks)  →  Score
          │
          ▼
       report.WriteAtomic(run-<id>.json)  →  legacy.Write(...) si --compat
```

`model.Classify` y `model.ComputeScore` son **funciones puras**, sin red y sin
disco. Ahí es donde viven los tests que garantizan la integridad de la nota, y
donde se comprueba que un error técnico no tiene camino hacia un `FAIL`.

## 5. `examen.yaml` del prototipo

```yaml
examen: "Prototipo vertical"
version: 1
hosts: [host1]
por_defecto: { peso: 1, timeout: 20s }
grupos:
  - grupo: "Base"
    comprobaciones:
      - id: p1-hostname
        descripcion: "El host responde y se identifica"
        en: host1
        cmd: ["hostname"]
        contiene: "alu"
      - id: p2-usuario
        descripcion: "La cuenta del alumno existe"
        en: host1
        cmd: ["id", "-un"]
        igual_a: "${alumno.usuario}"
      - id: p3-fichero
        descripcion: "Existe /etc/os-release"
        en: host1
        peso: 2
        cmd: ["test", "-f", "/etc/os-release"]
        exit_code: 0
      - id: p4-ausente
        descripcion: "Un comando que no existe suspende, no avería"
        en: host1
        cmd: ["comando_que_no_existe"]
        exit_code: 0
      - id: p5-lento
        descripcion: "Comprobación con timeout corto"
        en: host1
        timeout: 3s
        cmd: ["sleep", "30"]
        exit_code: 0
```

`p4` es deliberada: debe salir **`FAIL`**, no `UNEVALUATED` (exit 127 del
servidor del alumno). `p5` es deliberada: debe salir `UNEVALUATED`/`TIMEOUT` con
`remote_process: KILLED_REMOTE`.

Total: 6. Para los dos alumnos.

---

## 6. Criterios de aceptación (automatizables)

Un script `test/acceptance.sh` y tests en Go. Cada criterio se comprueba con
`jq` sobre el artefacto o con un test unitario; nada «a ojo».

| # | Criterio | Comprobación exacta |
|---|---|---|
| **A-1** | Mismo PLAN para los dos alumnos | `jq '[.students[].checks \| length] \| unique'` = `[5]`; `jq '[.students[].score.total] \| unique'` = `[6]`; `jq '[.students[].checks[].check_id] ...'` produce la misma secuencia ordenada para ambos |
| **A-2** | Un fallo técnico nunca es `FAIL` | `jq '[.students[].checks[] \| select(.cause != "NONE") \| .status] \| unique'` ⊆ `["UNEVALUATED"]`. Y test unitario de `Classify`: para cada causa ≠ NONE, el estado es `UNEVALUATED` (tabla exhaustiva) |
| **A-3** | Incompleto ⇒ sin nota final | `jq '[.students[] \| select(.score.unevaluated > 0) \| .score.final_score] \| unique'` = `[null]`; y `status == "INCOMPLETE"`. Test unitario: `ComputeScore` con cualquier `unevaluated > 0` devuelve `Final == nil` |
| **A-4** | Aislamiento entre alumnos | `alumne01` tiene ≥ 3 comprobaciones con `cause == "NONE"` mientras `alumne02` está entero en `CONNECT_FAILED`; el artefacto contiene **los dos**; exit code 3 (parcial), no 1 |
| **A-5** | Nada bloquea el run | El run completo termina en < 90 s medido con `/usr/bin/time`, con `p5-lento` (`sleep 30`, timeout 3 s) y un host inalcanzable dentro. `p5` sale `TIMEOUT` con `duration_ms` entre 3000 y 4000 |
| **A-6** | Límite de memoria de la salida | Comprobación extra `["head","-c","300000000","/dev/zero"]` en un examen de prueba: `truncated == true`, `bytes` ≤ 65536, `bytes_total` > 65536, y RSS del proceso < 100 MB con `/usr/bin/time -v` |
| **A-7** | Ningún secreto en ninguna parte | `grep -R 'EVALON_SECRET_PROTO' var/ salida.log` = 0 coincidencias, con la contraseña pasada por stdin; y `grep EVALON_SECRET_PROTO /proc/<pid>/cmdline` = 0 durante la ejecución (comprobado con el proceso vivo) |
| **A-8** | El JSON explica cada resultado | Para **toda** comprobación: si `status != "UNEVALUATED"` entonces `assertion != null` y `execution.exit_code != null`; si `status == "UNEVALUATED"` entonces `cause != "NONE"` y `detail != ""`. Un solo `jq` que debe devolver 0 incumplimientos |
| **A-9** | Artefacto parcial útil | Matar el proceso con `SIGKILL` a mitad: existe `var/run-<id>.partial.json`, es JSON válido y contiene al menos un alumno completo |
| **A-10** | Legacy suficiente para arrancar la UAT | `resume.json` y `case-01.json` validan contra el esquema que `main/results.ts` parsea (test en Go con los mismos campos), `alumne02` sale con `grade: 0` **y** `conn_status` no vacío, y `case-01.json` trae `max_weight == 6` |
| **A-11** | Host `127.1.2.3` va por SSH | `jq '.students[0].checks[0].execution.transport'` = `"ssh"`, y `p1-hostname` devuelve el hostname del **contenedor**, no el del equipo del profesor |
| **A-12** | La nota no depende del idioma | El mismo run bajo `LANG=es_ES.UTF-8` y bajo `LC_ALL=C` produce `score` idéntico (comparación `jq` de los dos artefactos, ignorando ids y tiempos) |
| **A-13** | Un YAML mal escrito no ejecuta nada | Con una clave desconocida: exit 2, mensaje con fichero y línea, **ningún** fichero en `var/`, y ninguna conexión SSH (se comprueba con `ss` o con el log del contenedor) |
| **A-14** | `FAIL` técnico-aparente pero académico | `p4-ausente` sale `FAIL` con `cause: "NONE"` y `exit_code: 127` |

A-1, A-2, A-3, A-8 y A-14 son los que protegen la integridad de la nota. Si
alguno de esos cinco falla, no se sigue adelante con nada más.

## 7. Qué se entrega al final de la siguiente sesión

1. El módulo Go que compila y pasa `go vet` y `go test ./...`.
2. `test/acceptance.sh` con los 14 criterios, y su salida real pegada en el
   HANDOFF.
3. Un `var/run-<id>.json` real del laboratorio, guardado en `docs/design/` como
   ejemplo verificado (sustituyendo al ejemplo redactado a mano de
   `04-MODELO-RESULTADO.md`).
4. Las mediciones de `PERFORMANCE.md` §6 que ya se puedan hacer con 2 alumnos:
   RSS con salida grande y tiempo hasta el artefacto.
