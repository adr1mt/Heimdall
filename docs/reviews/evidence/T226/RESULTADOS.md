# T226 · Instalación en Zorin y demo local lista

2026-10-29. Petición de Adrià: instalar en su ordenador, añadir al menú de
aplicaciones y preparar una clase de prueba de 15 personas con comprobaciones
sencillas. Producto instalado: `4fb7faa` (T225, incluye T223/T224).

## Instalación y reparación

- Instalación por usuario en `/home/adr1/.local/share/heimdall/Heimdall.AppImage`,
  con icono propio y acceso `heimdall-gui.desktop` en el menú de aplicaciones de
  Zorin. `desktop-file-validate` correcto; base de accesos actualizada y arranque
  real mediante `gtk-launch heimdall-gui` comprobado. La app queda abierta.
- El motor no fallaba por ausencia del paquete: los ajustes guardados apuntaban
  a una carpeta antigua inexistente. Se establece `enginePath: heimdall`, la
  preferencia existente que resuelve de nuevo el motor incorporado al abrir.
  No se guarda una ruta efímera de montaje AppImage.
- La demo reciente apuntaba también a una carpeta antigua. Se añade y selecciona
  un examen nuevo en `/home/adr1/Documentos/Heimdall/Prueba-local-15`.
- Ajustes, proyectos, clases y almacenamiento local anteriores respaldados en
  una carpeta privada indicada en el [manifest](instalacion-local.json).
  La clase anterior conserva exactamente sus datos originales; se añade una
  clase con identificador independiente. No se eliminan proyectos ni resultados
  previos, no se toca la aplicación Teutón ni se requiere sudo.
- Copia instalada verificada por SHA-256 contra el paquete validado de T225.

## Demo

Fuente reproducible en `testdata/demo-local-15`: examen y clase ficticia.
Cinco preguntas sobre HTTPS, SSH, DNS, DHCP y bucle local; 15 alumnos con
respuestas variadas, entre cero y cinco aciertos. Identidades y contactos son
ficticios y usan example.invalid. No contiene datos de alumnado real.

El examen usa `hosts: []` y `valor:`: no conecta por SSH ni ejecuta comandos,
no necesita laboratorio ni servicios adicionales. La ficha lleva campos de
conexión ficticios y un marcador de contraseña no utilizado; la GUI no pide
credenciales al usuario. Las respuestas se pueden modificar desde Clases.
Las notas visibles respetan la escala y umbral que ya tenía el usuario.

## Verificación real

Desde la aplicación instalada, con su preload, IPC, motor y perfil habitual:

- Motor incorporado reconocido, versión 1.0.1, sin errores.
- Nueva clase seleccionada y 15 alumnos visibles antes de corregir.
- Botón Corregir operativo; ejecución completa de **75 comprobaciones**.
- Quince notas finales, porcentajes 100/80/60/40/20/0 repetidos, sin incidencias
  técnicas ni alumnos sin evaluar. La conversión de escala se conserva.
- Examen y clase elegidos quedan guardados al cerrar la verificación; apertura
  posterior desde el menú de Zorin confirmada. La app queda abierta para Adrià.
- La validación del examen con `heimdall check --exam-only` es correcta.
  `make check`, `make tools-check` y `make docs-check` correctos.

[Resultado de la corrección](correccion.json), [captura de 15 alumnos](resultados-15.png),
[instalación y copia anterior](instalacion-local.json).

La prueba de la instalación valida el cuestionario local. No certifica una
conexión SSH con máquinas del alumnado real ni una prueba de aula nueva. No se
publican paquetes, etiquetas ni se hace push. El producto conserva la versión
nominal 1.0.1 y el código del commit T225.
