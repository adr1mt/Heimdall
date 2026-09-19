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

## 3. Ejemplo realista del JSON

Dos alumnos, cuatro comprobaciones, uno con avería a mitad. Abreviado en las
partes repetitivas, completo en las interesantes.

```json
{
  "schema_version": 1,
  "run_id": "01K5T9QW3XW4Y8R2N6ZB7MHV0C",
  "engine_version": "0.1.0",
  "started_at": "2026-09-19T11:02:14+02:00",
  "finished_at": "2026-09-19T11:02:41+02:00",
  "status": "PARTIAL",
  "exam":      { "path": "examen.yaml", "sha256": "9f2c…a71b", "version": "3" },
  "inventory": { "path": "aula.yaml",   "sha256": "4d81…0e33", "version": "2" },
  "plan_hash": "c0aa…5512",
  "plan": {
    "check_count": 4,
    "total_weight": 5,
    "check_ids": ["red-ip-servidor", "kea-servicio", "dns-activo", "q-puerto-https"],
    "concurrency": 8
  },
  "students": [
    {
      "student_id": "alumne01",
      "name": "Ana Ferrer",
      "moodle_id": "ana.ferrer@elpuig.xeill.net",
      "status": "OK",
      "started_at": "2026-09-19T11:02:14+02:00",
      "finished_at": "2026-09-19T11:02:19+02:00",
      "score": {
        "obtained": 4, "evaluable": 5, "total": 5, "unevaluated": 0,
        "provisional_score": 80, "final_score": 80, "status": "COMPLETE"
      },
      "checks": [
        {
          "check_id": "red-ip-servidor",
          "group": "Red y DHCP",
          "description": "El servidor tiene 10.0.0.1/8 en enp2s0",
          "weight": 1,
          "status": "PASS",
          "cause": "NONE",
          "execution": {
            "host": "host1", "address": "192.168.1.20:22", "user": "usuario",
            "transport": "ssh",
            "command": ["ip", "address", "show", "dev", "enp2s0"],
            "started_at": "2026-09-19T11:02:15+02:00",
            "duration_ms": 142,
            "completed": true,
            "exit_code": 0,
            "stdout": {
              "text": "2: enp2s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    inet 10.0.0.1/8 scope global enp2s0\n",
              "bytes": 104, "bytes_total": 104, "truncated": false
            },
            "stderr": { "text": "", "bytes": 0, "bytes_total": 0, "truncated": false },
            "connect_attempts": 1, "command_attempts": 1,
            "remote_process": "FINISHED"
          },
          "assertion": {
            "kind": "contains", "expected": "10.0.0.1/8",
            "found": "10.0.0.1/8", "matched": true, "where": "stdout línea 2"
          }
        },
        {
          "check_id": "kea-servicio",
          "group": "Red y DHCP",
          "description": "El servicio kea-dhcp4 está activo",
          "weight": 2,
          "status": "PASS", "cause": "NONE",
          "execution": { "…": "abreviado", "exit_code": 0, "remote_process": "FINISHED" },
          "assertion": { "kind": "equals", "expected": "active", "found": "active", "matched": true }
        },
        {
          "check_id": "dns-activo",
          "group": "DNS",
          "description": "named responde",
          "weight": 1,
          "status": "FAIL", "cause": "NONE",
          "execution": {
            "host": "host1", "address": "192.168.1.20:22", "user": "usuario",
            "transport": "ssh",
            "command": ["dig", "+short", "+time=3", "@127.0.0.1", "pc1.examen.local"],
            "started_at": "2026-09-19T11:02:17+02:00",
            "duration_ms": 3120,
            "completed": true,
            "exit_code": 9,
            "stdout": { "text": "", "bytes": 0, "bytes_total": 0, "truncated": false },
            "stderr": {
              "text": ";; connection timed out; no servers could be reached\n",
              "bytes": 54, "bytes_total": 54, "truncated": false
            },
            "connect_attempts": 1, "command_attempts": 1,
            "remote_process": "FINISHED"
          },
          "assertion": {
            "kind": "equals", "expected": "10.1.1.100", "found": "", "matched": false
          }
        },
        {
          "check_id": "q-puerto-https",
          "group": "Cuestionario",
          "description": "Puerto por defecto de HTTPS",
          "weight": 1,
          "status": "PASS", "cause": "NONE",
          "execution": {
            "host": "", "address": "", "user": "", "transport": "inventory",
            "command": [],
            "started_at": "2026-09-19T11:02:19+02:00",
            "duration_ms": 0,
            "completed": true, "exit_code": 0,
            "stdout": { "text": "443", "bytes": 3, "bytes_total": 3, "truncated": false },
            "stderr": { "text": "", "bytes": 0, "bytes_total": 0, "truncated": false },
            "connect_attempts": 0, "command_attempts": 0,
            "remote_process": "FINISHED"
          },
          "assertion": { "kind": "equals", "expected": "443", "found": "443", "matched": true }
        }
      ]
    },
    {
      "student_id": "alumne02",
      "name": "Marc Oliva",
      "moodle_id": "marc.oliva@elpuig.xeill.net",
      "status": "PARTIAL",
      "started_at": "2026-09-19T11:02:14+02:00",
      "finished_at": "2026-09-19T11:02:41+02:00",
      "score": {
        "obtained": 1, "evaluable": 1, "total": 5, "unevaluated": 4,
        "provisional_score": 100, "final_score": null, "status": "INCOMPLETE"
      },
      "checks": [
        {
          "check_id": "red-ip-servidor",
          "group": "Red y DHCP",
          "description": "El servidor tiene 10.0.0.1/8 en enp2s0",
          "weight": 1,
          "status": "PASS", "cause": "NONE",
          "execution": {
            "host": "host1", "address": "192.168.1.21:22", "user": "marc",
            "transport": "ssh",
            "command": ["ip", "address", "show", "dev", "enp2s0"],
            "started_at": "2026-09-19T11:02:15+02:00",
            "duration_ms": 188,
            "completed": true, "exit_code": 0,
            "stdout": { "text": "    inet 10.0.0.1/8 scope global enp2s0\n", "bytes": 41, "bytes_total": 41, "truncated": false },
            "stderr": { "text": "", "bytes": 0, "bytes_total": 0, "truncated": false },
            "connect_attempts": 1, "command_attempts": 1,
            "remote_process": "FINISHED"
          },
          "assertion": { "kind": "contains", "expected": "10.0.0.1/8", "found": "10.0.0.1/8", "matched": true, "where": "stdout línea 1" }
        },
        {
          "check_id": "kea-servicio",
          "group": "Red y DHCP",
          "description": "El servicio kea-dhcp4 está activo",
          "weight": 2,
          "status": "UNEVALUATED",
          "cause": "TIMEOUT",
          "detail": "El comando no terminó en 20s; el canal SSH se cerró",
          "execution": {
            "host": "host1", "address": "192.168.1.21:22", "user": "marc",
            "transport": "ssh",
            "command": ["systemctl", "is-active", "kea-dhcp4-server"],
            "started_at": "2026-09-19T11:02:16+02:00",
            "duration_ms": 20004,
            "completed": false,
            "exit_code": null,
            "stdout": { "text": "", "bytes": 0, "bytes_total": 0, "truncated": false },
            "stderr": { "text": "", "bytes": 0, "bytes_total": 0, "truncated": false },
            "connect_attempts": 1, "command_attempts": 1,
            "remote_process": "KILLED_REMOTE"
          },
          "assertion": null
        },
        {
          "check_id": "dns-activo",
          "group": "DNS",
          "description": "named responde",
          "weight": 1,
          "status": "UNEVALUATED",
          "cause": "CONNECTION_LOST",
          "detail": "La sesión SSH se cerró inesperadamente (EOF) al enviar el comando",
          "execution": {
            "host": "host1", "address": "192.168.1.21:22", "user": "marc",
            "transport": "ssh",
            "command": ["dig", "+short", "+time=3", "@127.0.0.1", "pc1.examen.local"],
            "started_at": "2026-09-19T11:02:36+02:00",
            "duration_ms": 412,
            "completed": false, "exit_code": null,
            "stdout": { "text": "", "bytes": 0, "bytes_total": 0, "truncated": false },
            "stderr": { "text": "", "bytes": 0, "bytes_total": 0, "truncated": false },
            "connect_attempts": 1, "command_attempts": 1,
            "remote_process": "UNKNOWN"
          },
          "assertion": null
        },
        {
          "check_id": "q-puerto-https",
          "group": "Cuestionario",
          "description": "Puerto por defecto de HTTPS",
          "weight": 1,
          "status": "UNEVALUATED",
          "cause": "NOT_RUN",
          "detail": "Se agotó el presupuesto de tiempo del alumno (10m)",
          "execution": null,
          "assertion": null
        }
      ]
    }
  ],
  "warnings": [
    {
      "scope": "student:alumne02",
      "code": "REMOTE_PROCESS_UNKNOWN",
      "message": "No se puede garantizar que el comando de dns-activo terminara en 192.168.1.21"
    }
  ]
}
```

Obsérvese que en `alumne02` la nota provisional es 100 y la final es `null`: la
única comprobación que se pudo evaluar la superó, y el sistema **se niega** a
convertir eso en nota.

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
