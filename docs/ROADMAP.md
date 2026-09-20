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

**Salida**: `make check` en verde; `heimdall check` imprime el denominador exacto
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
- Política de identidad de las máquinas cerrada (**D-3**, ADR-0011).
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

## Fase 4 — Contrato nativo motor ↔ GUI

El primer eslabón de la cadena definitiva. Eventos NDJSON por stdout, versionados:
`run.start` con el total exacto de comprobaciones, un evento por comprobación con
estado y causa técnica, `run.end` con el resumen. Más el artefacto canónico, que
ya existe, como fuente de verdad del resultado. Cierra **D-9**.

Se publica también un esquema estable del artefacto para que la GUI lo consuma
sin adivinar.

**Salida**: el contrato documentado, versionado y emitido por el motor; un
consumidor de prueba lee una ejecución completa —progreso, incompletas y causas
incluidas— sin leer ningún fichero de Teuton.

## Fase 5 — Heimdall GUI sobre el contrato nativo

La aplicación propia, en `gui/`. Nace con `teuton-gui` como base técnica y
visual: Electron, Vite, React, Tailwind, componentes, estilos, layouts y los
tests que sigan aportando. Se elimina desde el primer commit toda dependencia
conceptual y técnica de Teuton; la capa de motor se escribe directa sobre el
contrato de la fase 4.

Se conserva la experiencia de uso: lista de alumnos, matriz de resultados,
progreso de corrección, filtros, histórico, modo examen, presentación de notas
y errores, analíticas. Y se aprovecha lo que Teuton GUI no podía mostrar:
`UNEVALUATED` como tal y no inferido, la causa técnica de cada comprobación,
la nota provisional, los avisos y los resultados parciales.

Se cierra **D-8**: cómo presenta la GUI un `INCOMPLETE` y qué ofrece al
profesor.

Se cierra **D-10**: qué nota vale en una sesión de examen. Las vueltas que
encadena el modo examen son fotografías del mismo examen, así que ahí se
conserva la **mejor nota completa** de cada alumno y quien llega al total queda
`FINALIZADO` y deja de entrar en las vueltas siguientes. Es una regla distinta
de la de ADR-0019, que gobierna la cadena de reintento de una incidencia
técnica, y se resuelve en el motor (T062, T063, T064).

**Salida**: un examen completo corregido de principio a fin desde la aplicación,
contra el laboratorio, sin que exista un solo fichero de Teuton por medio.

## Fase 6 — Retirada de la capa legacy

`internal/legacy`, `--compat=teuton2` y la fachada `--export=json`/`--cname`/
`--case` se borran en un commit propio, junto con `06-LEGACY-WRITER.md` y las
referencias que queden. Hasta ese momento están congeladas: sirven para pruebas
internas y no reciben nada nuevo (ADR-0016).

**Salida**: `grep -ri teuton` en el código del motor y de la GUI no devuelve
ninguna dependencia, solo menciones históricas en `docs/research/`.

## Fase 7 — Exámenes del curso y empaquetado

- Los exámenes reales se rehacen en el formato nativo, uno a uno, con su
  aula. No hay migrador automático (ADR-0016).
- Editor de exámenes en la GUI sobre el formato nativo.
- Binario embebido en la aplicación de escritorio, para Linux y Windows.

**Salida**: descargar la aplicación, ejecutarla y que funcione. Sin Ruby, sin
gems, sin Go, sin Docker ni Podman, sin servicios externos.

## Fase 8 — Hardening y release

- Repaso de los 16 modos de fallo de
  [research/FAILURE-MODES.md](research/FAILURE-MODES.md): cada uno, corregido o
  documentado como aceptado.
- Auditoría de secretos de extremo a extremo.
- Documentación de usuario y versionado.

**Salida**: un examen real de aula corregido con Heimdall, motor y GUI.
