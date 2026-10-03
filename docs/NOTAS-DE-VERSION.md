# Notas de versión

Una entrada por versión publicada, en el idioma del profesor. El detalle
técnico está en el historial de commits y en
[PROGRESS.md](project/PROGRESS.md).

El número es uno solo para todo el producto: lo dice el fichero `VERSION` de
la raíz, el motor se sella con él al compilar y la aplicación lo lleva en su
paquete. `test/version.sh` comprueba que no se separan.

## 0.9.1 — 03-10-2026 (preparada para publicar)

Reparaciones de las dos auditorías y mejoras de la revisión de arquitectura:

- Las salidas recortadas y los comandos fallidos no producen aprobados sin
  prueba; los límites SSH y la cancelación dejan estados técnicos correctos.
- Guardar valida el borrador visible y conserva los errores y cambios pendientes.
- Reintentos e histórico conservan la cadena completa y sus notas.
- Las copias retienen las correcciones recientes y sus antecedentes, avisan
  si no pudieron guardarse y recuperan los datos sin sobrescribir originales.
- Pesos decimales, vueltas perfectas, clases corruptas y resultados incompletos
  se tratan de forma coherente; los lectores del motor y la aplicación usan
  los mismos criterios para aceptar resultados.
- Mejor contraste en ambos temas y actualizaciones aplazadas durante la corrección.
- La actualización comprueba tamaño y SHA-256 antes de instalar el AppImage.

AppImage y .deb reconstruidos con T156–T159. La revisión de arquitectura está
terminada. La prueba de aula con alumnado real sigue pendiente.
[Primera reparación](audits/2026-10-02/REPARACION.md),
[segunda reparación](audits/2026-10-02/post/repair/REPARACION.md) y
[recuperación de copias](audits/2026-10-03/RECUPERACION.md).

## 0.9.0 — 22-09-2026

Primera versión completa, lista para usarse en el aula. Todavía no se ha
corregido con ella un examen real de principio a fin: eso es lo que falta para
la 1.0.0.

**Corregir**

- Se abre un examen, se elige la clase y se corrige. El motor viaja dentro de
  la aplicación: no hay nada más que instalar.
- Modo examen: corrige la clase una y otra vez mientras dura la práctica y
  cada alumno se queda con su mejor vuelta entera, diciendo en pantalla de qué
  vuelta sale su nota.
- Modo proyector para enseñar el progreso en clase sin mostrar las direcciones
  de las máquinas.
- Lo que quedó sin evaluar se puede repetir sin mover el peso total ni la
  lista de comprobaciones.

**Las notas**

- Resultados enseña, de cada comprobación, el comando ejecutado, lo que
  contestó la máquina y lo que se esperaba.
- Exportación a hoja de notas y a CSV de Moodle, en la escala que elija el
  profesor.
- Copias de seguridad de las notas fuera de la carpeta del examen.

**Lo que protege la nota**

- Un problema técnico nunca es un suspenso, y con algo sin evaluar no hay nota
  final.
- Un alumno roto no bloquea al resto, ningún comando puede colgar la
  corrección y cancelar conserva lo ya corregido.
- La contraseña del aula se escribe una vez, se guarda cifrada y no aparece en
  ningún informe, log ni lista de procesos. Auditado de punta a punta
  ([modos de fallo](MODOS-DE-FALLO-HEIMDALL.md)).

**Lo que no hay**

- Paquete solo para Linux de 64 bits.
- Autenticación por clave SSH: hoy se corrige con usuario y contraseña.
- La actualización automática solo cubre el AppImage; el `.deb` lo lleva
  `apt`.
