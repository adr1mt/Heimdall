# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-19 · **Fase**: 0 — Bootstrap y contratos

## Última tarea terminada

Ninguna del backlog. Antes del backlog se cerraron dos fases de documentación:
investigación empírica (`docs/research/`, 8 documentos + `evidence/`) y diseño
arquitectónico (`docs/design/`, 8 documentos + 9 ADR aceptados). Esta sesión
convirtió ambas en estructura de proyecto: `CLAUDE.md`, `.claude/rules/`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md` y `docs/project/`.

## Estado actual

**No existe ni una línea del motor.** El repositorio es documentación y
evidencia. Todo lo que sigue está decidido y escrito; falta ejecutarlo.

- Go **no está instalado** en el equipo. Es lo primero de T001 y sin ello no hay
  ninguna medición posible del motor nuevo.
- Podman y `jq` sí están. La imagen `localhost/teutonlab-ssh:latest` ya existe.
- `workspace/` contiene los clones de Teuton y Teuton GUI y el laboratorio. No
  se versiona y se regenera con `docs/research/REPRODUCIR.md`.

## Pruebas ejecutadas

Ninguna del motor nuevo: todavía no hay código. Las suites del sistema viejo
quedaron medidas en la fase de investigación (`docs/research/README.md`, tabla
final) y sirven de línea base para la UAT de la fase 4.

## Problemas conocidos

- **Go ausente** (T001). Bloquea todo el backlog.
- Laboratorio SSH en **`127.1.2.3`, no `127.0.0.1`**: con `127.0.0.x` Teuton
  ejecuta en local (F-01) y el criterio A-11 comprueba que el motor nuevo no.
- Ejecutar Teuton con `HOME` aislado (`workspace/sshlab/fakehome`): una entrada
  ed25519 en el `known_hosts` real tumba la ejecución (F-12).
- La e2e de la GUI falla entera (40/40) si no se ha hecho `npm run build`
  antes, con un error que no lo explica.
- No actualizar el Teuton instalado (2.10.6) a 3.0.0 sin probar: `tt_skip: true`
  aborta la ejecución en 3.0.0 (F-11).

## Decisiones inesperadas de esta sesión

- `HANDOFF.md` se reduce a un puntero: el estado operativo vive ahora en este
  fichero, para no tener dos fuentes de verdad.
- El informe inicial de auditoría que estaba suelto en la raíz pasa a
  `docs/research/00-AUDITORIA-INICIAL.md`.
- El roadmap ajusta la fase 2 propuesta: en vez de «robustez SSH» a secas, es
  «formato completo y robustez», porque `cerca_de`, `valor:` y `no_contiene`
  hacen falta para correr un examen real y eso es lo que cierra la fase.

## Siguiente tarea recomendada

**T001 — Toolchain Go y esqueleto del módulo** (fase 0, P0, sin dependencias).
Es la única `READY`. Instalar Go ≥ 1.22, crear el módulo, los tres subcomandos
vacíos, la tabla de exit codes y el `Makefile`. Criterios en `TASKS.json`.
