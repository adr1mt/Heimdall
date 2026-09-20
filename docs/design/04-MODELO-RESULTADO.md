# Modelo canónico de resultados

Único formato de verdad del motor: **`run-<id>.json`**. Todo lo demás (NDJSON,
GUI, Moodle, HTML, el escritor legacy) **deriva** de él. Nada escribe hacia
atrás.

Los nombres de campo van en **inglés**: es un contrato de máquina, se mapea 1:1
a las estructuras Go y lo consumen la GUI y los tests.

---

## 1. Las cuatro capas

La separación es estricta y se ve en los tipos: cada capa solo puede leer la
anterior.

```
ExecutionResult     qué pasó con el proceso          (técnico, sin juicio)
        ↓
AssertionResult     qué decía la aserción sobre eso  (comparación, sin nota)
        ↓
CheckResult         PASS | FAIL | UNEVALUATED        (académico)
        ↓
Score               obtained / evaluable / total     (puntuación)
```

Consecuencia de diseño: **`AssertionResult` solo existe si `ExecutionResult`
está completo**, y `Score` solo mira `CheckResult.status` y `weight`. Un error
técnico no puede llegar a la nota porque no tiene camino para hacerlo.

---

## 2. Estructuras

```go
// RunResult es el artefacto completo de una ejecución. Se escribe una vez,
// atómicamente, y nunca se modifica.
type RunResult struct {
    SchemaVersion int    `json:"schema_version"` // 1
    RunID         string `json:"run_id"`         // ULID, ordenable por tiempo
    EngineVersion string `json:"engine_version"`

    StartedAt  time.Time `json:"started_at"`  // RFC3339 con zona
    FinishedAt time.Time `json:"finished_at"`
    Status     RunStatus `json:"status"`      // COMPLETE|PARTIAL|CANCELLED|INVALID_CONFIG

    Exam      SourceRef `json:"exam"`
    Inventory SourceRef `json:"inventory"`
    PlanHash  string    `json:"plan_hash"`   // sha256 del PLAN resuelto

    Plan     PlanSummary     `json:"plan"`
    Students []StudentResult `json:"students"`
    Warnings []Warning       `json:"warnings,omitempty"`
}

// SourceRef identifica el fichero de entrada tal como estaba al ejecutar.
type SourceRef struct {
    Path    string `json:"path"`
    SHA256  string `json:"sha256"`
    Version string `json:"version,omitempty"` // el campo `version:` del YAML
}

// PlanSummary es lo que el PLAN fijó antes de tocar ninguna máquina.
type PlanSummary struct {
    CheckCount  int      `json:"check_count"`
    TotalWeight float64  `json:"total_weight"`
    CheckIDs    []string `json:"check_ids"`  // en orden; idéntico para todos
    Concurrency int      `json:"concurrency"`
}

type StudentResult struct {
    StudentID string        `json:"student_id"`
    Name      string        `json:"name"`
    MoodleID  string        `json:"moodle_id,omitempty"`
    Status    StudentStatus `json:"status"` // OK|PARTIAL|NOT_EVALUATED|EXCLUDED

    StartedAt  time.Time `json:"started_at"`
    FinishedAt time.Time `json:"finished_at"`

    Score  Score         `json:"score"`
    Checks []CheckResult `json:"checks"`
}

type Score struct {
    Obtained    float64  `json:"obtained"`
    Evaluable   float64  `json:"evaluable"`
    Total       float64  `json:"total"`
    Unevaluated float64  `json:"unevaluated"`
    Provisional *int     `json:"provisional_score"` // null si evaluable == 0
    Final       *int     `json:"final_score"`       // null si unevaluated > 0
    Status      ScoreStatus `json:"status"`         // COMPLETE|INCOMPLETE|NOT_EVALUATED|EXCLUDED
}

type CheckResult struct {
    CheckID     string  `json:"check_id"`
    Group       string  `json:"group"`
    Description string  `json:"description"`
    Weight      float64 `json:"weight"`

    Status AcademicStatus `json:"status"` // PASS|FAIL|UNEVALUATED
    Cause  Cause          `json:"cause"`  // NONE cuando PASS o FAIL
    Detail string         `json:"detail,omitempty"`

    Execution *ExecutionResult `json:"execution"` // null si nunca se lanzó
    Assertion *AssertionResult `json:"assertion"` // null si no hubo ejecución completa
}

// ExecutionResult: hechos del proceso. No sabe nada de notas.
type ExecutionResult struct {
    Host       string   `json:"host"`        // "host1"
    Address    string   `json:"address"`     // "192.168.1.20:22"
    User       string   `json:"user"`
    Transport  string   `json:"transport"`   // "ssh" | "inventory"
    Command    []string `json:"command"`     // vector, ya sustituido y saneado

    StartedAt  time.Time `json:"started_at"`
    DurationMS int64     `json:"duration_ms"`

    Completed bool  `json:"completed"`  // se recibió exit status y EOF en ambos flujos
    ExitCode  *int  `json:"exit_code"`  // null si !Completed

    Stdout    Stream `json:"stdout"`
    Stderr    Stream `json:"stderr"`

    ConnectAttempts int                `json:"connect_attempts"` // 1 = sin reintento
    CommandAttempts int                `json:"command_attempts"` // siempre 1 en el MVP
    RemoteProcess   RemoteProcessState `json:"remote_process"`   // FINISHED|KILLED_REMOTE|UNKNOWN
}

type Stream struct {
    Text       string `json:"text"`        // hasta el límite, UTF-8 válido
    Bytes      int64  `json:"bytes"`       // bytes conservados
    BytesTotal int64  `json:"bytes_total"` // bytes que produjo el comando
    Truncated  bool   `json:"truncated"`
}

// AssertionResult: qué se comparó y qué se encontró. Sin nota.
type AssertionResult struct {
    Kind     string `json:"kind"`     // contains|equals|not_contains|exit_code|near
    Expected string `json:"expected"` // ya sustituido
    Found    string `json:"found"`    // el fragmento encontrado, o ""
    Matched  bool   `json:"matched"`
    Where    string `json:"where,omitempty"` // "stdout línea 12"
}

type Warning struct {
    Scope   string `json:"scope"`   // "run" | "student:alumne02" | "check:kea-subnet"
    Code    string `json:"code"`    // "REMOTE_TIMEOUT_UNAVAILABLE", "OUTPUT_TRUNCATED", …
    Message string `json:"message"`
}
```

