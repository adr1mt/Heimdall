# ADR-0033 · Informes privados del alumno

- Estado: **aceptada** · 2026-10-22
- Modifica solo los permisos del punto 5 de [ADR-0031](0031-informe-en-la-maquina-del-alumno.md); tarea T196
- Contexto: auditoría técnica contrastada y autorización de Adrià

El informe contiene una nota y evidencia individual. Otros usuarios locales de
la máquina no necesitan leerlo, aunque puedan atravesar la carpeta personal.

La entrega crea y sustituye el informe con permisos **0600**, con dueño igual al
usuario de la conexión SSH. El temporal también es privado desde su creación.
Se conservan la escritura atómica, el reemplazo de enlaces sin seguirlos y el
rechazo de directorios. Un informe antiguo se protege al volver a enviarlo; no
se recorren ni alteran otros archivos de las máquinas del alumnado.

La prueba SSH comprueba permisos y dueño después de dos entregas y verifica
que sustituir un enlace no cambia el contenido ni los permisos de su destino.
