# Roadmap

Fases de producto, no backlog. Las tareas están en
[project/TASKS.json](project/TASKS.json).

Cada fase tiene una **condición de salida** verificable. No se empieza una fase
sin la anterior cerrada, salvo que una tarea lo diga explícitamente.

---

## Fase 0 — Bootstrap y contratos

Todo lo que no toca la red. El objetivo es tener escritos y probados los
contratos de los que cuelga la integridad de la nota **antes** de que exista una
conexión SSH.

- Toolchain Go y esqueleto del módulo.
- Tipos canónicos de `RunResult` con round-trip JSON.
- `Classify` y `ComputeScore` puros, con tabla exhaustiva de causas.
- Parseo y validación de `examen.yaml` y `aula.yaml`; las 9 validaciones del
  PLAN; sustitución `${…}`; hashes; subcomando `check`.
- Laboratorio SSH reproducible.

**Salida**: `make check` en verde; `evalon check` imprime el denominador exacto
sin tocar ninguna máquina; un YAML mal escrito produce exit 2 con fichero y
línea.

## Fase 1 — Vertical slice mínimo

El primer hito de implementación. Especificado en
[design/07-PROTOTIPO.md](design/07-PROTOTIPO.md): 2 alumnos (uno correcto, uno
con fallo técnico provocado), 5 comprobaciones, peso total 6, SSH real,
timeouts, salida acotada, aislamiento, cancelación, artefacto atómico.

Demuestra de extremo a extremo `aula.yaml + examen.yaml → PLAN → scheduler →
SSH → checks → ExecutionResult → PASS/FAIL/UNEVALUATED + causa → StudentResult →
RunResult JSON`.

**Salida**: los **14 criterios de aceptación** A-1…A-14 en verde, medidos con
`jq` sobre el artefacto real. Los cinco que no se negocian: A-1, A-2, A-3, A-8,
A-14. Si alguno falla, no se sigue con nada más.

## Fase 2 — Formato completo y robustez de ejecución

Lo que falta para correr un examen real del curso, con la ejecución endurecida.

- Aserciones `no_contiene` y `cerca_de`; comprobaciones `valor:` sin comando.
- `excluido: true`; pesos decimales y peso 0.
- Política de `known_hosts` cerrada (**D-3**, antes del primer examen real).
- Autenticación por clave y passphrase.
- Reintentos auditados, `timeout` remoto, `remote_process` en todos los caminos.
- Corte duro de salida verificado contra las salidas gigantes de `evidence/`.

**Salida**: los dos exámenes reales traducidos en
[design/01-TRADUCCION-EXAMENES.md](design/01-TRADUCCION-EXAMENES.md) se ejecutan
completos contra el laboratorio.

## Fase 3 — Concurrencia, cancelación y límites

- Tope global y tope por host de destino.
- Presupuesto por alumno y `NOT_RUN` correctamente atribuido.
- Cancelación limpia con artefacto parcial útil.
- Mediciones de [research/PERFORMANCE.md](research/PERFORMANCE.md) §6 con
  10/30/100 alumnos y salidas de 1/20/100/300 MB.

**Salida**: **cero ceros por causa técnica** con 100 alumnos contra un host con
`MaxStartups` por defecto —lo que Teuton no consigue (53 de 100)— y RSS plano
respecto al tamaño de la salida. Cierra **D-6**.

## Fase 4 — Compatibilidad con Teuton GUI y UAT

`LegacyTeutonWriter` completo (`resume.json`, `case-NN.json`, `moodle.csv`) más
la fachada CLI mínima (`version`, `check`, progreso por caracteres).

**Salida**: la GUI actual, **sin tocar una línea**, pasa sus 40 escenarios e2e
apuntando al binario nuevo. Y golden files comparados campo a campo con salidas
reales de Teuton.

## Fase 5 — Contrato nativo motor ↔ GUI

Eventos NDJSON por stdout: `run.start` con el total exacto de comprobaciones, un
evento por comprobación, estado técnico explícito. Cierra **D-9**.

**Salida**: el contrato documentado y estable, con el motor emitiéndolo a la vez
que la capa legacy.

## Fase 6 — Adaptación de Teuton GUI

Se adapta, no se reescribe. Módulo a módulo, cada uno con la suite existente en
verde:

1. `lib/progress.ts` → consumo de NDJSON.
2. `results.ts` → artefacto canónico; `isUnevaluated` deja de ser inferencia.
3. Presentación de `INCOMPLETE` y qué acción se ofrece al profesor (**D-8**).
4. Se borran el watchdog, `parseFirstJsonValue`, el filtrado por ids y
   `resolveViaLoginShell`.

**Salida**: ningún test de la GUI lee `resume.json` ni `case-NN.json`, y
`internal/legacy` se elimina en un solo commit.

## Fase 7 — Migración de exámenes y empaquetado

- Migrador de proyectos Teuton (`config.yaml` + `start.rb`) a los dos YAML, con
  informe de lo que no se puede traducir. Nunca silencioso.
- Editor de exámenes de la GUI sobre el formato nuevo.
- Binario embebido en la aplicación de escritorio, para Linux y Windows.
- Nombre definitivo del producto (**D-7**).

**Salida**: descargar la aplicación, ejecutarla y que funcione. Sin Ruby, sin
gems, sin Go, sin Docker ni Podman, sin servicios externos.

## Fase 8 — Hardening y release

- Repaso de los 16 modos de fallo de
  [research/FAILURE-MODES.md](research/FAILURE-MODES.md): cada uno, corregido o
  documentado como aceptado.
- Auditoría de secretos de extremo a extremo.
- Comparación nota a nota entre los dos motores sobre el mismo examen y la misma
  aula, como test y no como revisión a ojo.
- Documentación de usuario y versionado.

**Salida**: un examen real de aula corregido con el motor nuevo.
