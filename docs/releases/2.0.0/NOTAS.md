## Actualizar desde 1.0.2

Los exámenes e inventarios YAML de Heimdall 2 usan claves en inglés. Antes de corregir, adapta los archivos anteriores y valida cada examen en el editor. Por ejemplo, `examen` pasa a `exam`. Las descripciones, los nombres del alumnado y los comentarios pueden seguir en español. Las clases guardadas conservan sus columnas personalizadas. El editor de clases permite renombrar las que coincidan con las nuevas claves reservadas.

## Informes finales

- En **Notas finales** y **Histórico**, **Exportar informes…** guarda un HTML por alumno en el ordenador del profesor. Cada informe explica la mejor nota completa de su sesión y se puede recuperar con las máquinas del alumnado apagadas.
- **Preparar para Moodle…** crea un ZIP para una tarea individual. Revisa los destinatarios usando las carpetas de entregas descomprimidas de la misma tarea. Para actividades sin esas carpetas puedes adjuntar los HTML individualmente.
- El editor de exámenes incorpora ayuda de comprobaciones y zoom. Cada criterio y su peso se definen en el YAML.

Para Linux x64 se incluyen AppImage, paquete Debian y SHA256SUMS. La exportación ZIP requiere Python 3. [Guía de uso](https://github.com/adr1mt/Heimdall/blob/v2.0.0/docs/GUIA.md).
