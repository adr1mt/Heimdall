# Heimdall 0.9.1

Reparaciones de las dos auditorías y mejoras de la revisión de arquitectura.

- Las notas requieren evidencia suficiente; los fallos técnicos quedan sin evaluar.
- El editor conserva el borrador visible y sus errores, sin guardar otro texto.
- Reintentos, histórico y copias conservan sus cadenas y la procedencia de las notas.
- Recuperación de copias sin sobrescribir originales, incluso con otro proceso escribiendo.
- Lectores del motor y la interfaz con criterios comunes y límites de tamaño.
- Cierre que espera resultados y copias; actualizaciones aplazadas durante correcciones.
- Verificación de tamaño y SHA-256 antes de instalar una actualización.

Linux de 64 bits. El motor va incluido en ambos paquetes. El AppImage incorpora
el actualizador; el .deb se instala o actualiza con apt. Las sumas de los dos
paquetes están en SHA256SUMS.

Esta release se publica en el repositorio privado actual. La actualización
automática necesita un canal de distribución accesible sin iniciar sesión;
hasta decidir ese canal, las descargas son manuales desde GitHub.

Comprobados motor, interfaz, editor, corrección SSH, histórico, CSV, restauración
y pantallas de ambos paquetes con datos ficticios. La prueba final de aula
con alumnado real sigue pendiente y continúa siendo requisito para 1.0.0.
