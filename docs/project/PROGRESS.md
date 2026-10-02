# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-02 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T158 · Recorrido común de cadenas de copias.**

- Copia, retención, listado y recuperación comparten ciclo, identidad,
  PLAN y máximo de 50 eslabones; solo `retry_of` declara un antecedente.
- Se conserva la búsqueda por nombre: original primero, copia si falta.
  Validación completa antes de escribir y escritura del antiguo al reciente.
- Retención de 50 correcciones recientes y todos sus antecedentes conservada;
  recuperación sin sobrescribir originales ni eliminar ficheros corruptos.
- Go sigue calculando notas; sesiones y reintentos conservan reglas distintas.
  Lectores, corpus común de 72 artefactos y defensas de corrupción intactos.
- 10 nuevas regresiones: ciclo/identidad/PLAN, ausente/corrupto, 49/50/51,
  prioridad de búsqueda y ejecuciones independientes; originales byte a byte.
- `make check`, ambos builds y tipos correctos; 516 tests GUI pasan fuera
  del aislamiento (localhost no resuelve dentro). Caché Go temporal escribible.
- Base inicial: 2d16110e1b63506d86a1e1694270d129a4010161; árbol limpio.
  Commit local de T158, sin publicación ni tarea encadenada. Sin nuevo ADR.

**T127–T155 · Auditorías reparadas.**
- 18 incidencias iniciales y 11 posteriores reparadas, incluyendo cadenas
  completas, cierre, actualizaciones, presupuestos de evidencia y YAML.
- Evidencias: `docs/audits/2026-10-02/REPARACION.md` y
  `docs/audits/2026-10-02/post/repair/REPARACION.md`.
- AppImage/.deb 0.9.0 de la sesión anterior; no se reempaquetaron en T156.

## Problemas conocidos y límites

- Laboratorio en **127.1.2.3**. Arneses que cuentan conexiones o buscan
  secretos globalmente se ejecutan de forma secuencial.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos resueltos;
  inventario hasta 65536 bytes. PLAN no admitido se rechaza antes de SSH.
- Evidencia recortada tras comparar, con aviso; copias conservan notas,
  comprobaciones y procedencia, no salidas.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; `.deb` mediante apt.
  No se ha instalado una actualización desde una release real.
- Editor formulario reformatea YAML; edición directa conserva texto.
  Autenticación por clave SSH pendiente (T023).

## Siguiente tarea recomendada

Revisión pendiente de improve-codebase-architecture, descrita debajo.
**T070** sigue desbloqueando **T084**, examen real de aula que ejecuta Adrià.

## Revisión pendiente solicitada
Usar la skill code-review para revisar improve-codebase-architecture sin
modificar archivos: fijar el commit anterior a aquella mejora e incluir todo
lo posterior y sin commit; preguntar si la base no se identifica con certeza.
La base de T158 no identifica por sí sola la base de esa revisión.
Separar normas/ADR y especificación aprobada; comprobar contratos, notas,
estados, reintentos, cancelación, secretos, simplicidad y REPARACION.md.
Informar prioridad, archivo/línea, impacto y evidencia; defectos frente a dudas,
aptitud para integración, bloqueos y validaciones pendientes.
