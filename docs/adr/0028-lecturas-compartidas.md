# ADR-0028 · Lecturas compartidas por alumno y corrección

- Estado: **aceptada** · 2026-10-05
- Caso: 30 alumnos, 15 comprobaciones sobre la configuración de Kea.
- Amplía ADR-0003; mantiene ADR-0018 y ADR-0025.

`fichero` declara una fuente de contenido, excluyente con `cmd` y `valor`.
Exige host lógico y ruta absoluta resuelta, sin NUL. Usa las sustituciones y
restricciones de secretos existentes. Solo admite aserciones de contenido.
Las comprobaciones de cada alumno con el mismo host y ruta literal resuelta
comparten timeout efectivo: cualquier diferencia se rechaza antes de SSH.
No se normalizan rutas ni se agrupan alias de hosts.

El motor ejecuta `cat -- ruta` al primer uso y conserva una captura por alumno,
host y ruta durante esa corrección. Los comandos intermedios no la invalidan.
Una nueva corrección, reintento o vuelta obtiene contenido nuevo. No se
optimizan automáticamente comandos existentes. El orden, los pesos y el
presupuesto permanecen; cancelación y presupuesto preceden al uso de captura.

La ejecución compartida es evidencia inmutable: cada comprobación obtiene
contenedores propios y su aserción independiente. Su detalle identifica el
fichero y el ID que originó la lectura; los tiempos y contadores de ejecución
describen la captura, no nuevas operaciones remotas. El JSON no cambia.
La caché libera su referencia al último uso, aunque los resultados mantienen
la evidencia necesaria. Se comparten también fallos técnicos de lectura.

Una lectura completa con exit distinto de cero produce FAIL de contenido,
con explicación y stderr, incluso si su salida parcial contiene lo esperado.
Una lectura incompleta conserva su causa técnica. El prefijo recortado se
interpreta según ADR-0025, sin inventar ausencia ni igualdad.

La modalidad entra explícitamente en el hash con campo omitido en exámenes
anteriores, preservando sus bytes. El editor conserva la declaración al
leer, duplicar y guardar. La medición cuenta operaciones en el transporte,
nunca suma evidencia duplicada. La reducción del tamaño del JSON queda fuera
de esta entrega: requiere otro diseño del contrato si la evidencia lo justifica.
