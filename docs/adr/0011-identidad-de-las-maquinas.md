# ADR-0011 · La identidad de la máquina se fija por ejecución, no entre cursos

- Estado: **aceptada** · 2026-09-20
- Cierra: **D-3** de `08-DECISIONES-ABIERTAS.md`
- Contexto: `FAILURE-MODES.md` F-12, `PROPOSAL.md` §D-3, `security.md` §«Máquinas
  y red», ADR-0010

## Contexto

Teuton hereda el `known_hosts` del profesor. Eso fue lo que tumbó el primer
intento de esta investigación (F-12): una sola entrada previa para la dirección
del laboratorio deja la ejecución entera sin evaluar.

El prototipo lo sustituyó por un `known_hosts` propio del proyecto en
`var/known_hosts`, con confianza en el primer uso. Era provisional a propósito:
es una decisión de seguridad y no se cierra por comodidad.

El dato que faltaba lo pone el aula real: **el alumnado examina sobre máquinas
virtuales desechables** (IsardVDI o VirtualBox), una por examen. La identidad de
la máquina es nueva en cada examen por diseño. Un fichero que recuerda la
identidad del examen anterior no protege de nada: lo único que puede producir es
un aula entera rechazada el día del examen, que es exactamente el fallo que se
quería evitar.

## Decisión

El motor no guarda identidades entre ejecuciones. No hay fichero
`known_hosts`.

1. La identidad que presenta cada máquina se anota **en memoria, durante la
   ejecución**, junto a su huella SHA256.
2. La primera vez que se ve una dirección, se acepta y se deja constancia en
   `warnings` con la huella (`HOST_KEY_ACCEPTED`). Una vez por máquina y
   ejecución, no una por comprobación.
3. Si esa misma dirección responde después con **otra** identidad, se rechaza:
   las comprobaciones de ese alumno salen `UNEVALUATED` con
   `CONNECT_FAILED` y el motivo escrito. No se reintenta, porque volver a
   preguntar solo repetiría la misma respuesta.
4. Nunca se toca el `known_hosts` del profesor, ni para leerlo ni para
   escribirlo.

## Qué garantiza y qué no

Garantiza que **dentro de una ejecución** todas las comprobaciones de un alumno
se corrigen contra la misma máquina, y que la huella de cada una queda escrita
en el informe, de modo que un cambio es auditable después.

No garantiza que la máquina sea la que el profesor cree la primera vez que la
ve. Con máquinas desechables eso no lo puede garantizar ningún mecanismo
automático: no existe una identidad previa que comparar. Queda dicho aquí y en
el informe en vez de disimulado.

## Alternativas descartadas

- **Exigir registro previo de cada máquina.** Es lo más estricto y no encaja:
  las máquinas se crean para el examen, a veces el mismo día. El coste sería un
  aula sin evaluar cada vez que se reinstala algo, y el principio 4 dice que
  ningún alumno puede bloquear la evaluación.
- **No comprobar nada y avisar.** Pierde incluso la coherencia dentro de la
  ejecución: media corrección contra una máquina y media contra otra seguiría
  produciendo una nota.
- **Mantener `var/known_hosts` entre ejecuciones.** Es la opción del prototipo.
  Con máquinas desechables produce un rechazo por alumno en cada examen y una
  orden de «borrar el registro» que el profesor acabaría ejecutando siempre, sin
  mirar. Un control que siempre se salta no es un control.

## Consecuencias

- Desaparecen `var/known_hosts` y la opción que lo apuntaba. `var/` vuelve a
  contener solo artefactos.
- El informe gana la huella de cada máquina. La GUI puede compararla entre
  ejecuciones si algún día hace falta; el motor no lo hace por su cuenta
  (principio 10).
- La entrada por clave SSH **no** entra aquí: el aula usa contraseña. Queda
  anotada como T023 y no se implementa sin un caso real.
- Si algún día el examen se hace sobre máquinas permanentes, esta decisión se
  revisa con un ADR nuevo: el mecanismo de registro ya existe y solo habría que
  darle persistencia.
