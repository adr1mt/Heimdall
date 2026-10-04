# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-04 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T165 · Navegación de agentes y comprobaciones automáticas terminadas.**

- Entrada AGENTS, mapa de código/pruebas y consulta selectiva de tareas.
- README GUI corregido; relevo y alcance de revisión T160 documentados.
- CI preparado con suites existentes y enlaces; se activará tras el push.
- Go/versión, tipos, 525 tests GUI, build/preload y 5 tests de herramientas correctos.
- Evidencia: [T165](../reviews/T165-NAVEGACION.md).

**0.9.1 · Distribución pública y actualización automática comprobada.**

- Revisión de arquitectura terminada; registro cerrado como T160.
  T156–T159 incorporadas a los nuevos paquetes, además de T127–T155.
- T161 terminada: AppImage/.deb y motor embebido 0.9.1 reconstruidos.
- Suite Go completa con SSH, aceptación, secretos, sesiones, RA2 y 100 alumnos;
  tipos GUI y 525 tests en 33 archivos correctos.
- Editor, corrección, histórico, CSV y recuperación correctos. AppImage final
  y contenido del .deb comprobados con perfiles temporales y sandbox renderer.
- Modo examen: dos vueltas reales cada 5 min, un solo motor, nota/procedencia
  correctas, alumno terminado excluido, proyector y cierre correctos.
- T162 terminada: release v0.9.1 publicada como latest en GitHub.
  Código de release: 022f2e7. AppImage, .deb y SHA256SUMS con tamaño/digest
  GitHub idénticos a los paquetes comprobados. Descarga autenticada verificada.
- T164 terminada: actualización manual real de AppImage 0.9.0 a la descarga
  privada 0.9.1; GUI y motor correctos y clase guardada conservada.
- El propietario autorizó hacer público `adr1mt/Heimdall`; código y releases
  permanecen en el mismo repositorio. GitHub confirma PUBLIC, feed HTTP 200.
- T163 terminada: AppImage 0.9.0 descarga 0.9.1 sin autenticación, conserva
  el binario mientras está abierto y lo sustituye al cerrar con SHA-256 exacto.
  Reapertura GUI/motor 0.9.1 y clase guardada conservada; arnés exit 0.
- `make check` correcto. Notas de la release actualizadas en GitHub.
- Evidencia y reproducción: docs/releases/0.9.1/VERIFICACION.md.

## Problemas conocidos y límites

- El .deb se ejecutó extraído; no se instaló en el sistema: sudo requiere
  contraseña de administrador. No se tocó el perfil del profesor.
- Laboratorio en 127.1.2.3. Arneses SSH y de secretos se ejecutan secuencialmente.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos resueltos;
  inventario hasta 65536 bytes. PLAN no admitido se rechaza antes de SSH.
- Copias conservan notas y procedencia, sin salidas. Recuperación no sobrescribe.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; .deb mediante apt.
- Editor formulario reformatea YAML; edición directa conserva texto.
  Autenticación por clave SSH pendiente (T023), sin caso de uso aún.

## Siguiente trabajo

**T070** sigue desbloqueando **T084**, examen real de aula que ejecuta Adrià.
