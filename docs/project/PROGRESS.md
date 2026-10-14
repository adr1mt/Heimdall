# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-14 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T177 · Aviso visible al fallar la apertura de resultados.**

- Si no se pueden abrir las notas, el motivo aparece en la pantalla actual,
  también proyectando. Se retira el texto obsoleto de «siguiente entrega».
- Go, 531 pruebas GUI y compilación correctos. Los cuatro timeouts de cierre
  y recuperación eran restricciones del entorno a procesos hijos (EPERM):
  las 13 pruebas focalizadas pasan con permiso, sin tocar guardado ni copias.
- Arnés Electron reproduce el fallo antes y pasa después; capturas revisadas.
  [Evidencia T177](../reviews/evidence/T177/RESULTADOS.md).
- Aula GISAR y proyector físico no probados; se mantienen en T070/T084.

**Contexto anterior:** T176 retiró las lecturas compartidas a petición de Adrià;
ADR-0029 sustituye ADR-0028. T172 cerró las reparaciones de T166.
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
