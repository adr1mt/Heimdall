# HANDOFF

## Objetivo

Diseñar el sucesor de Teuton: un motor nuevo (provisional **Evalon**) que
corrige exámenes prácticos por SSH, con Teuton GUI como frontend adaptado, no
reescrito. Prioridad absoluta: fiabilidad de la nota.

## Estado actual

**Investigación cerrada** (`docs/research/`, 8 documentos + `evidence/`).
**Diseño cerrado** (`docs/design/`, 8 documentos + `docs/adr/`, 9 ADRs).

Sigue sin existir ni una línea del motor. La siguiente sesión escribe el
prototipo vertical, y su especificación exacta ya está escrita:
`docs/design/07-PROTOTIPO.md`.

Lo que se cerró en la fase de diseño:

- **El YAML declarativo aguanta los exámenes reales.** Traducidos dos exámenes
  del curso (cuestionario de 10 preguntas y Examen RA2 de KEA+BIND, 16
  comprobaciones por SSH). Ninguno usa bucles ni condicionales. Hacen falta dos
  primitivas nuevas (`cerca_de` en vez de `grep -A N`, y `valor:` para
  cuestionarios sin ejecutar nada) y **cero scripting**. El riesgo nº 1 queda
  rebajado.
- Parametrización: sustitución `${alumno.campo}` sí, decisión no. Denominador
  idéntico para todos, fijado por el PLAN.
- Estados: `PASS`/`FAIL`/`UNEVALUATED` + 8 causas técnicas, por comprobación.
- Nota: `final_score = null` mientras haya un `UNEVALUATED` de peso > 0.
- `run-<ulid>.json` como única fuente de verdad, cuatro capas separadas.
- Secretos por stdin desde el almacén cifrado de la GUI; referencias en el YAML.
- Timeout remoto con `timeout` de coreutils; `remote_process: UNKNOWN` cuando no
  se puede garantizar. Reintentos solo antes de enviar el comando.
- `LegacyTeutonWriter` como capa temporal para pasar la UAT de 40 escenarios.

## Lo siguiente

1. **Instalar Go** (≥1.22). No está en el equipo y sin él no hay ninguna
   medición del motor nuevo.
2. Levantar el laboratorio:
   `podman run -d --name alu1 -p 127.1.2.3:2201:22 teutonlab-ssh`.
3. Implementar el prototipo exactamente como dice `docs/design/07-PROTOTIPO.md`
   §3, ni más ni menos, y pasar los **14 criterios de aceptación** de §6.
   Los cinco que no se negocian: A-1, A-2, A-3, A-8, A-14.

## Referencias

- `docs/design/README.md` — índice del diseño.
- `docs/adr/README.md` — las 9 decisiones cerradas.
- `docs/design/08-DECISIONES-ABIERTAS.md` — lo que sigue abierto (D-2, D-3, D-5,
  D-6, D-7, D-8, D-9).
- `docs/research/README.md` — los cinco hallazgos que motivan todo lo anterior.
- Exámenes reales usados en la traducción:
  `/mnt/datos/Applications/Claude/teuton-gui-v2/sandbox/examen-demo/` y
  `.../sandbox/prueba/dns/`.
- `workspace/teuton` y `workspace/teuton-gui` — clones intactos.

## Notas operativas

- Laboratorio SSH: **`127.1.2.3` y no `127.0.0.1`** (con `127.0.0.x` Teuton
  ejecuta en local, F-01).
- Ejecutar Teuton con `HOME` aislado (`workspace/sshlab/fakehome`): una entrada
  ed25519 en el `known_hosts` real tumba la ejecución (F-12).
- La e2e de la GUI **falla entera (40/40) si no se ha hecho `npm run build`**
  antes, con un error que no lo explica.
- No actualizar el Teuton instalado (2.10.6) a 3.0.0 sin probar: `tt_skip: true`
  aborta la ejecución en 3.0.0 (F-11).
- No ejecutar servidores de desarrollo con `bash`; usar las herramientas de
  preview.
