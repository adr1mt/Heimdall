# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-05 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T176 · Retirada de lecturas compartidas por petición de Adrià.**

- La opción `fichero` y el selector adicional del formulario se retiran.
  Motor, parser y editor recuperan exactamente el estado anterior a T173.
- Se retiran arneses y fixtures de esa función. La medición T175 permanece
  como evidencia histórica: 65 ms y ~1 MiB de ahorro local no compensan
  la complejidad de preparar el examen; el informe crecía un 4,9 %.
- ADR-0029 sustituye ADR-0028. Suite rápida Go, 531 pruebas GUI y ambas
  compilaciones correctas; enlaces y herramientas correctos.
- Examen RA2 anterior aceptado; `fichero` se rechaza con exit 2 sin artefactos.
  [Evidencia T176](../reviews/evidence/T176/RESULTADOS.md).

**Contexto anterior:** T173–T175 implementaron y midieron lecturas compartidas,
retiradas en T176. T172 cerró higiene tras reparar F1–F4 de T166 en T167–T171.
Pasada visual GUI en `fb3206b`; paquetes 0.9.1 conservados.
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
