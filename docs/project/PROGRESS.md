# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-16 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T185 · Informe por alumno generado por la app.**

- Resultados tiene «Informes por alumno…»: crea una carpeta nueva con una
  página HTML autocontenida por alumno, imprimible a PDF, para Moodle o correo.
- Cada página: alumno, examen, fecha, nota en la escala del profesor y cada
  comprobación por grupo como correcta, fallada o «no se pudo comprobar»
  (gris, trazo discontinuo, con su motivo y una nota que dice que no es fallo).
- Se construye por lista blanca desde el artefacto: sin comandos, salidas,
  contraseña, rutas ni otros alumnos. Excluidos sin informe. El título del
  examen solo se toma si el YAML coincide con la huella de la corrección.
- 537 pruebas GUI (valor envenenado), Go, tipos y build. `make gui-informes`
  contra el laboratorio: cuatro alumnos, uno con la máquina apagada
  ([evidencias](../reviews/evidence/T185/RESULTADOS.md)).

**Antes:** T184 guardó la contraseña de las máquinas en cada clase (ADR-0030).
T178–T183 simplificaron la GUI tomando Teuton GUI como referencia.

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

## Siguiente trabajo

**T070**: rehacer exámenes del curso en formato nativo; desbloquea **T084**,
examen real de aula que ejecuta Adrià. Consultar
`python3 scripts/tasks.py T070` antes de empezar. **T023**, **T186** y
**T187** siguen READY.
