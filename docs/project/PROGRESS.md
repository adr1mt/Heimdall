# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-16 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**El actualizador en sesiones cortas** (rama `fix/actualizador-sesiones-cortas`,
sin publicar). La 0.9.2 de Adrià no pasó sola a la 1.0.0: la abrió 18 s y la
comprobación esperaba un minuto. Ahora comprueba a los 10 s, la descarga solo
se abandona tras un minuto parada (tope 30 min) y el registro va a
`~/.config/heimdall-gui/logs/actualizacion.log`. Probado con un AppImage
0.9.9 real que se actualizó solo a la 1.0.0 publicada
([evidencia](../reviews/evidence/actualizador-sesiones-cortas/RESULTADOS.md)).
Llega a las aulas con la próxima versión.

**Versión 1.0.0 publicada** antes del examen real de aula (T084 pendiente).

**T188 · El informe se deja en la máquina de cada alumno (ADR-0031).**

- Resultados tiene «Enviar informes…»: deja la página de T185 como
  `informe-<examen>.html` en la carpeta personal de cada alumno, en la máquina
  que se corrigió; si ya estaba, la sustituye. Nunca automático.
- Lo escribe el motor (`heimdall deliver`), con la contraseña de la clase por
  stdin. Solo envía si el examen y la clase no han cambiado desde la corrección
  y la máquina presenta la misma identidad; si no, dice por qué.
- Tras enviar: a quién le ha llegado, a quién no y el motivo; «Volver a
  enviar». Una máquina apagada no retrasa a las demás.
- Retirado el guardado local de T185
  ([evidencias](../reviews/evidence/T188/RESULTADOS.md)).

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
- examen-lab.ts está desfasado desde T178 (T186); ui-refresh cubre el modo examen.
- La barra de avisos pinta en rojo también los guardados correctos (T187).
- Un resultado cuyo examen o clase cambió después no se puede enviar: se
  vuelve a corregir. Los motivos de conexión fallida son frases técnicas.
- Un informe que contenga el texto de la contraseña de la clase no se envía
  (p. ej. contraseña «alumno» y una descripción que dice «alumno»).

## Siguiente trabajo

**T070**: rehacer exámenes del curso en formato nativo; desbloquea **T084**,
examen real de aula que ejecuta Adrià. Consultar
`python3 scripts/tasks.py T070` antes de empezar. **T023**, **T186** y
**T187** siguen READY.
