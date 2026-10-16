# ADR-0030 · La contraseña de las máquinas se guarda en cada clase

- Estado: **aceptada** · 2026-10-16
- Sustituye [ADR-0023](0023-la-contrasena-del-aula-se-recuerda-cifrada.md) y el
  punto 4 de [ADR-0021](0021-datos-propios-de-la-gui.md)
- Contexto: ADR-0009, principio 8, petición de Adrià

## Contexto

ADR-0023 guardaba una sola contraseña, cifrada aparte, y la pedía en la
pantalla de corregir. En el aula real cada clase tiene sus máquinas y su
contraseña, que conocen el profesor y los alumnos. La casilla de corregir y
el almacén cifrado protegen algo que no es secreto y añaden un paso que
Adrià quiere quitar.

## Decisión

1. Cada clase guarda **su contraseña de las máquinas**, en claro, en
   `classes.json`, junto al usuario común. Se escribe en el creador de clases.
2. Una clase sin contraseña no se guarda. Una clase antigua sin ella se puede
   abrir, pero «Corregir» avisa y no arranca hasta rellenarla.
3. Desaparecen la casilla «Contraseña del aula», el fichero cifrado y
   «Olvidar la contraseña guardada».
4. El resto de ADR-0009 sigue igual en el motor: la contraseña no entra en
   `aula.yaml`, ni en `argv`, ni en el artefacto, ni en ningún informe o
   exportación. Sigue viajando al motor solo por el sobre de stdin.
5. Un `password` por alumno sigue descartándose al leer y al pegar: la
   contraseña es de la clase, no de cada fila.

## Consecuencias

- Corregir y el modo examen arrancan sin teclear nada.
- Quien lea `classes.json`, o una copia suya, ve la contraseña. Es aceptable
  porque es la credencial compartida del aula. Si algún día hay una contraseña
  realmente secreta, hace falta otro ADR.
