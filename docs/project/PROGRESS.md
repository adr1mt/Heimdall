# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-05 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T170 y T171 · Corregido F4, rendimiento de parciales y memoria del PLAN.**

- Base limpia `424bac4`. T170 en `3f0ce82`: el resultado terminado de cada
  alumno se redacta y recorta una sola vez. Siguen publicándose parciales
  atómicos tras cada alumno; el final se prepara desde el resultado original.
  En el caso sintético de 100 alumnos, 12,90 → 2,43 s de ejecución y guardado,
  con ~421 MB publicados en ambos casos.
- T171: la huella del PLAN se calcula sin reunir todas las respuestas en un
  gran JSON. En 100 × 20 × 65536 bytes: 793,7 → 151,6 MB de asignaciones
  durante la huella; heap tras PLAN 541,7 → 220,1 MB sin forzar GC; RSS máximo
  786 → 291 MiB. Dos huellas anteriores permanecen idénticas.
- [Evidencia T170](../reviews/evidence/T170/RESULTADOS.md) y
  [T171](../reviews/evidence/T171/RESULTADOS.md). Pasaron `make check`,
  regresiones de parciales, SIGKILL, secretos, presupuesto, huella, límites,
  reintentos y sesiones; también `go test -race ./...` y
  `make docs-check tools-check`. Sin cambios en notas ni PLAN válido.

**Contexto anterior:** T169 resolvió F3 en `424bac4`; T168 redujo la memoria de
copias en `36e869d`; T167 resolvió F1 en `7fd7948`. La auditoría T166 está en
[su informe](../reviews/T166-AUDITORIA.md). La distribución pública 0.9.1 está
verificada en [VERIFICACION](../releases/0.9.1/VERIFICACION.md).

## Problemas conocidos y límites

- Si un consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado mantiene la nota. La GUI trata un flujo sin cierre como incompleto.
- La copia sigue leyendo cada original para validar cambios y corrupción; el
  límite de 128 MB probado es del heap V8, no del RSS ni de cualquier examen.
- El .deb se ejecutó extraído, sin instalarlo: sudo requiere contraseña.
- Laboratorio en 127.1.2.3; arneses SSH y secretos se ejecutan secuencialmente.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos resueltos; inventario hasta
  65536 bytes. PLAN no admitido se rechaza antes de SSH.
- Copias conservan notas y procedencia, sin salidas. Recuperación no sobrescribe.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; .deb mediante apt.
- Editor formulario reformatea YAML; edición directa conserva texto.
  Autenticación por clave SSH pendiente (T023), sin caso de uso aún.

## Siguiente trabajo

**T070**: rehacer exámenes del curso en formato nativo; desbloquea **T084**,
examen real de aula que ejecuta Adrià. Consultar
`python3 scripts/tasks.py T070` antes de empezar. **T023** sigue READY.
