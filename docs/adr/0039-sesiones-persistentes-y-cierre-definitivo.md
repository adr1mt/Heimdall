# ADR-0039 · Sesiones persistentes, cierre e informes definitivos

- Estado: **aceptada** · 2026-10-28 · T220, petición expresa del profesor.
- Amplía ADR-0020/0025; sustituye su exclusión automática de alumnos con máxima
  en la GUI. Amplía ADR-0031/0037 y exceptúa los informes finales del nombre
  reemplazable de ADR-0038. La CLI conserva su opción explícita `--session`.

La mejor nota y la última fotografía de la máquina responden a preguntas
distintas. Se conserva la elección de vuelta completa del motor, sin sumar
aciertos de intentos diferentes; la GUI reevalúa toda la clase para enseñar
el estado actual incluso después de un 10. Solo el profesor cierra la sesión.

El proceso principal registra automáticamente cada corrección en un manifiesto
privado y durable: identidad, clase, examen, fechas, umbral de aprobado,
huellas de fuentes/PLAN, referencias y huellas de artefactos. No copia notas
ni evidencias. Conserva una sola vez las definiciones sin credenciales, para
reproducir el PLAN de informes históricos. La vista y las notas se reconstruyen
con `heimdall session`. La retención de copias de notas no elimina originales
ni manifiestos. Perder el disco queda fuera de esta garantía, como ADR-0026.

Cada conjunto consecutivo de fuentes compatibles forma un registro distinto;
si cambia el examen, el inventario o el umbral, se abre otro y se conserva el
anterior. La compatibilidad usa las huellas canónicas existentes: también un
cambio textual no académico puede separar registros, porque el PLAN actual
incluye los bytes de las fuentes. No se altera esa decisión del motor aquí.
No se deducen fronteras de sesiones antiguas que carecen de manifiesto.

`Finalizar examen` persiste primero la intención `FINALIZING`, rechaza nuevas
vueltas y espera a la activa sin cancelarla. Después valida los artefactos,
reconstruye las mejores notas y guarda `FINALIZED`, fecha y origen de cada
nota. Estos orígenes y huellas fijan las notas sin crear otra copia numérica.
Un cierre interrumpido se completa al recuperar; uno ya finalizado es
idempotente. Una corrección posterior crea otra sesión. Sin vueltas completas
no hay nota, ni cero, ni informe final enviable. Si cambiaron los criterios
sin una nueva vuelta, el último conjunto queda sin notas y el anterior intacto.

Solo una confirmación del profesor inicia la entrega. Cada HTML utiliza la
vuelta ganadora de su alumno. Se agrupan los destinatarios por artefacto para
reutilizar `deliver`, sus límites, concurrencia, identidad SSH y comprobación
de secretos. `--source-dir` admite las definiciones conservadas únicamente
para `informe-final-<id>.html`; exige reconstruir exactamente el `plan_hash`
del artefacto original. No permite redirigir el informe a otra máquina.

Los finales se crean con enlace atómico sin reemplazo, nombre por sesión y
permisos `0600`; un archivo idéntico permite reintentar una entrega incierta.
Otro contenido, enlace o directorio se conserva y produce un error. El informe
normal sigue siendo `informe.html`. Los recibos de envío se guardan antes y
después de cada grupo, sin HTML ni contraseña; un éxito no se vuelve a enviar.
Se fija la escala del primer envío para que los reintentos produzcan el mismo
HTML. El umbral académico es siempre el de la sesión.

No se encontró acceso directo configurado al Desktop. Se conserva la
recuperación por Archivos/SFTP mediante la cuenta y conexión SSH existentes,
sin puertos entrantes en Desktop, infraestructura ni enlaces públicos. La
privacidad sigue dependiendo de cuentas/credenciales propias (ADR-0037).
