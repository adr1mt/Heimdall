# Heimdall · guía de uso

Para el profesor que va a corregir con Heimdall. No hace falta programar ni
saber Go. Del cero a la primera nota, en unos veinte minutos.

Versión de esta guía: **1.0.1**.

---

## 1. Qué hace

Heimdall entra por SSH en la máquina de cada alumno, ejecuta las
comprobaciones del examen y calcula la nota con los pesos que fija el examen.

Tres reglas que conviene saber antes de empezar:

- **Un problema técnico nunca es un suspenso.** Una máquina apagada no da un
  0: esa comprobación queda *sin evaluar*, con el motivo escrito.
- **Si queda algo sin evaluar, no hay nota final**, solo una provisional
  marcada como tal. Se vuelve a intentar y entonces sí.
- **Todos los alumnos reciben las mismas comprobaciones y los mismos pesos**,
  pase lo que pase en las máquinas.

## 2. Qué hace falta

- Un ordenador con Linux de 64 bits. Windows y macOS todavía no.
- Las máquinas del alumnado encendidas, con **SSH abierto** y accesibles desde
  tu ordenador.
- **Un usuario y una contraseña que valgan en todas ellas.** En el aula real
  suele ser el mismo para todo el curso.

Nada más: el motor de corrección viaja dentro de la aplicación.

## 3. Instalar

