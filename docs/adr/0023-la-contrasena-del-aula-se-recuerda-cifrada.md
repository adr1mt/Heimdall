# ADR-0023 · La contraseña del aula se recuerda cifrada en la aplicación

- Estado: **aceptada** · 2026-09-22
- Sustituye el punto 4 de [ADR-0021](0021-datos-propios-de-la-gui.md)
- Contexto: ADR-0009, ADR-0021, principio 8

## Contexto

ADR-0021 decidió que la aplicación no escribiera nunca una contraseña: el
valor se teclea en cada examen y muere con el proceso. La regla se escribió
pensando en `classes.json`, donde una contraseña junto a los datos del
alumnado sería exactamente el error de Teuton.

El aula real no funciona así. Todas las máquinas usan la misma credencial y
la misma todo el curso. Teclearla antes de cada corrección no añade
seguridad: añade una ocasión de equivocarse con la clase delante, y empuja al
profesor a elegir una contraseña corta para poder escribirla deprisa.

ADR-0009 ya daba por supuesto un almacén cifrado en la aplicación: «la GUI
descifra en memoria y escribe el sobre JSON en el stdin del motor».

## Decisión

1. La aplicación **recuerda una contraseña**: la de las máquinas del aula. Se
   guarda al escribirla, sin preguntar y sin casilla que marcar.
2. Vive **cifrada con `safeStorage`** en un fichero propio del directorio de
   datos de usuario, aparte. Nunca en `settings.json` ni en `classes.json`:
   el punto 4 de ADR-0021 sigue vigente para esos dos ficheros.
3. **Sin cifrado disponible no se guarda nada.** El sistema que no ofrece
   `safeStorage` deja la aplicación como estaba: se teclea cada vez. No hay
   respaldo en claro.
4. Ajustes lleva **«Olvidar la contraseña guardada»**, con confirmación. Deja
   la casilla vacía y borra el fichero.
5. Nada de ADR-0009 cambia: la contraseña no entra en `aula.yaml`, ni en
   `argv`, ni en el artefacto, ni en ningún informe. El único camino hacia el
   motor sigue siendo el sobre por stdin.
6. Se guarda **una sola contraseña**, no una por máquina ni por alumno. La
   pantalla pide «la contraseña de las máquinas del aula» y el valor se aplica
   a todas las referencias que el aula generada pide.

## Consecuencias

- El profesor la escribe una vez por curso; el modo examen arranca solo.
- Un fichero cifrado más en el directorio de datos. Un disco robado no revela
  la contraseña sin la sesión del usuario.
- Si algún día hicieran falta credenciales distintas por máquina, esto no
  sirve y hay que abrir otro ADR: no se amplía de paso.
