# HANDOFF

## Objetivo

Diseñar el sucesor de Teuton: un motor nuevo (nombre sin decidir, provisional
Tecton/Evalon) que corrija exámenes prácticos por SSH, con Teuton GUI como
frontend adaptado, no reescrito. Prioridad absoluta: fiabilidad de la nota.

## Estado actual

**Fase de investigación CERRADA.** No hay ni una línea del motor nuevo escrita,
y así debe seguir hasta cerrar las decisiones abiertas de abajo.

Resultado en `docs/research/` (8 documentos + `evidence/`). Marcas separadas
siempre: `[PRUEBA]` / `[CÓDIGO]` / `[PROPUESTA]`.

- 16 modos de fallo confirmados ejecutando Teuton, todos presentes en v3.0.0.
- Los cinco que más pesan: typo de DSL que encoge el denominador de la nota; un
  alumno que revienta aborta la clase entera; la concurrencia sin límite provoca
  53 ceros de 100 alumnos; un host `127.0.0.x` se evalúa en la máquina del
  profesor; la nota cambia con el `LANG` (80 vs 60).
- Acoplamiento real GUI↔motor: **11 puntos**, nueve de ellos ficheros. La GUI no
  necesita reescribirse; sí sobran 500-700 líneas de andamio cuando el motor sea
  decente.

## Lo siguiente

1. **Traducir a YAML dos exámenes reales del curso** y ver qué falta. Es la
   prueba más barata y la que cierra más decisiones (riesgo nº 1 de
   `PROPOSAL.md` §8). Antes de escribir motor.
2. Cerrar las decisiones abiertas D-1..D-7 (`PROPOSAL.md` §6).
3. Solo entonces: prototipo vertical con los 8 criterios de aceptación de
   `PROPOSAL.md` §7 (2 alumnos, uno roto a propósito).

## Decisiones ya tomadas

Confirmadas por las pruebas: Go, binario único, SSH nativo, concurrencia
limitada, timeouts y cancelación, YAML declarativo sin DSL ejecutable, NDJSON
para la GUI, GUI adaptada.

Corregidas respecto a la dirección preliminar:

- El estado técnico tiene que ser **por comprobación**, no por alumno (si no,
  reaparece el caso del corte a mitad: nota 33 ininterpretable).
- Taxonomía: **dos ejes**. Académico `PASS`/`FAIL`/`UNEVALUATED` + campo de causa
  (`CONNECT_FAILED`, `AUTH_FAILED`, `TIMEOUT`, `CONNECTION_LOST`, `NOT_RUN`,
  `CANCELLED`, `ENGINE_ERROR`). `UNEVALUATED` nunca entra en la nota.
- Arquitectura: añadir una fase **PLAN** antes del scheduler. Fija el denominador
  antes de tocar ninguna máquina.
- El NDJSON **no** es el primer entregable: primero un escritor de compatibilidad
  (`resume.json` + `case-NN.json`) para validar el motor contra la UAT hostil de
  la GUI sin tocarla.

## Referencias

- `docs/research/README.md` — índice y los cinco hallazgos principales.
- `docs/research/REPRODUCIR.md` — entorno, comandos, limitaciones.
- `docs/research/PROPOSAL.md` §6 — decisiones abiertas; §7 — prototipo; §8 — riesgos.
- `docs/research/evidence/` — proyectos de prueba y `Containerfile` del lab SSH.
- `workspace/teuton` y `workspace/teuton-gui` — clones intactos (`git status`
  limpio). `workspace/teuton-run` es la copia de trabajo.
- `https-github-com-teuton-software-teuton-jiggly-dolphin.md` — auditoría previa
  de código, anterior a esta fase empírica. Sus 9 puntos quedan confirmados y
  ampliados por `docs/research/FAILURE-MODES.md`.

## Notas operativas

- `/mnt/datos/Applications/Claude/Evalon` **no es un repositorio git todavía**.
- Laboratorio SSH: `podman run -d --name alu1 -p 127.1.2.3:2201:22 teutonlab-ssh`
  (imagen ya construida; `Containerfile` en `evidence/`). **`127.1.2.3` y no
  `127.0.0.1`**: con `127.0.0.x` Teuton ejecuta en local y las pruebas no tocan
  SSH.
- Ejecutar Teuton con `HOME` aislado (`workspace/sshlab/fakehome`): una entrada
  ed25519 en el `known_hosts` real tumba la ejecución (F-12).
- La e2e de la GUI **falla entera (40/40) si no se ha hecho `npm run build`**
  antes, con un error que no lo explica.
- No actualizar el Teuton instalado (2.10.6) a 3.0.0 sin probar: `tt_skip: true`
  aborta la ejecución en 3.0.0 (F-11).
