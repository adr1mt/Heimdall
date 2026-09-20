# Arquitectura vigente

Describe el sistema tal como está decidido hoy, no cómo se llegó aquí. La
historia está en [`research/`](research/); el detalle de cada pieza, en
[`design/`](design/); el porqué de cada decisión, en [`adr/`](adr/).

---

## 1. Límites del sistema

```
Profesor
   │
   ▼
Heimdall GUI (Electron, en `gui/`)
   │  examen.yaml + aula.yaml + secretos por stdin · eventos NDJSON de vuelta
   ▼
Motor Heimdall (Go, binario único embebido)
   │  SSH nativo
   ▼
Máquinas del alumnado
```

**Dentro del motor**: leer y validar los dos YAML, fijar el PLAN, conectar por
SSH, ejecutar comandos, evaluar aserciones, clasificar, puntuar y escribir un
artefacto JSON.

**Fuera del motor**: la interfaz, el almacén de credenciales, la conversión a la
escala de nota del profesor, la resolución manual de evaluaciones incompletas,
el histórico por clase y la exportación de notas.

Lo que no entra en el núcleo: telnet, monitorización, correo, SFTP, macros,
detección de copias, DSL ejecutable.

## 2. Flujo

```
examen.yaml ─┐
aula.yaml  ──┴─► plan.Load ──(inválido)──► exit 2 · fichero y línea · nada escrito
                    │
                    ▼  Plan inmutable: mismos check_ids y total_weight para todos
              engine.Run(ctx, plan, secrets)
                    │   worker pool acotado · un contexto por alumno
                    ▼
              ssh.Session por alumno y host (reutilizada)
                    │   exec por comprobación · sin pty · flujos separados
                    ▼
              ExecutionResult ──► assert.Eval ──► AssertionResult
                    │
                    ▼
              model.Classify ──► CheckResult{Status, Cause, Detail}
                    │
                    ▼
              model.ComputeScore(plan, checks) ──► Score
                    │
                    ▼
              report.WriteAtomic(var/run-<ulid>.json)
                    └─(congelado, ADR-0016)─► legacy.Write(...) solo con --compat=teuton2
```

La fase PLAN es anterior a cualquier conexión y no puede alterarse después.

## 3. Componentes y responsabilidades

| Paquete | Responsabilidad | No hace |
|---|---|---|
| `cmd/heimdall` | CLI (`run`, `check`, `consolidate`, `version`), lectura de secretos, exit codes | Lógica de evaluación |
| `internal/plan` | Parseo y validación de los dos YAML, sustitución `${…}`, hashes, `PlanSummary` | Red, disco de salida |
| `internal/model` | Tipos canónicos, `Classify`, `ComputeScore` | Red, disco, reloj |
| `internal/ssh` | Sesión por alumno/host, `exec`, límites de salida, timeouts, `timeout` remoto | Interpretar resultados |
| `internal/engine` | Worker pool, presupuesto por alumno, aislamiento, cancelación | Decidir notas |
| `internal/assert` | `contiene`, `igual_a`, `no_contiene`, `exit_code`, `cerca_de` | Saber de notas |
| `internal/report` | Escritura atómica, artefacto parcial, redacción de secretos | Calcular nada |
| `internal/legacy` | **Congelado (ADR-0016)**: ficheros y fachada de Teuton para pruebas internas, hasta que se borre en T060 | Recibir nada nuevo, influir en la nota |
| `internal/events` | Contrato nativo: eventos NDJSON por `stdout` (ADR-0017) | Llevar salida de las máquinas, ser fuente de verdad |
| `gui/` | Heimdall GUI: Electron sobre el contrato nativo | Calcular notas, hablar con SSH |

## 4. Separación motor / GUI

Un solo canal, nativo, en una sola dirección (ADR-0016):

```
Heimdall GUI ──► examen.yaml + aula.yaml + secretos por stdin ──► motor
Heimdall GUI ◄── eventos NDJSON (progreso, estado, causa) ──────── motor
Heimdall GUI ◄── artefacto canónico JSON ──────────────────────── motor
```

El detalle está en [design/09-CONTRATO-GUI.md](design/09-CONTRATO-GUI.md) y el
esquema del artefacto en
[design/schema/run-result.schema.json](design/schema/run-result.schema.json).
El artefacto es la fuente de verdad y los eventos son el progreso: nada viaja
por el flujo que el artefacto no tenga, y la salida de las máquinas del
alumnado no viaja por él en absoluto (ADR-0017).

El motor no sabe que existe una GUI: publica eventos y un artefacto. La GUI no
sabe de SSH ni de notas: presenta lo que el modelo canónico dice. No hay
compatibilidad con Teuton en ningún punto; `internal/legacy` está congelado y
solo sirve para pruebas internas hasta que se borre.

