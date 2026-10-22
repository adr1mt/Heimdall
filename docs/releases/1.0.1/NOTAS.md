# Heimdall 1.0.1

Reparaciones y protección de datos tras la revisión técnica del 22 de octubre.
Esta versión sustituye ambas publicaciones de 1.0.0 con un número superior:
quien conserve cualquiera de ellas podrá recibirla por el actualizador del
AppImage. El .deb se actualiza instalando el nuevo paquete.

- Una nota definitiva conserva su estado aunque quede pendiente un diagnóstico
  que no puntúa. La incidencia sigue visible por separado.
- Clases y contraseñas guardadas quedan privadas para el usuario del profesor;
  los permisos de instalaciones existentes se corrigen al leerlas.
- Los informes entregados por SSH solo pueden leerlos el usuario propietario y
  el administrador de esa máquina. Los antiguos se protegen al reenviarlos.
- Nuevas versiones recuperables de clases y exámenes. «Recuperar versión…»
  conserva el original; el examen se abre como borrador para validar y guardar.
- Consulta y descarga de actualizaciones usan la red de Chromium para evitar
  las rutas HTTP/TLS/Brotli de Node pendientes de parche en Electron.
- Se añaden controles automáticos de concurrencia y vulnerabilidades y un
  recorrido manual de validación de publicaciones con SSH y paquetes reales.
- sudo probado con contraseña incorrecta real, usuario sin privilegios y
  máquina sin sudo; estos problemas siguen sin convertirse en suspensos.

Linux x64. AppImage sin FUSE y .deb con motor incluido. Las sumas SHA-256 están
en SHA256SUMS. No se reutilizan versiones ni etiquetas publicadas.

## Límites que permanecen

La prueba de un examen completo con una clase real sigue pendiente (T084).
Las pruebas con alumnado ficticio no la sustituyen. Electron 43.8.3 conserva
Node 24.22.0: se ha mitigado la red del actualizador, pero falta actualizar el
runtime cuando Electron incorpore los parches. npm mantiene ocho avisos moderados
limitados a construcción y una excepción específica que se revisa al publicar.

Las copias de fuentes contienen la contraseña de la clase y son privadas;
conservan hasta 50 versiones de cada origen, máximo 4 MiB por fichero. Permanecen
en el mismo disco y no sustituyen una copia externa.

## Validación en GitHub

[Checks](https://github.com/adr1mt/Heimdall/actions/runs/39832488570) y
[validación de publicación](https://github.com/adr1mt/Heimdall/actions/runs/39832515560).
La prueba con clase real la realizará Adrià después de esta publicación.
