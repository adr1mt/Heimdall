# ADR-0022 · El aula generada es un artefacto derivado de la clase

- Estado: **aceptada** · 2026-09-21
- Contexto: ADR-0009, ADR-0016, ADR-0017, ADR-0021, principios 8, 9, 10 y 12

## Contexto

El motor lee un examen y un aula que viven en la misma carpeta, y recibe el
nombre del fichero de aula aparte. Eso es una restricción del motor, y al
llevarla tal cual a la pantalla salió un modelo equivocado: el profesor elegía
dos ficheros, y de ahí se seguía —sin que nadie lo decidiera— que un examen
iba con un aula, o sea con una clase.

En el aula real no es así. El mismo «Examen DHCP» se corrige con 2SMX C y con
2SMX D. El examen es del curso; la clase es un grupo de personas; y no se
pertenecen. La clase, además, es del profesor y vale para todos los exámenes
(ADR-0021).

La restricción del motor no impide nada de eso: como el nombre del fichero de
aula viaja aparte, en una misma carpeta caben varias aulas y cada corrección
usa la suya. Lo que hacía falta era decidir **de quién es ese fichero**.

## Decisión

**El aula que la aplicación escribe es un artefacto derivado de la clase.** No
es un documento del profesor, no es fuente de verdad y no se edita. La fuente
de verdad es la clase guardada; el aula es su proyección para que el motor
pueda leerla, igual que el artefacto canónico es la proyección de una
ejecución (principio 12).

De ahí salen tres reglas, y no son preferencias:

**1. Nombre reservado y determinista.** El fichero generado se llama siempre
igual para la misma clase, derivado de su identificador, y con un prefijo que
la aplicación se reserva. No hay nombres al azar, no se acumulan copias y el
mismo par proyecto-clase produce siempre el mismo fichero.

**2. No puede pisar un aula escrita a mano, nunca.** El nombre reservado es
justo lo que da la garantía: un fichero que no lo lleve no lo escribe la
aplicación, y uno que lo lleve no lo ha escrito el profesor. Si en la carpeta
hay un `aula.yaml` suyo, sigue ahí intacto después de generar. Ante la duda no
se escribe: la aplicación falla y lo dice, antes que sobrescribir trabajo
ajeno (principio 2).

**3. Se regenera, no se conserva.** Cada corrección lo escribe de nuevo desde
la clase. Un cambio de IP en 2SMX C llega solo a la siguiente corrección, sin
que nadie sincronice nada. Y como es derivado, borrarlo no pierde nada: vuelve
a salir de la clase.

**Ninguna contraseña entra ahí.** El aula generada solo nombra la credencial
que hace falta, con una referencia; el valor lo teclea el profesor al corregir
y muere con el proceso (ADR-0009). Una contraseña literal en un inventario es
error de PLAN, y eso no cambia porque el inventario lo escriba la aplicación.

**El contrato con el motor no se toca.** El aula generada tiene el formato de
siempre y entra por donde entran todas. El motor no sabe —ni tiene por qué
saber— quién escribió el fichero que está leyendo (ADR-0017).

## Consecuencias

- El mismo examen se corrige con las clases que haga falta, y cada corrección
  deja su resultado con el nombre de su aula en el histórico.
- El profesor deja de elegir ficheros: elige un proyecto y una clase.
- La carpeta de un proyecto acumula un fichero por clase usada. Son derivados
  y se pueden borrar sin perder nada.
- Un examen que pidiera dos máquinas por alumno necesitaría que la clase diera
  dos direcciones. Hoy ninguno lo pide y no se construye por si acaso
  (principio 10); cuando aparezca, se decide entonces.
