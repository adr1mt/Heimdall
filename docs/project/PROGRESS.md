# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-16 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T178–T183 · Interfaz simplificada según la comparación con Teuton GUI.**

- Editor solo YAML con Monaco local; colores, pegado, búsqueda y Ctrl+S.
  Validación antes de guardar y conservación exacta del texto.
- Corregir con recuadro de modo examen y lista previa; resultados coloreados,
  detalle por alumno, cuatro secciones de analíticas y proyección simplificada.
- Usuario común, puerto 22 oculto, ayuda con índice y vista previa de notas.
- Go, 536 pruebas GUI, tipos y compilación correctos. Demo real por SSH con
  cinco alumnos: 100/80/60/40/20; máquina inaccesible sin nota, nunca cero.
- Editor, navegación, YAML inválido, primera ronda y parada verificados en
  Electron. Capturas oscuro/claro/proyector inspeccionadas.
  [Galería e informe](../reviews/evidence/T178-T183/RESULTADOS.md).
- Aula GISAR y proyector físico siguen pendientes en T070/T084.

**Contexto anterior:** T177 avisa de errores al abrir resultados; T176 retiró
las lecturas compartidas (ADR-0029). T172 cerró las reparaciones de T166.
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
- Editor YAML conserva texto; Monaco se empaqueta en un chunk diferido local.
- Autenticación por clave SSH pendiente (T023), sin caso de uso aún.

## Siguiente trabajo

**T070**: rehacer exámenes del curso en formato nativo; desbloquea **T084**,
examen real de aula que ejecuta Adrià. Consultar
`python3 scripts/tasks.py T070` antes de empezar. **T023** sigue READY.
