# ADR-0034 · Versiones recuperables de clases y exámenes

- Estado: **aceptada** · 2026-10-22 · T200
- Amplía ADR-0021, ADR-0026 y ADR-0030 sin alterar las copias canónicas de notas.

## Decisión

Al guardar clases o YAML desde la aplicación se conserva tanto el contenido
anterior, si existe, como la versión propuesta antes de reemplazar el fichero
atómicamente. Si la copia falla, no se sustituye el original. Una versión
propuesta puede quedar recuperable aunque una escritura posterior falle: se
presenta como versión conservada, no como prueba de un guardado terminado.

Las copias viven en `userData/copias-fuentes`, separadas de las notas, en
carpetas 0700 y ficheros 0600. Contienen tipo, ruta de origen, fecha, SHA-256 y
bytes originales codificados en base64. No se cifra la contraseña de la clase
(ADR-0030); también está presente en estas copias privadas. No se envían a red.
Hasta 50 versiones por origen y 4 MiB por fichero fuente. La rotación conserva
siempre el original actual y la propuesta; no elimina una copia corrupta sin
avisar. Una fuente que supera el límite no se sobrescribe.

«Recuperar versión…» permite escoger un fichero mediante el diálogo nativo.
La copia se valida antes de usarla. La fecha y ruta de origen quedan en el
nombre/carpeta para poder localizar también versiones de carpetas anteriores.

- **Examen:** se carga como borrador; el original en disco sigue intacto hasta
  validar y guardar. No se descartan borradores sin guardar para recuperarlo.
- **Clases:** se solicita confirmación explícita, se conserva el fichero actual
  incluso si su JSON está dañado y se activa la lista validada de la copia.
  El original permanece recuperable; no se usa el guardado ordinario para
  saltarse el bloqueo de corrupción.

La recuperación no restaura notas, no toca máquinas y no cambia credenciales
en las máquinas. Para deshacerla se elige la versión conservada anterior.
