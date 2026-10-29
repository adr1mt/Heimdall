# ADR-0040 · Pausa explícita y lista final de notas

- Estado: **aceptada** · 2026-10-29 · T221, petición expresa del profesor.
- Amplía ADR-0039; sustituye su cierre de un registro vacío cuando solo hay
  cambios en el editor y su presentación de vueltas en la pantalla final.

Una sesión abierta puede estar `ACTIVE` o `PAUSED`. La pausa detiene el
planificador, borra las credenciales en memoria y conserva el registro, sus
vueltas y la intención pendiente de la vuelta activa. No solicita confirmación,
no fija orígenes finales ni envía informes. La activa puede terminar o recibir
la cancelación ordenada existente. Recuperar una sesión abierta sin su
planificador la deja pausada: no se corrige automáticamente al abrir la app.

Reanudar conserva la identidad y vueltas del registro compatible, incluso
cuando se selecciona desde el histórico. La separación de criterios de
ADR-0039 sigue vigente: si cambian las fuentes/PLAN, inventario o umbral, se
crea otro registro sin tocar las evidencias anteriores. Leer una sesión no
inicia registros nuevos ni cambia sus criterios. No se redefine la huella del
motor ni se suman aciertos de vueltas diferentes.

`Finalizar examen` es la única acción que fija los orígenes finales y cierra.
Detiene el planificador, persiste `FINALIZING`, espera la activa y reconstruye
las mejores notas de la sesión seleccionada. Una edición sin otra corrección
no sustituye sus notas válidas por un registro vacío. Una corrección posterior
sí usa los nuevos criterios. Se preserva la recuperación idempotente del cierre.

La matriz sirve durante la corrección. Al cerrar, o recuperar una finalizada,
Resultados muestra una lista de alumno y mejor nota, usando el umbral guardado
de la sesión. Se omiten procedencia, número de vueltas, filtros y resúmenes.
El histórico presenta sesiones como entradas principales y sus correcciones
bajo una consulta secundaria. Una selección explícita permite consultar una
corrección sin sustituir ni reabrir el registro finalizado.

El envío empieza solo al pulsar su acción y confirmar, también en reintentos.
Los recibos aparecen por alumno en la lista, sin resumen numérico. Un error
SSH de entrega queda como no entregado y no afecta a la nota. Cada HTML sigue
usando su propia mejor vuelta y el mecanismo inmutable de ADR-0039. CSV/Moodle
conservan sus garantías previas; los artefactos y manifiestos finalizados
anteriores no se migran ni reescriben al consultarlos.