### Por qué cada campo de auditoría está (y qué se ha dejado fuera)

| Campo | Para qué sirve meses después |
|---|---|
| `run_id`, `started_at` | Identificar la pasada concreta que generó la nota |
| `engine_version` | Saber si la nota salió de una versión con un bug conocido |
| `exam.sha256`, `inventory.sha256`, `plan_hash` | Demostrar **qué examen exacto** se aplicó. Si dos alumnos tienen hashes distintos, se ve |
| `plan.check_ids`, `total_weight` | Reconstruir el denominador sin releer el YAML |
| `check_id`, `group`, `weight` | Explicar el desglose de la nota |
| `command` saneado, `address`, `user` | Reproducir la comprobación a mano |
| `exit_code`, `stdout`, `stderr` | Ver **por qué** falló, que es lo que hoy no se guarda |
| `truncated`, `bytes_total` | Saber que lo que se ve no es todo |
| `duration_ms`, `connect_attempts` | Distinguir «lento» de «roto»; reintento auditado |
| `status`, `cause`, `detail` | La respuesta a «¿por qué esto no cuenta?» |
| `remote_process` | No ocultar que pudo quedar un proceso vivo en la máquina del alumno |

Se han descartado a propósito: el volcado del inventario completo (fuga de
`SECURITY.md` §1), la duplicación de la nota en cada capa, cualquier campo
polimórfico como el `result` de Teuton, y las trazas de pila.

---

## 3. Ejemplo real del JSON

Salida **literal** del motor contra el laboratorio (`testdata/proto`, dos
alumnos, cinco comprobaciones, peso total 6). No está redactada a mano: el
fichero completo es [ejemplo-run.json](ejemplo-run.json), producido con

```bash
make lab && make build
printf '%s\n' '{"schema":1,"secrets":{"AULA_PASSWORD":"…"}}' \
  | bin/evalon run --secrets=stdin --var=var testdata/proto
```

