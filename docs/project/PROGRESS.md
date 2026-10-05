# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-05 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T172 · Higiene tras la auditoría T166.**

- [Evidencia T172](../reviews/evidence/T172/RESULTADOS.md): F1–F4 tienen
  reparación cerrada en T167–T171. Persisten límites de certificación, no
  fallos nuevos: recuperación de parciales desde la GUI, pérdida de
  alimentación y examen real de aula sin probar.
- Se borraron seis archivos del formato antiguo sin usuarios activos, una
  función y un import sin uso. La GUI detecta ahora declaraciones y parámetros
  sin uso en sus tres comprobaciones TypeScript.
- El arnés de aceptación ya no anuncia A-10 como pendiente: se retiró con la
  compatibilidad antigua. Pasaron sus 13 criterios vigentes contra el
  laboratorio SSH. La evidencia histórica se conservó y se aclaró su carácter
  histórico.
- `make check`, `make gui-check gui-build` (531 pruebas),
  `make docs-check tools-check`, aceptación y `git diff --check` correctos.
  Vitest necesitó salir del aislamiento por `EAI_AGAIN localhost`.
- Se retiraron ~786 MiB de instaladores locales antiguos y salidas de
  empaquetado, ignorados por Git. Los paquetes publicados 0.9.1 permanecen.
  Laboratorio apagado al terminar.

**Contexto anterior:** T170/T171 corrigieron F4 en `3f0ce82` y `ffc8dec`.
T169 resolvió F3 en `424bac4`; T168, F2 en `36e869d`; T167, F1 en `7fd7948`.
[Auditoría T166](../reviews/T166-AUDITORIA.md).

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
