# ADR-0031 · El informe de cada alumno se deja en su máquina

- Estado: **aceptada** · 2026-10-16
- Decisión de nombre por examen sustituida por [ADR-0038](0038-nombre-fijo-del-informe.md).
- Amplía ADR-0009, ADR-0011, ADR-0017 y ADR-0024; tarea T188
- Contexto: petición de Adrià (2026-10-16), informe por alumno de T185

## Contexto

Hasta ahora Heimdall solo **lee** en las máquinas del alumnado. El `send` de
Teuton dejaba un informe de texto en la máquina de cada alumno; Adrià quiere
lo mismo con la página clara de T185, y no quiere carpetas locales ni PDF.
Escribir en una máquina del alumnado es nuevo y tiene que estar acotado.

## Decisión

1. **Escribe el motor, no la GUI.** La GUI no tiene SSH y añadirle uno sería
   una dependencia y una segunda implementación de identidad, tiempos y
   credenciales. El motor ya tiene las tres. Subcomando nuevo:

   ```
   heimdall deliver --secrets=stdin --artifact=<resultado.json> --file=<nombre>
   ```

   Por `stdin` llegan dos cosas: la línea de secretos de siempre (ADR-0009) y,
   detrás, un JSON con el informe de cada alumno por `student_id`. Con
   `--secrets=env`, `stdin` lleva solo los informes. Ningún informe ni
   contraseña pasa por `argv` ni por un fichero temporal.
2. **Qué se escribe.** Un único fichero por alumno y examen: la página de
   T185, sin tocar. El nombre lo da la GUI y el motor solo acepta
   `informe-<letras, cifras y guiones>.html`. Un informe que contenga una
   contraseña de las recibidas no se envía.
3. **Dónde.** En la carpeta personal del usuario con el que se corrige, en la
   máquina del primer host que usa el examen para ese alumno (`host1` en las
   clases de la aplicación). Cada alumno recibe **solo su propio informe**: el
   motor lo empareja por `student_id` con la máquina del PLAN.
4. **Solo a la máquina corregida.** El motor rehace el PLAN con el examen y el
   aula que dice el resultado y exige el mismo `plan_hash`; si algo cambió
   desde la corrección, no envía nada (exit 2). La identidad de cada máquina
   tiene que ser la anotada en **esa** corrección (`HOST_KEY_ACCEPTED`,
   ADR-0011). Se comprueba antes de autenticarse, así que a una máquina
   distinta no le llega ni la contraseña. Sin identidad anotada —la máquina
   no respondió al corregir— no se envía.
5. **Permisos y si ya existe.** Se escribe en un temporal de la misma carpeta
   y se renombra encima: el informe anterior del mismo examen queda sustituido
   entero, nunca a medias. Permisos `0644`, dueño el usuario de la conexión.
   Un enlace con ese nombre se sustituye, no se sigue. Si hay un directorio
   con ese nombre, no se toca y se dice.
6. **Tiempo y aislamiento.** La conexión es la de la corrección (tres
   intentos, el tiempo de conexión del aula) y la escritura tiene 30 s. Los
   alumnos van en paralelo con la concurrencia del PLAN; una máquina apagada
   solo afecta a su alumno.
7. **Qué devuelve.** Una línea JSON por `stdout` con `kind: "delivery"`,
   `delivery_version: 1` y, por alumno, si le llegó y, si no, por qué. Exit
   `0` si llegó a todos, `3` si a alguno no, `2` si la petición no es válida.
   El artefacto no se modifica: el envío no cambia ninguna nota.
8. **Nunca automático.** Lo lanza el profesor con un botón en Resultados,
   tras una confirmación. Se retira el guardado de informes en una carpeta
   local de T185.
9. **Excepción acotada a «sin shell»**, como ADR-0024: la escritura remota es
   un programa `sh` de texto fijo que recibe el nombre como argumento
   posicional, sin interpolarlo.

## Consecuencias

- El contrato motor ↔ GUI gana un cuarto subcomando de lectura de resultado
  (§10 de `09-CONTRATO-GUI.md`); el flujo de eventos y el artefacto no
  cambian.
- Un resultado antiguo cuyo examen o clase se han tocado después ya no se
  puede enviar: se vuelve a corregir. Es el precio de no dejar nunca un
  informe en una máquina que no es la corregida.
- Quien use la máquina del alumno puede leer el informe; es su máquina y solo
  contiene lo suyo.
