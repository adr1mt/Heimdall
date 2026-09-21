# ADR-0021 · Los datos propios de la aplicación

- Estado: **aceptada** · 2026-09-21
- Contexto: ADR-0009, ADR-0016, ADR-0017, principios 1, 2, 8 y 12

## Contexto

Hasta ahora la aplicación no guardaba nada suyo salvo una preferencia de la
máquina: la ruta del motor, en `settings.json`. Todo lo demás —quién es cada
alumno, con qué máquina, con qué usuario— vivía en el `aula.yaml` que el
profesor elegía con el explorador de ficheros en cada corrección.

La fase 6 introduce la **clase**: un grupo fijo que el profesor apunta una vez
y reutiliza en cada examen del curso (T106). Eso es dato propio de la
aplicación, no del motor, y no lo cubre ningún ADR. Antes de escribirlo hay que
decidir dónde vive y con qué garantías, porque son **datos de alumnado** y su
pérdida silenciosa es exactamente lo que el principio 2 prohíbe.

Hay además una frontera que no puede difuminarse. El motor es la fuente de
verdad de todo lo que afecta a una nota (principio 12) y habla por su contrato
nativo (ADR-0017). Nada de lo que la aplicación guarde por su cuenta puede
entrar en ese camino por una puerta lateral.

## Decisión

**1. La aplicación guarda sus datos propios en el directorio de datos de
usuario del sistema**, el que Electron llama `userData`, junto a
`settings.json`. Un fichero JSON por tipo de dato. Las clases van en
`classes.json`. No hay base de datos, ni carpeta inventada dentro del
repositorio, ni fichero escondido en la carpeta del examen.

**2. Toda escritura es atómica**: fichero temporal y `rename`. Un corte de luz
deja el fichero anterior entero, nunca uno a medias.

**3. Ningún dato propio de la aplicación llega a una nota.** Lo que se guarda
es una agenda: nombres, identificadores, direcciones y usuarios. El motor
seguirá recibiendo lo que siempre recibió —examen, aula y secretos por
stdin— y la nota seguirá saliendo del artefacto canónico. Si algún día un
dato guardado aquí quisiera influir en la nota, primero hay que cambiar el
contrato, no este fichero.

**4. Aquí no se escribe ninguna contraseña, nunca** (ADR-0009). Una clase
guarda a quién se conecta y con qué usuario; el valor de la credencial se
teclea en cada examen y muere con el proceso. El lector descarta cualquier
campo que no esté en el modelo, así que un fichero manipulado a mano no
introduce credenciales por la puerta de atrás.

**5. Un fichero de datos ilegible no se sustituye por los valores por
defecto.** Esta es la diferencia con `settings.json` y es deliberada:

| | `settings.json` | Datos de alumnado |
|---|---|---|
| Qué contiene | Preferencia de esta máquina | Trabajo del profesor |
| Si no se puede leer | Se abre con los valores por defecto | Se avisa y no se toca el fichero |
| Por qué | Volver a elegir la ruta cuesta diez segundos | Volver a apuntar 26 alumnos, no |

Un `classes.json` corrupto se reporta en pantalla con lo que falló, la
aplicación abre igual y **la escritura queda bloqueada** hasta que se
resuelva. Sobrescribirlo con una lista vacía sería borrar el trabajo del
profesor sin decírselo.

**6. Borrar una clase borra la agenda y nada más.** No toca `var/`, ni un
artefacto, ni una nota ya corregida. Pide confirmación porque es dato tecleado
a mano que no está en ningún otro sitio.

## Consecuencias

- El profesor apunta su grupo una vez al curso en lugar de una vez por examen.
- Los datos de alumnado quedan fuera del repositorio y fuera de cualquier
  copia de seguridad automática: T113 tendrá que ocuparse de eso a propósito.
- La aplicación pasa a tener estado propio que sobrevive a la desinstalación
  del motor. Es lo que se quería: la clase es del profesor, no del examen.
- Un segundo tipo de dato propio (exámenes recientes, T108) sigue esta misma
  regla sin volver a discutirla: su fichero, su escritura atómica, su
  tratamiento del fichero ilegible según lo que cueste rehacerlo.
