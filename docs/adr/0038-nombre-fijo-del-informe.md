# ADR-0038 · Nombre fijo del último informe

- Estado: **aceptada** · 2026-10-27 · T215
- Informes finales exceptuados por [ADR-0039](0039-sesiones-persistentes-y-cierre-definitivo.md); el informe normal conserva este nombre.
- Sustituye la decisión de nombre por examen de ADR-0031; conserva ADR-0033 y ADR-0037.

## Decisión

Por petición expresa del profesor, la GUI entrega siempre `informe.html` en
la carpeta personal del alumno, tanto individualmente como en el envío masivo.
El título del examen permanece dentro de la página. Cada nuevo envío reemplaza
el informe anterior, aunque corresponda a otro examen: representa el último
enviado. No se borran archivos con los nombres antiguos.

El motor admite el nombre exacto `informe.html` además de los nombres nativos
anteriores `informe-<letras, cifras y guiones>.html`, para no romper clientes
que ya los usan. Sigue rechazando rutas, otros archivos y texto de shell.
La escritura conserva reemplazo atómico, permisos 0600, identidad SSH y PLAN.

Los recibos de la interfaz usan otra clave local: las marcas anteriores
acreditan el archivo por examen, no la existencia de `informe.html`.
No se añaden servicios, dependencias ni cambios de evaluación.
