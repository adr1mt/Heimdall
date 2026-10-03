# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.
**Actualizado**: 2026-10-03 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión

**T159 · Recuperación de copias con escrituras concurrentes.**

- Los dos defectos preexistentes se reprodujeron con archivos ficticios en
  /tmp y dos procesos reales, con controles y pausas coordinadas sin retardos.
- Recuperación conserva una instantánea de toda la cadena: lectura acotada
  única, texto exacto preparado en un directorio privado del destino.
- Todas las cadenas se validan antes de publicar; antecedentes primero.
  No se vuelve a leer una copia que pudo cambiar tras validar la cadena.
- Publicación atómica mediante enlace duro: un original aparecido entre
  comprobación y publicación se conserva byte a byte y se cuenta como kept.
- Temporales eliminados ante éxito, conflicto y error; errores de escritura
  o publicación visibles. Sin fallback que pueda sobrescribir destinos.
- 9 regresiones nuevas, 525 tests GUI correctos; tipos y build GUI correctos;
  make check correcto con caché Go temporal escribible. GUI fuera del
  aislamiento porque localhost no resuelve dentro.
- Evidencia: docs/audits/2026-10-03/RECUPERACION.md.
- Base inicial 1d1f3fe, árbol limpio. Commit local; sin publicación ni nueva
  tarea encadenada. Implementa ADR-0026 sin cambiar su política.

## Estado anterior

- T156–T158 terminadas: lectores acotados, corpus común de 72 artefactos y
  recorrido compartido de cadenas. La revisión de arquitectura ya terminó.
- T127–T155: 18 incidencias iniciales y 11 posteriores reparadas.
  Evidencia en docs/audits/2026-10-02/ y su subdirectorio post/repair/.
- AppImage/.deb 0.9.0 anteriores: pendientes de reconstruir con T156–T159.

## Problemas conocidos y límites

- Laboratorio en **127.1.2.3**. Arneses que cuentan conexiones o buscan
  secretos globalmente se ejecutan de forma secuencial.
- Reintentos: mismo PLAN y máximo 50 eslabones. Modo examen: mínimo 5 min.
- Hasta 2000 celdas y 1 MiB de metadatos resueltos;
  inventario hasta 65536 bytes. PLAN no admitido se rechaza antes de SSH.
- Evidencia recortada tras comparar, con aviso; copias conservan notas,
  comprobaciones y procedencia, no salidas.
- Cierre normal espera resultado y copia; cierre forzado puede interrumpirlo.
- Linux x64. Actualización automática solo AppImage; .deb mediante apt.
  No se ha instalado una actualización desde una release real.
- Editor formulario reformatea YAML; edición directa conserva texto.
  Autenticación por clave SSH pendiente (T023), sin caso de uso aún.

## Siguiente trabajo

Desde casa: reconstruir paquetes y comprobar la aplicación completa con las
últimas mejoras; publicación y actualización real después.
**T070** sigue desbloqueando **T084**, examen real de aula que ejecuta Adrià.
