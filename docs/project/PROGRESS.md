# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-04 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T168 · Las copias automáticas usan menos memoria con resultados voluminosos.**

- Base: `7fd7948`, árbol limpio. El arnés T166 reprodujo F2: la segunda pasada
  de 50 resultados de 6,36 MB dejó 341,6 MB de heap ocupado tras la llamada.
- La pasada valida cada original y retiene solo notas y procedencia; la misma
  segunda pasada dejó 57,9 MB (83 % menos), sin copias nuevas. Con heap V8
  limitado a 128 MB, completó ambas pasadas.
- [Evidencia T168](../reviews/evidence/T168/RESULTADOS.md): 50 copias
  comparadas con sus originales y 50 restauradas; rotación, antecedentes,
  precedencia del original y cierre con copia pendiente cubiertos por pruebas.
- `make check`, `go test -race ./...`, `make test`, `make gui-check gui-build`
  (526 pruebas), `make gui-lab` y `make docs-check tools-check` correctos. La
  GUI pasó fuera del aislamiento por el fallo conocido `EAI_AGAIN localhost`.
- Sin cambios en notas, validación, rotación ni protección de originales. Sin
  publicación ni push.

**Contexto anterior:** T167 resolvió F1 en `7fd7948`. T166 auditó la base
572d9eb; informe y arneses en [T166](../reviews/T166-AUDITORIA.md). La
distribución pública 0.9.1, AppImage, .deb y actualización estaban verificadas
en
[VERIFICACION](../releases/0.9.1/VERIFICACION.md). T160–T164 cerradas.

## Problemas conocidos y límites

- Si un consumidor no lee, puede faltar progreso y `run.end`; el resultado
  guardado mantiene la nota. La GUI trata un flujo sin cierre como incompleto.
- Sigue F3 (errores de lectura, T169) y F4 (parciales/PLAN, T170/T171). No se
  encadenaron en esta sesión.
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

**T169**: distinguir ausencia de resultados y copias de errores de lectura.
Partir de este commit limpio, leer criterios con `python3 scripts/tasks.py T169`
y reproducir F3 con `docs/reviews/evidence/T166/reproduce_backup.ts` (permisos
y copia corrupta). Conservar resultados válidos y mostrar problemas de disco.
Después quedan T170 y T171, cada una en sesión crítica separada.
**T070** sigue desbloqueando **T084**, examen real de aula que ejecuta Adrià.