La GUI vive en `gui/`, en este repositorio, para que contrato y consumidor
viajen siempre en la misma versión. Toma de `teuton-gui` la base técnica y
visual y la experiencia de uso —lista de alumnos, matriz, progreso, filtros,
histórico, modo examen, analíticas—, no su contrato.

## 5. Modelo de resultados

Cuatro capas estrictas, cada una solo lee la anterior:

```
ExecutionResult   hechos del proceso        (técnico, sin juicio)
AssertionResult   qué se comparó            (comparación, sin nota)
CheckResult       PASS | FAIL | UNEVALUATED (académico)
Score             obtained/evaluable/total  (puntuación)
```

- **Eje académico**, por comprobación: `PASS`, `FAIL`, `UNEVALUATED`.
- **Eje técnico**, independiente: `NONE`, `CONNECT_FAILED`, `AUTH_FAILED`,
  `TIMEOUT`, `CONNECTION_LOST`, `OUTPUT_OVERFLOW`, `NOT_RUN`, `CANCELLED`,
  `ENGINE_ERROR`.
- `UNEVALUATED` no entra en el denominador y **nunca** se convierte en `FAIL`.
- Un exit 127 del servidor del alumno **es `FAIL`**: la máquina respondió.
- `final_score` es `null` mientras exista una comprobación `UNEVALUATED` de peso
  mayor que 0. El estado es `INCOMPLETE` y no hay nota publicable.
- `provisional_score` existe siempre que haya algo evaluado y va siempre
  acompañado de `unevaluated` y `status`. No se llama `score` a propósito.
- Un alumno que no se pudo evaluar saca `NOT_EVALUATED`, no un 0.

Detalle completo: [03-ESTADOS-Y-NOTA.md](design/03-ESTADOS-Y-NOTA.md) y
[04-MODELO-RESULTADO.md](design/04-MODELO-RESULTADO.md).

## 6. Fuente de verdad

`var/run-<ulid>.json`, un fichero por ejecución, escritura atómica, nunca
sobrescrito y nunca modificado. Todo lo demás —NDJSON, GUI, exportaciones— **deriva** de él; nada escribe hacia atrás. Un dato que solo exista en un formato derivado no existe.

Mientras la ejecución corre, `var/run-<id>.partial.json` se reescribe
atómicamente al cerrar cada alumno, para que un proceso muerto deje material
útil.

## 7. Invariantes

Cada uno es comprobable y tiene su test:

1. El denominador (`plan.total_weight`) es idéntico para todos los alumnos y se
   fija antes de la primera conexión.
2. La lista de `check_ids`, su orden y sus pesos son idénticos para todos los
   alumnos.
3. `cause != NONE` implica `status == UNEVALUATED`. Sin excepciones.
4. `status != UNEVALUATED` implica `assertion != null` y `exit_code != null`.
5. `status == UNEVALUATED` implica `cause != NONE` y `detail` no vacío.
6. `unevaluated > 0` implica `final_score == null` y `status == INCOMPLETE`.
7. El fallo de un alumno no altera ningún resultado de otro alumno.
8. Toda comprobación termina: por resultado, por timeout o por cancelación.
9. Ningún secreto aparece en el artefacto, los logs, `argv` ni los ficheros
   legacy.
10. El resultado no depende de la configuración regional del equipo del
    profesor.

## 8. Ejecución y límites

- **Transporte**: SSH nativo (`x/crypto/ssh`), una sesión por alumno y host,
  reutilizada. Sin pty; los flujos nunca se mezclan.
- **Comandos**: vector de argumentos. Nunca hay shell.
- **Timeouts**: conexión 10 s · comprobación 20 s (configurable) · alumno 10 min
  · cancelación por señal. No hay timeout global separado.
- **Proceso remoto**: se envuelve en `timeout -k 5s N` de coreutils si el host
  lo tiene (`remote_process: KILLED_REMOTE`); si no, `UNKNOWN` y `Warning`. La
  incertidumbre se publica, no se esconde.
- **Reintentos**: solo lo que con seguridad no se ejecutó (2 de conexión, con
  espera y jitter). Nunca tras enviar el comando. Nunca en `AUTH_FAILED`.
- **Salida**: 64 kB conservados por flujo, corte duro a 8 MB, `bytes_total`
  siempre real, `truncated` explícito.
- **Concurrencia**: tope global de alumnos a la vez (8) y tope de aperturas de
  sesión simultáneas contra una misma máquina (4), ambos publicados en el
  artefacto y ajustables desde la línea de órdenes (ADR-0012). Sin el segundo,
  casi la mitad de una clase de 100 choca con `MaxStartups`.
- **Aislamiento**: un contexto y un presupuesto por alumno. Un alumno roto no
  puede abortar la pasada ni alterar la nota de otro.

## 9. Distribución

Binario único, sin Ruby, sin gems, sin Go, sin Docker ni Podman y sin servicios
externos en la máquina del profesor. El motor se embebe en la aplicación de
escritorio. Podman y OpenSSH solo se usan en desarrollo y en los tests.
