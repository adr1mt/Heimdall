# Estado del proyecto

**Actualizado**: 2026-11-22 · **Fase**: 9 — Endurecimiento y publicación

## Última sesión
**T230:** exportación HTML local y ZIP individual importado en Moodle 4.5.16+. Paquetes locales verificados, pendientes de instalación. [Evidencia](../reviews/evidence/T230/RESULTADOS.md).
**Aplicación genérica:** exámenes YAML con comandos o valores y aserciones. [Decisión](../adr/0044-examen-declarativo.md).
**T228:** actualizaciones publicadas en 1.0.2. [Evidencia](../reviews/evidence/T228/RESULTADOS.md).
**T229:** YAML de examen e inventario en inglés. Las clases antiguas conservan sus columnas propias.
El editor permite renombrar las que coinciden con claves del aula antes de corregir.
Auditoría: 671 pruebas GUI correctas; guías de descarga y desarrollo identificadas.
[Formato y decisión](../adr/0042-yaml-en-ingles.md). Compilado, pendiente de instalación.
**T235:** zoom y ayuda desde el editor. [Evidencia](../reviews/evidence/T235/RESULTADOS.md).
[Auditoría AutoCheck](../research/AUTOCHECK-2026-11-05.md).

**T227 terminado:** controles de aula simplificados, ocultación compartida y
preparación de otro examen con histórico conservado; pendiente de instalación.

**T226 instalado y abierto desde el menú de Zorin:** T225 con motor embebido.
Rutas y clase conservadas. Demo local sin SSH: 15 alumnos ficticios, 75 comprobaciones correctas. [Evidencia](../reviews/evidence/T226/RESULTADOS.md).

**T225 terminado:** dependencias y empaquetado Linux actualizados, sin avisos
npm; 643 pruebas GUI, motor/SSH y editor real correctos. [Evidencia](../reviews/evidence/T225/RESULTADOS.md).

**T221 instalado:** Pausar conserva una sesión abierta
recuperable; Reanudar mantiene su identidad, vueltas y mejores notas compatibles.
Cambiar criterios separa registros automáticamente. Finalizar espera la activa,
fija las notas válidas y abre una lista limpia de alumno/mejor nota, también
al reabrir. Histórico por sesiones; informes confirmados y reintentos con estado
por alumno, sin afectar notas por SSH. Exportación CSV/Moodle conservada.
[Evidencia](../reviews/evidence/T221/RESULTADOS.md).
[Decisión](../adr/0040-pausa-explicita-y-lista-final.md).

## Problemas conocidos y límites

- No se infieren sesiones anteriores sin manifiesto. Compatibilidad conservadora:
  un cambio textual también puede separar registros. Artefactos originales
  necesarios para reconstruir; no protege frente a pérdida del disco.
- Informes finales privados por sesión; Desktop los recupera por SFTP/SSH.
  La privacidad entre alumnos exige credenciales propias; contraseña común no aísla.
- Si faltan eventos, el resultado se recupera mediante la intención guardada.
- Copias de notas: 128 MB es heap V8 probado, no RSS ni cualquier examen.
- Fuentes: 50 versiones/origen, 4 MiB, privadas. Clases guardan contraseña.
- Laboratorio en 127.1.2.3; arneses SSH/secretos secuenciales. Sin sudo: 2298.
- Reintentos: mismo PLAN, 50 eslabones. Examen: mínimo 5 min.
- Hasta 2000 celdas, 1 MiB de metadatos e inventario de 65536 bytes.
- Cierre normal espera resultado/copia; cierre forzado puede interrumpirlo.
- Linux x64. AppImage/.deb. Editor conserva texto; Monaco diferido local.
- Informe normal exige fuentes vigentes; final usa fuentes conservadas verificadas.
- Un informe con la contraseña de la clase no se envía.
- Electron 45.1.0 incorpora Node 24.22.1; herramientas Node 26.13.0/npm 12.2.1.
- Go: aviso OpenPGP del módulo SSH, sin importar ni incluir ese paquete.
- Dependencias internas respetan las versiones compatibles fijadas upstream.

## Siguiente trabajo

T231 y T234 READY; T070, T023 y T186 siguen READY. T084 espera aula.
T223/T224/T225 instalados (T226); T227, T229 y T235 compilados, pendientes de instalación.
Sin publicación nueva autorizada.
