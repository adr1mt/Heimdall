# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-05 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T173 · Lecturas compartidas de fichero.**

- `fichero` declara una captura por alumno, host y corrección. Cada requisito
  conserva nota y evidencia; comandos actuales y huellas antiguas se mantienen.
- Validación antes de SSH: fuentes excluyentes, ruta segura y timeout común.
  Reintentos y vueltas renuevan la captura; cancelación y presupuesto prevalecen.
- [Evidencia T173](../reviews/evidence/T173/RESULTADOS.md), ADR-0028.
  Suite rápida, race, enlaces y herramientas correctos.
- T174 (formulario) y T175 (medición Kea) en curso por petición expresa de Adrià.

**Contexto anterior:** T172 retiró residuos obsoletos tras reparar F1–F4 de
T166 en T167–T171. Pasada visual GUI en `fb3206b`; paquetes 0.9.1 conservados.
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
