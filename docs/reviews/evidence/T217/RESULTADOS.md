# T217 · Nombres breves en Lista y Matriz

2026-10-27. Base: `ddf6219`. Cambio limitado a presentación de resultados.

- Nombre único: `Biel`.
- Nombre compartido: `Ana F. S.` y `Ana B. R.`.
- Iniciales compartidas: `Alex Pérez Soler` y `Alex Puig Serra`.
- Nombre completo idéntico: se añade el identificador para distinguirlos.
- Mismo abreviado aunque se filtre, oculte, cambie orden o vista.
- Nombre completo en ayuda, lector y detalle. Informes/exportaciones y datos
  guardados mantienen los nombres originales.
- Columnas de profesor de 104 px al 100 %, frente a 144 px: 27,8 % menos.

El nombre se guarda como una sola cadena; se usa su primera palabra y se
abrevian las restantes sin intentar inferir nombres compuestos o apellidos.

## Comprobación

Las cinco pruebas nuevas fallaron antes de implementar y pasan después.
Cubren nombre único, coincidencias, iniciales coincidentes, nombres idénticos,
espacios/mayúsculas, nombres sin apellidos, vacío y orden independiente.
Suite GUI completa: **620 pruebas correctas**. Tipos, build y preload correctos.
`make check` correcto al inicio con caché temporal de Go.

Electron aislado con perfil temporal y alumnado ficticio, sin SSH ni IPC real:

- [Mediciones](proof.json): columnas de 104 px, abreviaturas esperadas,
  estabilidad tras ocultar/filtrar, Lista coherente y ayuda/detalle completos.
- [Portátil 1024×768](short-names-matrix-1024.png) y
  [1366×768](short-names-matrix-1366.png), capturas inspeccionadas.
- Regresión de densidad: 80/100/120 %, temas, teclado, cabeceras fijas,
  retención en refresco/error, Corregir y ajuste de proyector con 14 alumnos.
- Arnés existente de mejoras: proyector con 5/30 alumnos y 50 comprobaciones,
  filtro/resize, informes individual/masivo y refresco correctos.

Reproducir los arneses con los comandos de
[T216](../T216/RESULTADOS.md) y [T211–T213](../T211-T213/RESULTADOS.md).
El arnés de densidad incluye ahora los casos de nombres compartidos.

No se instala ni publica. Chromium redimensionado no equivale a prueba de aula.
Durante la sesión aparecieron cambios ajenos en `internal/probe/probe.go` y
`exams/ra1-v2/`; quedan fuera del alcance y del commit de esta tarea.
