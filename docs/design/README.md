# Diseño del motor nuevo

Fase de diseño posterior a `../research/`. Cierra las decisiones que afectan
profundamente a la arquitectura, **antes** de escribir una línea de Go.

| Fichero | Contenido |
|---|---|
| [01-TRADUCCION-EXAMENES.md](01-TRADUCCION-EXAMENES.md) | Dos exámenes reales del curso traducidos al formato nuevo, construcción por construcción |
| [02-FORMATO.md](02-FORMATO.md) | Capacidades mínimas, política de parametrización, `examen.yaml` y `aula.yaml` definitivos del MVP |
| [03-ESTADOS-Y-NOTA.md](03-ESTADOS-Y-NOTA.md) | Taxonomía de estados y causas; política de notas incompletas |
| [04-MODELO-RESULTADO.md](04-MODELO-RESULTADO.md) | `RunResult` completo y ejemplo realista del JSON |
| [05-SECRETOS-TIMEOUTS-REINTENTOS.md](05-SECRETOS-TIMEOUTS-REINTENTOS.md) | Secretos, límites de stdout/stderr, timeouts y reintentos |
| [07-PROTOTIPO.md](07-PROTOTIPO.md) | Especificación exacta del primer prototipo y 14 criterios de aceptación |
| [08-DECISIONES-ABIERTAS.md](08-DECISIONES-ABIERTAS.md) | Lo que sigue abierto |
| [09-CONTRATO-GUI.md](09-CONTRATO-GUI.md) | Contrato nativo motor ↔ GUI: eventos NDJSON y códigos de salida |
| [schema/run-result.schema.json](schema/run-result.schema.json) | Esquema publicado del artefacto canónico |
| [ACEPTACION-FASE1.md](ACEPTACION-FASE1.md) | Salida real de `test/acceptance.sh`: evidencia del cierre de la fase 1 |

Decisiones cerradas: [`../adr/`](../adr/) (ADR-0001 … ADR-0017).
