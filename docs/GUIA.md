# Heimdall · guía de uso

Para el profesor que va a corregir con Heimdall. No hace falta programar ni
saber Go. Del cero a la primera nota, en unos veinte minutos.

Versión de esta guía: **0.9.0**.

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

Hoy la aplicación se construye desde el repositorio; todavía no hay una
descarga publicada. Con el repositorio clonado:

```bash
make gui-dist
```

Deja dos ficheros en `gui/dist/`. Elige uno:

```bash
sudo apt install ./gui/dist/Heimdall-0.9.0.deb
```

o, si prefieres no instalar nada:

```bash
chmod +x gui/dist/Heimdall-0.9.0.AppImage
./gui/dist/Heimdall-0.9.0.AppImage
```

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

Aquí **no se escribe ninguna contraseña**. Esta lista se reutiliza en todos
los exámenes del curso.

Si el examen necesita un dato propio de cada alumno —su subdominio, el puerto
que le tocó—, añade una columna tuya y rellénala. El examen la lee con
`${alumno.subdominio}`.

### 4.2 Abre o escribe el examen

**Inicio → Nuevo…** crea una carpeta con su examen dentro. **El examen** es
la pantalla donde se escribe cada comprobación en un formulario: qué comando
se ejecuta en qué máquina, qué se espera y cuánto pesa.

Si ya tienes el examen escrito, **Inicio → Abrir…** y elige su carpeta.

**Guardar el examen** valida y guarda el borrador visible. Si el YAML contiene
un error, lo conserva y bloquea el guardado hasta corregirlo. Al salir con cambios
pendientes puedes volver al editor o descartarlos. Guardar desde la vista YAML
conserva su texto y comentarios; editar en el formulario vuelve a formatearlo.
Los pesos admiten decimales y cero para comprobaciones diagnósticas.

### 4.3 Corrige

**Corregir.** Elige la clase, escribe la contraseña de las máquinas y adelante.

La contraseña se guarda cifrada en tu ordenador, así que solo se escribe la
primera vez. Se olvida desde **Ajustes**.

Verás cada alumno avanzar en tiempo real.

### 4.4 Mira y publica las notas

**Resultados** enseña la clase entera y, al pulsar sobre una comprobación,
qué comando se ejecutó, qué contestó la máquina y qué se esperaba. Un suspenso
siempre se puede enseñar; una avería también.

Desde ahí se exportan:

- la **hoja de notas**, para ti;
- el **CSV de Moodle**, para subirlo.

La escala —sobre 10, sobre 100— y dónde cae el aprobado se eligen en
**Ajustes**. La corrección guardada no cambia: el motor siempre calcula sobre
100 y la conversión es solo para leerlas.

## 5. Mientras dura la práctica: el modo examen

En **Corregir** puedes encender el **modo examen**: corrige la clase una y
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
corregido.

## 7. Dónde queda todo

- Las **notas de cada corrección**, en la carpeta del examen, en `var/`.
- Una **copia de seguridad de las notas**, fuera de esa carpeta: borrar la
  carpeta del examen no se lleva las notas por delante. Guarda notas, no la
  salida de las máquinas.
- La **contraseña**, cifrada, en el directorio de datos de la aplicación, en
  un fichero aparte. No está en la clase, ni en las notas, ni en ningún
  informe.
- El **histórico** de un examen se consulta desde la propia aplicación, y
  abrir una corrección antigua no toca ninguna máquina.

Las copias automáticas conservan las 50 correcciones más recientes por su fecha
real. Se hacen en segundo plano; si fallan, un aviso indica que no se creó la
copia aunque la corrección permanezca guardada en su carpeta.

## 8. Actualizaciones

La aplicación mira si hay una versión nueva publicada y, si la hay, la deja
descargada y avisa sin interrumpir. Se instala al cerrar el programa. Solo
funciona con el AppImage; el `.deb` se actualiza con `apt`. Si empieza una
corrección o el modo examen, aplaza la actualización y cancela la descarga en
curso. Las descargas tienen un límite de tiempo y tamaño.

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
escrita sobre la versión 0.9.0.