Aquí se recortan tres comprobaciones repetidas de `alumne01` y cuatro de
`alumne02`, todas iguales a las que sí aparecen. Lo demás va tal cual, byte a
byte.

```json
{
  "schema_version": 1,
  "run_id": "01M2YTEGR42NJ6MT979TMVGG2N",
  "engine_version": "0.1.0-dev",
  "started_at": "2026-09-20T09:10:50.628934586+02:00",
  "finished_at": "2026-09-20T09:10:55.082942227+02:00",
  "status": "PARTIAL",
  "exam": {
    "path": "testdata/proto/examen.yaml",
    "sha256": "c8006a47fd6aaf125ac5b0c4cef86d478338ccea8b82d1edb203cba61e0eabfe",
    "version": "1"
  },
  "inventory": {
    "path": "testdata/proto/aula.yaml",
    "sha256": "48b3487518eff30eb97904aef28e6ca48b507d11175956af7336a035038d79ea",
    "version": "1"
  },
  "plan_hash": "55907d52e95d596a8253e388ec432d5a75315118252a5fdc34060e157c53cc35",
  "plan": {
    "check_count": 5,
    "total_weight": 6,
    "check_ids": [
      "p1-hostname",
      "p2-usuario",
      "p3-fichero",
      "p4-ausente",
      "p5-lento"
    ],
    "concurrency": 2
  },
  "students": [
    {
      "student_id": "alumne01",
      "name": "Alumna Uno",
      "status": "PARTIAL",
      "started_at": "2026-09-20T09:10:50.628957577+02:00",
      "finished_at": "2026-09-20T09:10:53.740278473+02:00",
      "score": {
        "obtained": 4,
        "evaluable": 5,
        "total": 6,
        "unevaluated": 1,
        "provisional_score": 80,
        "final_score": null,
        "status": "INCOMPLETE"
      },
      "checks": [
        {
          "check_id": "p1-hostname",
          "group": "Base",
          "description": "El host responde y se identifica",
          "weight": 1,
          "status": "PASS",
          "cause": "NONE",
          "execution": {
            "host": "host1",
            "address": "127.1.2.3:2201",
            "user": "alumno",
            "transport": "ssh",
            "command": [
              "hostname"
            ],
            "started_at": "2026-09-20T09:10:50.726005482+02:00",
            "duration_ms": 2,
            "completed": true,
            "exit_code": 0,
            "stdout": {
              "text": "alu1\n",
              "bytes": 5,
              "bytes_total": 5,
              "truncated": false
            },
            "stderr": {
              "text": "",
              "bytes": 0,
              "bytes_total": 0,
              "truncated": false
            },
            "connect_attempts": 1,
            "command_attempts": 1,
            "remote_process": "FINISHED"
          },
          "assertion": {
            "kind": "contains",
            "expected": "alu",
            "found": "alu",
            "matched": true,
            "where": "stdout línea 1"
          }
        },
        {
          "check_id": "p4-ausente",
          "group": "Base",
          "description": "Un comando que no existe suspende, no avería",
          "weight": 1,
          "status": "FAIL",
          "cause": "NONE",
          "execution": {
            "host": "host1",
            "address": "127.1.2.3:2201",
            "user": "alumno",
            "transport": "ssh",
            "command": [
              "comando_que_no_existe"
            ],
            "started_at": "2026-09-20T09:10:50.734366468+02:00",
            "duration_ms": 2,
            "completed": true,
            "exit_code": 127,
            "stdout": {
              "text": "",
              "bytes": 0,
              "bytes_total": 0,
              "truncated": false
            },
            "stderr": {
              "text": "timeout: failed to run command 'comando_que_no_existe': No such file or directory\n",
              "bytes": 82,
              "bytes_total": 82,
              "truncated": false
            },
            "connect_attempts": 1,
            "command_attempts": 1,
            "remote_process": "FINISHED"
          },
          "assertion": {
            "kind": "exit_code",
            "expected": "0",
            "found": "127",
            "matched": false
          }
        },
        {
          "check_id": "p5-lento",
          "group": "Base",
          "description": "Comprobación con timeout corto",
          "weight": 1,
          "status": "UNEVALUATED",
          "cause": "TIMEOUT",
          "detail": "el comando no terminó en 3s y se ha matado en la máquina del alumno",
          "execution": {
            "host": "host1",
            "address": "127.1.2.3:2201",
            "user": "alumno",
            "transport": "ssh",
            "command": [
              "sleep",
              "30"
            ],
            "started_at": "2026-09-20T09:10:50.73682791+02:00",
            "duration_ms": 3003,
            "completed": false,
            "exit_code": null,
            "stdout": {
              "text": "",
              "bytes": 0,
              "bytes_total": 0,
              "truncated": false
            },
            "stderr": {
              "text": "",
              "bytes": 0,
              "bytes_total": 0,
              "truncated": false
            },
            "connect_attempts": 1,
            "command_attempts": 1,
            "remote_process": "KILLED_REMOTE"
          },
          "assertion": null
        }
      ]
    },
    {
      "student_id": "alumne02",
      "name": "Alumne Dos",
      "status": "NOT_EVALUATED",
      "started_at": "2026-09-20T09:10:50.629068607+02:00",
      "finished_at": "2026-09-20T09:10:55.075978385+02:00",
      "score": {
        "obtained": 0,
        "evaluable": 0,
        "total": 6,
        "unevaluated": 6,
        "provisional_score": null,
        "final_score": null,
        "status": "NOT_EVALUATED"
      },
      "checks": [
        {
          "check_id": "p1-hostname",
          "group": "Base",
          "description": "El host responde y se identifica",
          "weight": 1,
          "status": "UNEVALUATED",
          "cause": "CONNECT_FAILED",
          "detail": "no se ha podido conectar con 127.1.2.3:2299 tras 3 intentos: dial tcp 127.1.2.3:2299: connect: connection refused",
          "execution": null,
          "assertion": null
        }
      ]
    }
  ],
  "warnings": [
    {
      "scope": "student:alumne01/host:host1",
      "code": "HOST_KEY_ACCEPTED",
      "message": "la identidad de 127.1.2.3:2201 se ha aceptado y anotado para esta ejecución: SHA256:EXIozDOCqGTYwDEDQt84k0c490R7Xg7Vx6/ETJK0MiE"
    }
  ]
}
```

