# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-16 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T184 · La contraseña de las máquinas va en cada clase (ADR-0030).**

- El creador de clases pide «Contraseña de las máquinas» y la guarda en claro
  en `classes.json`; sin ella la clase no se guarda y Corregir no arranca.
- Retirados la casilla de Corregir, el almacén cifrado y «Olvidar» de Ajustes.
- El motor no cambia: la contraseña sigue entrando solo por stdin, nunca en
  aula.yaml, argv, artefacto, copias ni exportaciones.
- 530 pruebas GUI, Go, tipos y build. secretos.sh entero y ui-refresh por SSH
  con cinco alumnos y modo examen. ui-refresh falló una vez por tiempos en el
  paso del editor y pasó al repetir.

**Antes:** T178–T183 simplificaron la GUI tomando Teuton GUI como referencia
([galería](../reviews/evidence/T178-T183/RESULTADOS.md)). T177 avisa de errores
al abrir resultados; T176 retiró las lecturas compartidas (ADR-0029).

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

## Siguiente trabajo

**T185**: informe por alumno generado por la app, pedido por Adrià.
**T070**: rehacer exámenes del curso en formato nativo; desbloquea **T084**,
examen real de aula que ejecuta Adrià. Consultar
`python3 scripts/tasks.py T070` antes de empezar. **T023** sigue READY.
