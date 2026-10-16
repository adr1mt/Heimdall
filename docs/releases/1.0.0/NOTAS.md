# Heimdall 1.0.0

Primera versión estable. Sobre la 0.9.2:

- Los exámenes se escriben directamente en YAML, con un editor con colores,
  búsqueda y Ctrl+S que funciona sin conexión. El formulario de exámenes
  desaparece.
- Resultados vuelve a enseñarse en colores, con detalle por alumno, cuatro
  secciones de analíticas y vista previa de notas. La ayuda tiene índice.
- Cada clase guarda la contraseña de sus máquinas junto al usuario común: ya
  no se pide al corregir.
- «Enviar informes…» deja a cada alumno, en su carpeta personal y en la máquina
  que se corrigió, una página con su nota y cada comprobación: correcta,
  fallada o no comprobada. Sin comandos, salidas, contraseña ni datos de otros
  alumnos. Dice a quién le ha llegado y por qué no a los demás.

Linux de 64 bits. El motor va incluido en ambos paquetes. El AppImage incorpora
el actualizador; el .deb se instala o actualiza con apt. Las sumas de los dos
paquetes están en SHA256SUMS.

Queda pendiente corregir con ella un examen real de aula de principio a fin.