`alumne01` tiene cuatro comprobaciones evaluadas de cinco: la lenta se cortó a
su timeout y salió `UNEVALUATED`. Su nota provisional es 80 y la final es
`null`: el motor **se niega** a convertir en nota un examen incompleto.

`alumne02` no llegó a encender: las cinco comprobaciones salen `UNEVALUATED`
por `CONNECT_FAILED`, con `evaluable: 0` y `unevaluated: 6` —los seis puntos
del peso total—, y ninguna de las dos notas existe. El denominador, la lista de
comprobaciones y los pesos son idénticos a los de `alumne01`: el PLAN no se
movió por una máquina apagada.

El aviso final anota la identidad de la máquina que sí respondió, con su huella
(ADR-0011). Es lo que permite comprobar después contra qué máquina se corrigió.

---

## 4. Reglas del artefacto

1. **Un fichero por ejecución**: `<proyecto>/var/run-<run_id>.json`. Nunca se
   sobrescribe, porque el id es único (F-13).
2. **Escritura atómica**: fichero temporal en el mismo directorio + `rename`
   (C-9).
3. **Se escribe siempre**, incluso con cancelación o con todos los alumnos
   rotos. Un PLAN inválido es la única excepción: no hay nada que escribir y el
   error va a stderr con fichero y línea.
4. **Además se escribe al final, no incrementalmente**, pero el motor mantiene
   un **artefacto parcial** en `var/run-<id>.partial.json` que se reescribe
   atómicamente cada vez que un alumno termina. Si el proceso muere, queda
   material útil (contra F-16).
5. `var/latest.json` es un enlace simbólico al último `run-*.json`. Comodidad
   para la CLI; ningún consumidor debe depender de él.
6. **Nunca contiene secretos.** Ver `05-SECRETOS-TIMEOUTS-REINTENTOS.md`.