Descarga uno de los dos paquetes de la
[última versión](https://github.com/adr1mt/Heimdall/releases/latest):

```bash
sudo apt install ./Heimdall-1.0.1.deb
```

o, si prefieres no instalar nada:

```bash
chmod +x Heimdall-1.0.1.AppImage
./Heimdall-1.0.1.AppImage
```

Desde el repositorio clonado, `make gui-dist` construye los mismos dos
paquetes en `gui/dist/`.

El `.deb` deja Heimdall en el menú de aplicaciones. Comprobado: el paquete
funciona en un equipo sin nada instalado.

## 4. Corregir el primer examen

### 4.1 Apunta la clase — una vez por curso

**Clases → Nueva clase.** De cada alumno se apunta:

| Campo | Qué es | Ejemplo |
|---|---|---|
| Identificador | cómo se llama en el examen | `alu1` |
| Nombre | el suyo, para leerlo en pantalla | `Alumna Primera` |
| Contacto | correo o identificador de Moodle | `alu1@centro.cat` |
| Máquina | dónde está su equipo | `10.0.2.31` |
| Usuario | con qué cuenta se entra | `alumno` |

El usuario inicial es `usuario`. Puedes cambiar **Usuario común** y pulsar
**Aplicar a todos**, o activar **Usuario por alumno** para las excepciones.
El puerto habitual, 22, queda oculto: activa **Puertos SSH** para otro puerto.
Los valores personalizados se conservan al ocultar la columna.

Escribe también la **contraseña de las máquinas** de la clase. Se guarda tal
cual con la clase, porque es la que conocen profesor y alumnos, y no aparece
en notas, resultados ni exportaciones. Esta lista se reutiliza en todos los
exámenes del curso.

Si el examen necesita un dato propio de cada alumno —su subdominio, el puerto
que le tocó—, añade una columna tuya y rellénala. El examen la lee con
`${alumno.subdominio}`.

### 4.2 Abre o escribe el examen

**Inicio → Nuevo…** crea una carpeta con su examen dentro. **El examen** es
un editor YAML con colores, números de línea y búsqueda. Puedes escribir el
examen o pegarlo completo: grupos, comandos, expectativas y pesos se definen
en ese mismo texto.

Si ya tienes el examen escrito, **Inicio → Abrir…** y elige su carpeta.

**Guardar** (o **Ctrl+S**) valida y guarda el borrador visible. Si el YAML contiene
un error, lo conserva y bloquea el guardado hasta corregirlo. Al salir con cambios
pendientes puedes volver al editor o descartarlos. El guardado conserva
el texto y los comentarios, sin reformatearlo. **Validar** permite comprobar
el borrador sin guardar ni elegir una clase. **Validar** y **Guardar** comprueban
el examen de forma independiente: formato, comprobaciones, pesos y referencias.
Los campos del alumnado pueden quedar pendientes; al corregir se comprueba
que la clase elegida tiene todos los datos y máquinas que el examen necesita.
Los pesos admiten decimales y cero para comprobaciones diagnósticas.

### 4.3 Corrige

**Corregir.** Elige la clase y adelante: la contraseña ya va con la clase. Si
la clase no la tiene, Corregir te lo dice y no arranca.

Antes de ejecutar verás el examen, la clase y los alumnos que se evaluarán.
Después verás cada alumno avanzar en tiempo real.

### 4.4 Mira y publica las notas

**Resultados** enseña la clase entera y, al pulsar sobre una comprobación,
qué comando se ejecutó, qué contestó la máquina y qué se esperaba. Un suspenso
siempre se puede enseñar; una avería también.

La lista y la matriz muestran aprobados en verde, suspensos en rojo y
comprobaciones pendientes en ámbar. Pulsa el nombre de un alumno para ver
sus comprobaciones agrupadas, y cada comprobación para abrir su evidencia.
La búsqueda está en la cabecera. **Más opciones** (⋮) reúne filtros, orden,
visibilidad de alumnos y acciones secundarias, también en el proyector. **Evaluados** muestra a quienes tienen evidencia de
conexión con su máquina en la corrección abierta, incluidos los que quedaron
incompletos. No equivale a tener nota final; una corrección que solo lee el
inventario no demuestra conexión.

Abre **Más opciones → Alumnos** y desmarca a quien quieras apartar de la lista y de la matriz,
por ejemplo si hoy no ha venido. Vuelve a marcarlo para recuperarlo o pulsa
**Mostrar todos**. En la lista del profesor también tienes el ojo tachado.
La selección se conserva al cambiar de vista, entrar o salir del proyector
y volver a corregir. Se reinicia al cambiar de clase o examen, o cerrar la
aplicación. **Restablecer** limpia filtros y orden, pero conserva los ocultos.

Ocultar solo cambia estas vistas: no modifica la clase, las notas, a quién
se corrige ni las exportaciones o informes. Los resúmenes, la media y las
comprobaciones con más fallos se consultan en **Analíticas**. Resultados
muestra la tabla sin esos resúmenes ni recuentos por comprobación.

Desde ahí se exportan:

- la **hoja de notas**, en el menú de más opciones;
- el **CSV de Moodle**, también en más opciones (**•••**), para subirlo.

Y con **«Enviar informes…»** cada alumno recibe en su máquina, en su carpeta
personal, una página con su nota y cada comprobación como correcta, fallada o
«no se pudo comprobar» (`informe.html`; cada envío sustituye el anterior, aunque sea de otro examen).
Solo la suya: sin comandos, salidas de las máquinas, contraseña ni datos de
otros alumnos. Se envía solo cuando lo pulsas, y solo a la máquina que se
corrigió: si el examen o la clase han cambiado desde entonces, hay que volver
a corregir. Al terminar se dice a quién le ha llegado y a quién no, y por qué
—por ejemplo, una máquina apagada—; «Volver a enviar» lo repite. Los
excluidos no reciben informe.

La escala —sobre 10, sobre 100— y dónde cae el aprobado se eligen en
**Ajustes**. La corrección guardada no cambia: el motor siempre calcula sobre
100 y la conversión es solo para leerlas. La vista previa muestra ejemplos
de notas con esa escala.

**Analíticas** reúne atención prioritaria, comprobaciones más falladas,
distribución de puntos y tasa de éxito por grupo. Sin nota final, un alumno
queda fuera de la media y de la distribución; nunca cuenta como un cero.

## 5. Mientras dura la práctica: el modo examen

En **Corregir**, el recuadro **Modo examen** permite elegir el intervalo y
pulsar **Iniciar modo examen**: corrige la clase una y
otra vez mientras dura la práctica, con el intervalo que le digas (5 minutos
como mínimo). Cada alumno se queda con su **mejor vuelta entera**, y en
pantalla se dice de qué vuelta sale su nota.

El **modo proyector** quita la barra lateral, agranda la letra y tapa las
direcciones de las máquinas, para enseñar el progreso en clase.

## 6. Cuando algo falla

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| «Sin evaluar» con un motivo | la máquina no contestó, la red falló, las credenciales no valían | arregla eso y vuelve a corregir: se repite solo lo que quedó sin evaluar, con el mismo examen y el mismo peso total |
| Un alumno entero sin nota | su máquina no llegó a responder | lo mismo; los demás no se ven afectados |
| «Configuración no válida» | el examen o la clase tienen un error | el mensaje dice el fichero y la línea. No se ha tocado ninguna máquina |
| No aparece nada en Resultados | la corrección no ha terminado | espera; ninguna comprobación puede colgarse para siempre |

Un alumno roto nunca bloquea al resto, y detener una corrección conserva lo ya
corregido. Al cerrar normalmente, la aplicación espera a que el motor guarde
las notas y termine su copia automática. Si la copia falla, lo avisa antes de
salir. Una terminación forzada del sistema puede interrumpir esta espera.

Se admiten hasta 2000 comprobaciones por corrección (alumnos × comprobaciones)
y 1 MiB de datos descriptivos resueltos. Una respuesta del inventario admite
hasta 65536 bytes. Los avisos de tamaño aparecen antes de conectar. El examen
necesita algún peso positivo; los diagnósticos con peso cero pueden acompañarlo.

La evidencia guardada tiene un presupuesto uniforme para toda la clase. Si se
recorta al guardar, se indica en el resultado; las comparaciones ya se hicieron
y las notas permanecen iguales.

## 7. Dónde queda todo

- Las **notas de cada corrección**, en la carpeta del examen, en `var/`.
- Una **copia de seguridad de las notas**, fuera de esa carpeta: borrar la
  carpeta del examen no se lleva las notas por delante. Guarda notas, no la
  salida de las máquinas.
- La **contraseña de las máquinas**, dentro de cada clase, en el directorio
  de datos de la aplicación. No está en las notas ni en ningún informe.
- El **histórico** de un examen se consulta desde la propia aplicación, y
  abrir una corrección antigua no toca ninguna máquina.

Las copias automáticas conservan las 50 correcciones más recientes por su fecha
real y todos los antecedentes que necesitan sus reintentos (hasta 50 eslabones
por cadena). Se hacen en segundo plano; si fallan, un aviso indica que no se creó la
copia aunque la corrección permanezca guardada en su carpeta.

## 8. Actualizaciones

La aplicación mira si hay una versión nueva publicada y, si la hay, la deja
descargada y avisa sin interrumpir. Se instala al cerrar el programa. Solo
funciona con el AppImage; el `.deb` se actualiza con `apt`. Si empieza una
corrección o el modo examen, aplaza la actualización y cancela la descarga en
curso. Las descargas tienen un límite de tiempo y tamaño y se comprueba que
su tamaño y huella coinciden con los publicados antes de instalarlas.
Lo que hace el actualizador queda anotado en
`~/.config/heimdall-gui/logs/actualizacion.log`.

Las versiones se publican en el
[repositorio público de Heimdall](https://github.com/adr1mt/Heimdall/releases).
Las descargas y el actualizador funcionan sin iniciar sesión en GitHub.

## 9. Desde la terminal

No hace falta para corregir, pero existe:

```bash
heimdall check ./examen-ra2                 # valida el examen sin tocar ninguna máquina
heimdall run --secrets=stdin ./examen-ra2   # corrige; la contraseña entra por stdin
heimdall version
```

Los códigos de salida discriminan: `0` todo evaluado · `2` configuración
inválida · `3` ejecución parcial · `4` cancelado.

---

¿Algo no encaja con lo que ves en pantalla? Es un fallo de esta guía: está
escrita sobre la versión 1.0.1.


## Recuperar clases o una versión del examen

Heimdall conserva automáticamente hasta 50 versiones por fichero al guardar
clases o exámenes. En **Clases** y en el **Editor**, usa **Recuperar versión…**
y elige la fecha de la copia. Se guardan en la carpeta privada
`copias-fuentes` de los datos de la aplicación. Puedes subir una carpeta en el
diálogo para localizar también las de un proyecto que hayas movido.

El examen se abre como borrador: compruébalo, valida y guarda para aplicarlo.
Si tienes cambios sin guardar, primero guárdalos o descártalos; recuperar no
los elimina. Para las clases se pide confirmación: se activa la lista elegida
y la actual se conserva en las copias, también si estaba dañada. Puedes
deshacerlo recuperando esa versión anterior. Una copia corrupta se rechaza y se
explica el motivo. El botón sigue disponible si la lista de clases no se lee.

Estas copias contienen los datos y la contraseña de la clase y solo tu usuario
puede leerlas. No se envían a Internet. Son distintas de las copias de notas y
no protegen frente a perder el disco entero: conserva también una copia del
equipo. Los archivos fuente de más de 4 MiB no se reemplazan automáticamente.


## Trabajar desde el portátil

El menú lateral puede contraerse a iconos con el botón de su parte superior.
En ventanas estrechas se contrae automáticamente hasta que elijas otra opción.
Cada icono mantiene el nombre de su acción al pasar el ratón o usar un lector
de pantalla. **Vista profesor** (icono de controles al pie) permite elegir
menú automático, expandido o de iconos y una escala de interfaz entre 80 % y
120 %. Ambas preferencias se recuerdan al volver a abrir Heimdall; puedes
restablecer la escala al 100 %. El zoom del proyector es independiente.

Lista y Matriz muestran solo el nombre de pila; si se repite en la clase,
añaden las iniciales de las palabras restantes. Si las iniciales también
coinciden, muestran los apellidos completos, y si todo el nombre coincide,
añaden el identificador. El abreviado se mantiene aunque filtres u ocultes
alumnos. Al pasar el ratón o abrir el detalle puedes consultar el nombre
completo. Los informes y exportaciones mantienen los nombres completos.
La lista usa iconos para **Enviar informe** y **Ocultar**. La matriz conserva
la columna de comprobaciones y las cabeceras
al desplazarse dentro de ella; también puedes enfocarla con Tab y desplazarte
con las flechas. La cabecera de la matriz muestra los nombres y la fila **Nota**, al pie,
muestra la nota principal. Un guion indica que no hay nota; la incompleta
conserva la etiqueta **Provisional**. En Corregir, el contexto y el
modo examen ocupan menos espacio y el progreso aparece antes del listado.

En **Corregir**, la clase se elige junto al título. La tarjeta azul de modo
examen ofrece el intervalo y la acción de inicio; debajo aparece toda la clase
en filas compactas. Los detalles de la sesión están plegados. Cualquier error
al recuperar la sesión se muestra también fuera del desplegable.

## Proyectar resultados y consultar informes desde Ubuntu Desktop

En el proyector, **+ / −** ajustan el tamaño y **Encajar** muestra
el contenido completo, incluidos todos los casos y alumnos visibles. Se
recalcula al cambiar el tamaño de ventana o filtrar. Si el grupo o el examen
son muy grandes, ajustar todo exige reducir el tamaño: usa + o los filtros
para leer una parte desde lejos. Arrastra la separación de la cabecera **Comprobación** para ajustar su ancho.
También puedes enfocarla con Tab y usar ← / →; Inicio o doble clic recuperan
el ancho automático. El ajuste se conserva al cambiar de vista y corregir
la misma clase. Las descripciones admiten dos líneas y su texto completo
sigue en la ayuda y en el detalle.

Mientras se corrige, se mantienen las últimas notas validadas. La franja azul
de modo examen reúne el reloj, Pausar/Reanudar y Finalizar examen. El reloj
muestra solo el tiempo hasta la próxima corrección; mientras se
corrige o se pausa, muestra ese estado. Si falla el arranque o la lectura, o se
cancela, las notas anteriores siguen visibles y se muestra el aviso. Cambiar
de examen o de clase limpia esos resultados para no confundir contextos.

La lista de corrección permite **Ocultar** a un alumno. También puedes hacerlo
antes de empezar desde **Corregir → Alumnos de la clase**, o recuperar alumnos
en **Resultados → Más opciones → Alumnos**. La selección se comparte entre
lista y matriz: solo cambia la presentación, se sigue evaluando a toda la
clase y las notas e informes conservan todos los alumnos. Cambiar de clase o
preparar otro examen restablece la selección.

La **Escala de interfaz** está en **Resultados → Más opciones**. El modo
proyector conserva sus propios controles de tamaño. El envío general de
informes está en Más opciones; al finalizar, **Enviar informes a todos**
entrega las mejores notas de la sesión tras confirmarlo.

Para abrir el HTML en el equipo con escritorio:

1. En **Ubuntu Desktop**, abre **Archivos** y pulsa **Ctrl+L**.
2. Escribe `sftp://USUARIO@SERVIDOR:PUERTO` con
   los mismos usuario, servidor y puerto que ya usas para SSH.
3. Introduce la contraseña de tu cuenta y entra en tu carpeta personal.
4. Copia `informe.html` a **Descargas** del equipo Desktop y abre esa
   copia con Firefox. Se mantiene el formato completo, incluso sin conexión.

Alternativa desde la terminal de **Desktop**, usando tus propios datos y el
nombre exacto del archivo que indica el profesor:

```bash
scp -P PUERTO USUARIO@SERVIDOR:informe.html ~/Descargas/
```

No ejecutes esta descarga dentro de la sesión SSH: el destino debe ser
Ubuntu Desktop. Si utilizas un salto SSH o un túnel, aplica el mismo acceso
a la copia. Un servidor que deshabilite SFTP puede seguir permitiendo la copia
con `scp -O` si admite el protocolo SCP tradicional.

No hay enlaces públicos ni un servidor web nuevo. Cada HTML contiene solo
los resultados de su alumno y tiene permisos privados. El acceso se protege
con su cuenta SSH; para impedir que otro alumno entre en ella, la cuenta o
máquina necesita credenciales propias. Una contraseña común de aula conocida
por todos no protege frente al acceso a máquinas ajenas (ADR-0037).

Documentación de referencia: [conectar con Archivos de Ubuntu](https://help.ubuntu.com/stable/ubuntu-help/nautilus-connect.html.en) y [opciones de SCP de OpenSSH](https://man.openbsd.org/scp).


## Pausar, reanudar y finalizar el examen

Mientras corriges, la matriz muestra las comprobaciones actuales y conserva
la mejor nota completa de cada alumno. Una máquina apagada o un error de SSH
no convierten esa nota en cero.

**Pausar** detiene las siguientes correcciones y mantiene la sesión abierta.
La corrección activa puede terminar; para interrumpirla ordenadamente usa
**Detener** en Corregir. No se fijan notas definitivas ni se envían informes.
Puedes editar el examen y cerrar Heimdall: al volver, la sesión está pausada.

**Reanudar** continúa la misma sesión y conserva sus notas y correcciones
compatibles, sin confirmaciones. Conserva la espera que quedaba al pausar;
no lanza una corrección inmediata. Si has cerrado y reabierto la aplicación,
espera un intervalo completo. Cambiar el intervalo también inicia una espera
completa del nuevo intervalo. Si cambias los criterios, la clase o el
umbral de aprobado, la siguiente corrección abre un registro separado sin
mezclar notas ni borrar el anterior. No hace falta crear otro examen.

**Finalizar examen** detiene la programación, espera la corrección activa y
cierra la sesión con la mejor nota válida de cada alumno. Abre automáticamente
la lista de **Notas finales**: alumno y mejor nota, sin contadores ni vuelta
de procedencia. Quien no completó ninguna corrección figura como **Sin nota
final**, nunca con un cero inventado. Si editaste el examen pero todavía no
has vuelto a corregir, se cierran las notas válidas de la sesión seleccionada;
el cambio del editor no las borra.

Tras finalizar, **Preparar otro examen** limpia la vista y vuelve a Corregir
sin clase seleccionada. Elige la clase y empieza cuando estés listo, también
si quieres repetir con la misma clase. El examen anterior permanece en el
Histórico; no se borran sus notas ni sus informes.

**Enviar informes a todos** pide confirmación antes de entregar. Cada informe
usa la corrección que produjo la mejor nota del alumno, aunque después apagara
su máquina. La lista muestra **Entregado** o **No entregado**; los fallos de
entrega no alteran la nota. **Reintentar no entregados** vuelve a pedir
confirmación y conserva los éxitos, también después de reiniciar Heimdall.
Los informes tienen nombre por sesión y no sustituyen los anteriores.
**Exportar notas** ofrece CSV y Moodle con las notas definitivas.

El **Histórico** muestra las sesiones del examen y la clase seleccionados,
diferenciando **Pausado** y **Finalizado**. Al abrir una finalizada se muestra
directamente su lista de notas. **Consultar correcciones** permite abrir sus
resultados anteriores; la procedencia se conserva para calcular las notas y
generar los informes. Los originales históricos permanecen intactos.

Para abrir el HTML en Ubuntu Desktop, usa Archivos, pulsa Ctrl+L y abre
`sftp://USUARIO@SERVIDOR:PUERTO` con tu cuenta SSH. Copia el archivo
`informe-final-….html` de tu carpeta personal a Descargas y ábrelo con Firefox.
No necesitas conexiones entrantes al Desktop ni enlaces públicos.
