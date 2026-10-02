# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-02 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T157 · Paridad de validación Go/GUI.**

- Corpus común de 72 artefactos con decisiones explícitas de aceptación:
  decimales, pesos diminutos/cero, ausencias/null, adiciones, cancelados,
  excluidos, reintentos y copias; lector Go y ambos lectores GUI contrastados.
- Presupuesto omitido sigue válido; explícito debe ser 1…65536.
  Go rechaza ahora 0/null, como GUI y esquema publicado.
- Go rechaza procedencia sin fecha, avisos incompletos y null que ocultaban
  datos de evidencia. GUI rechaza sumas infinitas incluso en resultados FAIL.
- Nota autoritativa, excepciones de copias y reglas de composición conservadas.
  Sin cambios YAML/NDJSON, nuevos ADR, dependencias ni abstracciones.
- `make check`, ambos builds y tipos correctos; 506 tests GUI pasan fuera
  del aislamiento (localhost no resuelve dentro). Caché Go temporal escribible.
- Corpus y alcance: `testdata/artifacts/README.md`. Regresiones A11/A13
  conservadas y ampliadas; límite de lectura T156 sigue cubierto.
- Base de esta mejora: d45041c. Commit local por tarea, sin publicación.
- T158 READY, sin iniciar; una tarea por sesión en esta zona crítica.

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

**T158**: concentrar el recorrido de cadenas de copias. **T070** sigue desbloqueando **T084**,
examen real de aula de principio a fin que ejecuta Adrià antes de la 1.0.0.

## Revisión pendiente solicitada
Usar la skill code-review para revisar improve-codebase-architecture sin
modificar archivos: fijar el commit anterior a aquella mejora e incluir todo
lo posterior y sin commit; preguntar si la base no se identifica con certeza.
Separar normas/ADR y especificación aprobada; comprobar contratos, notas,
estados, reintentos, cancelación, secretos, simplicidad y REPARACION.md.
Informar prioridad, archivo/línea, impacto y evidencia; defectos frente a dudas,
aptitud para integración, bloqueos y validaciones pendientes.
