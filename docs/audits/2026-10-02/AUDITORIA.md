# Auditoría de Heimdall · 2 de octubre de 2026

## Dictamen

La arquitectura está bien separada y las pruebas existentes pasan, pero la
auditoría encuentra **18 incidencias: 9 P1, 8 P2 y 1 P3**. No recomendaría
cerrar la versión 1.0 ni publicar notas de un examen real sin resolver los P1
que afectan a la corrección, a las copias y al guardado del examen.

Los problemas más relevantes para el profesor son estos:

- Una comprobación puede aprobar aunque el comando no exista o aunque la
  salida contenga lo que estaba prohibido.
- Un comando que supera el tiempo límite puede producir un suspenso académico.
- Una segunda copia de seguridad puede eliminar las notas más recientes de
  la copia y conservar las antiguas.
- La aplicación puede decir «Examen guardado» mientras guarda una versión
  anterior a la que el profesor está viendo.
- Una máquina que deja una petición SSH sin responder puede bloquear una
  corrección incluso después del tiempo límite y de la cancelación.

**Esto es una auditoría, no una reparación.** Se han añadido este informe y
sus evidencias; no se ha cambiado el código del producto. Las pruebas
temporales añadidas para investigar se retiraron después de ejecutarlas.

## Alcance y método

Revisión de la versión **0.9.0**, sobre el commit
`a48e55501ad1079c066bb918565bdba54c100422`. El árbol de trabajo estaba limpio
al comenzar.

Se revisaron el motor Go, el transporte SSH, las aserciones, los estados y
notas, el PLAN, reintentos y sesiones, los artefactos y su redacción,
Electron/IPC, el editor, clases, histórico, copias, exportaciones, actualización,
compilación y distribución. Se contrastó el comportamiento con los ADR y las
reglas del repositorio. No se reauditó el proyecto antiguo de `workspace/`.

Entorno verificado: Linux x64, Go 1.27.1, Node 24.20.0 y Electron 43.7.3,
que coincide con el fichero de dependencias bloqueadas. Las máquinas de
prueba son contenedores locales con nombres y contraseñas ficticios. La GUI
se comprobó con un perfil temporal, separado del profesor.

Las incidencias indican si su evidencia es una reproducción ejecutada o una
conclusión de lectura del código. «Reproducción» significa que se comprobó el
comportamiento defectuoso; que ese programa de diagnóstico termine bien no
significa que el defecto esté arreglado.

## Verificaciones ejecutadas

| Verificación | Resultado | Límite de la conclusión |
|---|---|---|
| `make check` | Correcto: vet y 163 pruebas del motor | La suite rápida no ejerce el transporte SSH real |
| `go test -race -count=1 ./...` | Correcto | No detectó carreras en la suite rápida ejecutada |
| `go test -cover -count=1 ./...` | Correcto | Cobertura rápida por paquete en la tabla siguiente |
| `make test` | Correcto | Incluye las 11 pruebas SSH adicionales y toda la aceptación |
| Aceptación del motor | Correcta | Versión, secretos, cancelación normal, eventos, sesiones, RA2 y carga |
| Carga de 100 alumnos | Correcta | Con los topes: 3 s, ninguna comprobación sin evaluar en esta ejecución |
| Tipos de la GUI | Correctos | Procesos principal, renderer y pruebas |
| GUI, Vitest | 26 ficheros, **357 pruebas correctas** | Predomina la lógica bajo Node, sin renderizar React |
| Compilación de la GUI | Correcta | Preload CommonJS y ruta comprobados por el script del proyecto |
| `make gui-paquete` | Correcto | Paquete existente: motor embebido, mismo resultado y arranque sin motor en PATH |
| `npm audit` | **0 avisos** | Resultado de la base de npm al ejecutar la auditoría |
| `govulncheck` | **0 vulnerabilidades alcanzables** | Un aviso de módulo sobre OpenPGP no importado; no afecta al camino SSH analizado |
| GUI real con examen ficticio | Defecto de guardado reproducido | Editor a 1280×820, ambos temas, y 960×640 |
| Diagnósticos adicionales | Defectos reproducidos | SSH sin respuesta, salida truncada, sesión, pesos, copias, clases y actualización |

La primera ejecución de Vitest falló por la resolución de `localhost` en el
aislamiento. Al ejecutarla fuera de ese aislamiento pasó completa. Un primer
intento combinado de carreras y cobertura también falló al localizar paquetes;
los dos análisis separados terminaron correctamente. Esos fallos iniciales
son del entorno de ejecución y no se presentan como defectos del producto.

| Paquete | Cobertura de la suite rápida |
|---|---:|
| CLI | 78,8 % |
| Aserciones | 98,5 % |
| Motor | 88,4 % |
| Eventos | 100 % |
| Modelo | 95,8 % |
| PLAN | 86,0 % |
| Informes | 78,7 % |
| SSH | 13,5 % |

La cobertura SSH indicada excluye las pruebas de integración. Las pruebas
existentes cubren el servidor que responde normalmente; las reproducciones
de esta auditoría ejercen respuestas incompletas que no estaban cubiertas.

## Hallazgos P1 · corregir antes de usar como garantía de evaluación

### A01 · Se decide la nota usando una salida recortada

**Ubicación:** [stream.go:35](/mnt/datos/Applications/Claude/Heimdall/internal/ssh/stream.go:35),
[assert.go:81](/mnt/datos/Applications/Claude/Heimdall/internal/assert/assert.go:81).

Se conservan 64 KiB, se sigue leyendo hasta el límite duro de 8 MiB y la
ejecución puede quedar completada. Las aserciones comparan únicamente el
texto conservado, sin atender a `truncated`.

**Reproducción real:** salida de 65.545 bytes, con `FORBIDDEN` después del
byte 65.536. `contiene` salió FAIL y `no_contiene` salió PASS. Ambos resultados
son contrarios a la salida completa y llegaron a una nota final.

**Corrección propuesta:** separar el texto conservado como evidencia del
texto utilizado para evaluar. Si no se puede demostrar una aserción con la
información disponible, dejarla sin evaluar con motivo explícito. La
truncación del informe, por sí sola, no debe decidir un aprobado o suspenso.

**Aceptación:** probar coincidencias y texto prohibido antes y después del
límite, igualdad con un sufijo descartado y `cerca_de` fuera del prefijo.

### A02 · Una anticomprobación aprueba si el comando no existe

**Ubicación:** [assert.go:129](/mnt/datos/Applications/Claude/Heimdall/internal/assert/assert.go:129),
[score.go:26](/mnt/datos/Applications/Claude/Heimdall/internal/model/score.go:26).

`no_contiene` aprueba por ausencia en stdout, aunque el proceso haya fallado
antes de producir evidencia. El clasificador acepta ese aprobado.

**Reproducción real:** un comando inexistente terminó con 127, stdout vacío
y `no_contiene: FORBIDDEN`; la comprobación salió PASS con causa NONE. Un
`cat` sobre un fichero ausente puede presentar el mismo patrón de salida vacía.

**Corrección propuesta:** definir qué finalizaciones permiten comprobar
ausencia. Un comando inexistente debe ser fallo académico, como indica la
política del proyecto, y una avería no debe demostrar que algo está ausente.
Respetar los casos en que un código distinto de cero es el resultado esperado
del comando; no aplicar una regla genérica sin esa decisión de formato.

**Aceptación:** comando inexistente, lectura fallida y anticomprobación válida
con stdout vacío. La prueba actual del exit 127 usa `exit_code`, por lo que no
cubre este caso.

### A03 · Un timeout que necesita SIGKILL se trata como resultado académico

**Ubicación:** [session.go:350](/mnt/datos/Applications/Claude/Heimdall/internal/ssh/session.go:350).

El envoltorio remoto usa `timeout -k 5s`, pero solo reconoce el estado 124
como timeout. Cuando el proceso ignora TERM y necesita KILL, coreutils puede
devolver 137. Ese camino se marca como completado y FINISHED.

**Reproducción real:** comando de laboratorio que ignora TERM, límite de 1 s.
Terminó con 137 y obtuvo FAIL/NONE; la ejecución completa publicó nota final.
El propio `timeout --help` del equipo documenta el estado 137 para KILL.

**Corrección propuesta:** conservar una señal fiable de que fue el envoltorio
quien agotó el límite y clasificarlo como TIMEOUT/UNEVALUATED. Distinguirlo de
un comando que termine por sí mismo con ese código.

**Aceptación:** timeout con TERM, escalada a KILL, y comando que devuelva
legítimamente 124 o 137 sin agotar el límite.

### A04 · Abrir un canal SSH o iniciar el comando puede bloquear indefinidamente

**Ubicación:** [session.go:250](/mnt/datos/Applications/Claude/Heimdall/internal/ssh/session.go:250),
[session.go:270](/mnt/datos/Applications/Claude/Heimdall/internal/ssh/session.go:270).

`NewSession()` y `Start()` se ejecutan antes del `select` que observa el
contexto. Después de autenticar se elimina el deadline de la conexión. Un
servidor que mantiene TCP abierto y no contesta esas peticiones deja al worker
esperando, sin que el presupuesto del alumno o «Detener» lo libere.

**Reproducción:** servidor SSH ficticio que omite por separado la respuesta de
apertura y la de exec. Con contexto y límite de 50 ms, ambas peticiones seguían
bloqueadas a los 250 ms; solo cerrar explícitamente la conexión las liberó.

**Corrección propuesta:** hacer que todas las fases de la petición queden bajo
un plazo efectivo y cerrar el transporte del alumno cuando se agote. La
cancelación debe liberar también la fase anterior a `Wait()`.

**Aceptación:** servidor sin respuesta en apertura, exec y autenticación;
cancelación en cada fase; los demás alumnos deben terminar y debe guardarse el
artefacto final.

### A05 · La rotación de copias elimina los resultados más recientes

**Ubicación:** [backup.ts:57](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup.ts:57),
[backup.ts:81](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup.ts:81).

Cada pasada vuelve a copiar todos los originales que no están en el destino,
incluidos los descartados anteriormente por el límite de 50. Después poda
según la fecha de escritura de la copia. Al recopiarlos, los resultados viejos
parecen más nuevos que los recientes ya conservados.

**Reproducción:** 100 correcciones. Primera copia: se conservan 051–100.
Segunda copia: se vuelven a copiar 001–050 y se eliminan **todas las 051–100**.
Se fijó una fecha anterior a las primeras copias para representar inequívocamente
una segunda pasada posterior y evitar empates de resolución del reloj.

**Impacto:** si se pierde la carpeta del examen después de esa pasada, la
recuperación ofrece las correcciones antiguas y pierde las recientes.

**Corrección propuesta:** elegir qué 50 correcciones conservar por su fecha
canónica antes de copiarlas, y podar con ese mismo criterio. No recopiarlas
solo porque la retención las retiró.

**Aceptación:** 51 y 100 originales, tres pasadas sucesivas, restauración tras
eliminar los originales y comprobación de que siguen las últimas notas.

### A06 · «Guardar» confirma un examen distinto al borrador YAML visible

**Ubicación:** [Editor.tsx:97](/mnt/datos/Applications/Claude/Heimdall/gui/src/renderer/src/routes/Editor.tsx:97),
[Editor.tsx:417](/mnt/datos/Applications/Claude/Heimdall/gui/src/renderer/src/routes/Editor.tsx:417),
[Editor.tsx:353](/mnt/datos/Applications/Claude/Heimdall/gui/src/renderer/src/routes/Editor.tsx:353).

El texto YAML vive en el componente hijo. Si no se puede analizar, el modelo
del padre queda en su última versión válida. Guardar permanece habilitado y
valida/escribe ese modelo anterior.

**Reproducción en la GUI real:** añadir `foo: [` al YAML y pulsar Guardar.
La pantalla muestra simultáneamente el error de sintaxis, «Examen guardado» y
«El motor acepta el examen». El fichero guardado no contiene el borrador.
Cambiar de vista también puede perder ese texto. Al abrir un YAML inicialmente
ilegible se muestra el YAML de `emptyExam`, no el texto original que falló.

**Corrección propuesta:** conservar el texto original y el borrador como
estado explícito del editor. Bloquear el guardado cuando el borrador no sea
válido y advertir antes de descartar cambios. El texto validado debe ser
exactamente el que se guarda.

**Aceptación:** borrador inválido, alternancia de vistas, navegación y apertura
de un fichero con error. Nunca confirmar como guardado contenido anterior.

### A07 · El editor elimina errores de formato antes de que el motor los vea

**Ubicación:** [exam.ts:96](/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/exam.ts:96),
[exam.ts:133](/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/exam.ts:133).

`readExam` selecciona campos conocidos y una única aserción; no rechaza claves
desconocidas ni varias aserciones. Después el motor valida el YAML reconstruido,
que ya perdió esos datos.

**Reproducción:** una comprobación con `contiene`, `no_contiene` y una clave
desconocida se acepta en el editor y se reescribe solo con `contiene`. El motor
habría rechazado el documento original. El comentario que afirma que no se
descarta lo desconocido no corresponde al comportamiento.

**Corrección propuesta:** validar el documento original antes de normalizarlo
y conservar el texto que no se pueda representar sin pérdida. Nunca elegir
una condición del profesor silenciosamente.

**Aceptación:** claves desconocidas en todos los niveles, dos aserciones,
valores de tipo incorrecto y documentos válidos sin cambios semánticos.

### A14 · Cancelar afirma que ha matado un proceso que sigue vivo

**Ubicación:** [session.go:330](/mnt/datos/Applications/Claude/Heimdall/internal/ssh/session.go:330),
[student.go:242](/mnt/datos/Applications/Claude/Heimdall/internal/engine/student.go:242).

Cuando vence el contexto local se atribuye KILLED_REMOTE únicamente porque
el servidor tenía `timeout`. El motor considera esa marca antes de comprobar
la cancelación global, y la presenta como timeout y proceso eliminado.

**Reproducción real:** `sleep 11`, timeout de 20 s, SIGINT aproximadamente al
segundo. El artefacto de la ejecución dice CANCELLED, pero la comprobación
dice TIMEOUT/KILLED_REMOTE y «se ha matado». Inmediatamente después, `pgrep`
en el contenedor confirmó que `sleep 11` seguía vivo.

**Corrección propuesta:** priorizar la cancelación y separar «se ha cerrado la
sesión» de «se ha confirmado la muerte del proceso». Si no se confirma, indicar
UNKNOWN; si se ofrece cancelación remota, verificar su efecto.

**Aceptación:** detener antes del timeout, agotar el presupuesto del alumno y
perder la conexión. No declarar muerte remota sin evidencia.

### A16 · Contraste insuficiente en estados de la barra lateral y botones rojos

**Ubicación:** [App.tsx:384](/mnt/datos/Applications/Claude/Heimdall/gui/src/renderer/src/App.tsx:384),
[App.tsx:393](/mnt/datos/Applications/Claude/Heimdall/gui/src/renderer/src/App.tsx:393),
[globals.css:35](/mnt/datos/Applications/Claude/Heimdall/gui/src/renderer/src/styles/globals.css:35).

En el tema claro la barra lateral sigue siendo oscura, pero utiliza los
colores `strong` preparados para fondo claro. Los pares definidos dan
aproximadamente **2,54:1** para «Motor listo» y **2,29:1** para motor ausente.
El primero se observa en la captura del tema claro. En el tema oscuro,
blanco sobre el rojo destructivo definido da **4,05:1**.

Son textos pequeños y activos. El mínimo aplicable es 4,5:1 para texto normal
según [WCAG 2.2, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Las ratios se calcularon con los tokens HSL y, en la barra lateral, componiendo
el fondo al 10 % sobre el color de la barra; no son estimaciones a ojo.

**Corrección propuesta:** colores semánticos propios para estados sobre la
barra oscura y un par destructivo que alcance el contraste en ambos temas.
Comprobarlo con `$impeccable colorize` y finalizar con `$impeccable polish`.

**Aceptación:** estado listo y ausente, botones destructivos y sus estados de
interacción en ambos temas. Mantener icono y texto además del color.

## Hallazgos P2 · siguientes correcciones

### A08 · Una vuelta perfecta puede no dar al alumno por terminado

**Ubicación:** [session.go:232](/mnt/datos/Applications/Claude/Heimdall/internal/model/session.go:232).

La mejor vuelta se elige por el porcentaje entero redondeado. Primera vuelta:
249/250, publicada como 100. Segunda: 250/250, también 100. Se conserva la
primera por empate y el estado se calcula solo a partir de ella.

**Reproducción:** sesión ACTIVE, vuelta elegida 1 y obtenido 249, pese a que la
segunda vuelta lo había superado todo. El alumno sigue recibiendo correcciones.

**Propuesta:** determinar FINISHED a partir de cualquier vuelta realmente
perfecta, independientemente del desempate de la nota; o comparar primero los
pesos reales y documentar el criterio. Probar específicamente 99,6 % → 100 %.

### A09 · El editor no conserva pesos decimales que el motor admite

**Ubicación:** [exam.ts:167](/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/exam.ts:167),
[exam.ts:274](/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/exam.ts:274).

El escritor convierte a número únicamente los enteros. Un peso válido `0.5`
se reescribe como `"0.5"`; el motor rechaza ese texto con exit 2. El formulario
también exige enteros mayores que cero, mientras el motor admite pesos cero
para diagnósticos. La búsqueda de cercanía permite cero líneas en el motor,
pero el formulario lo rechaza.

**Reproducción:** leer y reescribir un peso 0,5, seguido de `heimdall check`:
«la clave peso debe ser un número».

**Propuesta:** alinear los valores que acepta y escribe el editor con el
formato nativo. Probar el ciclo abrir–guardar–validar con pesos 0, 0,5 y 1,
además de `cerca_de` en la misma línea.

### A10 · Un fichero de clases parcialmente corrupto pierde datos al guardar

**Ubicación:** [classes.ts:39](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/classes.ts:39),
[classes.ts:83](/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/classes.ts:83).

Se bloquea un JSON roto, pero se filtran sin aviso grupos sin nombre/id y
alumnos sin id. Un objeto válido como JSON puede por tanto leerse incompleto
y guardarse sobre el original.

**Reproducción:** fichero con dos clases, una de ellas sin nombre. La lectura
devolvió una; el siguiente guardado escribió una y borró la otra.

**Propuesta:** rechazar la corrupción parcial con ubicación del dato y bloquear
la escritura, como ya se hace con la corrupción sintáctica. Si se ofrece
recuperación parcial, hacerla explícita y conservar el original.

### A11 · Los límites numéricos permiten estados incompatibles con la política

**Ubicación:** [resolve.go:215](/mnt/datos/Applications/Claude/Heimdall/internal/plan/resolve.go:215),
[score.go:14](/mnt/datos/Applications/Claude/Heimdall/internal/model/score.go:14),
[score.go:108](/mnt/datos/Applications/Claude/Heimdall/internal/model/score.go:108).

**Reproducciones:**

- `peso: .nan` y `.inf` pasan `check` con exit 0 y hash vacío. `run` termina
  con exit 1 al serializar, sin poder escribir un artefacto final.
- Una comprobación PASS de peso 1 y otra UNEVALUATED de peso `1e-10` producen
  nota final 100/COMPLETE, mientras el alumno queda PARTIAL. La tolerancia
  absoluta convierte ese peso pendiente positivo en cero.

**Propuesta:** rechazar números no finitos y sumas no finitas en el PLAN.
Determinar si queda peso positivo sin evaluar a partir de las comprobaciones,
sin hacer desaparecer comprobaciones mediante una tolerancia del acumulado.
Si se decide un peso mínimo de formato, debe ser explícito y validado.

### A12 · La redacción defensiva no recorre toda la metadata textual

**Ubicación:** [redact.go:38](/mnt/datos/Applications/Claude/Heimdall/internal/report/redact.go:38).

Se filtran comandos, salida y algunos motivos, pero no otros textos como
`execution.user`, nombres o descripciones.

**Reproducción:** contraseña ficticia conocida colocada como usuario de
ejecución; sobrevive a `report.Redact` y no genera aviso. La condición puede
darse si el usuario y la contraseña tienen el mismo valor. No se encontró
que el flujo normal copie automáticamente una contraseña a esos campos.

**Propuesta:** hacer explícito el alcance de la segunda defensa y cubrir la
metadata que pueda contener valores de credenciales, preservando las
referencias necesarias para consolidar. Añadir esta condición a las pruebas
de secretos; la entrada por stdin y la ausencia en argv funcionan.

### A13 · Se acepta como resultado una nota sin comprobaciones que la sustenten

**Ubicación:** [artifact.ts:142](/mnt/datos/Applications/Claude/Heimdall/gui/src/shared/artifact.ts:142),
[retry.go:23](/mnt/datos/Applications/Claude/Heimdall/cmd/heimdall/retry.go:23).

La GUI verifica versión, lista de alumnos y presencia de PLAN. Un alumno
normal con `checks: null` se transforma en una lista vacía aunque conserve
COMPLETE y nota final 100. El lector de CLI también valida solo una parte
pequeña del contrato antes de usar resultados en reintentos y sesiones.

**Reproducción:** modificar un resultado ficticio para quitar sus
comprobaciones y mantener nota 100; `parseArtifact` lo acepta.

**Propuesta:** validar forma y coherencia de estados, pesos, ids, cantidades y
nota al leer. Los excluidos y las copias restauradas necesitan sus excepciones
explícitas; una copia legítima conserva las comprobaciones aunque retire la
salida. Esto detecta corrupción, no proporciona autenticidad criptográfica.

### A15 · El fallo de la copia automática queda oculto

**Ubicación:** [backup.ts:71](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup.ts:71),
[ipc.ts:341](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/ipc.ts:341).

La copia captura errores de lectura, escritura y creación del destino, y el
llamador ignora su resultado. La pantalla de histórico puede abrir perfectamente
el original mientras ninguna copia se haya guardado. La inspección de este
camino no encontró un aviso al profesor sobre el fallo de respaldo.

Además, copiar y analizar todos los originales usa operaciones síncronas en
el proceso principal, antes de notificar el cierre. Un histórico grande puede
bloquear la interfaz; no se midió su latencia con artefactos de tamaño máximo.

**Propuesta:** devolver un resultado con fallos y avisarlo sin convertirlo en
un fallo de la corrección. Limitar el trabajo de cada pasada y mover el I/O
fuera del camino síncrono de la interfaz. Probar un destino que no permita
crear/escribir copias y un histórico superior al límite.

### A17 · Una descarga de actualización puede comenzar durante una corrección

**Ubicación:** [updater.ts:138](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/updater.ts:138),
[update-service.ts:47](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/update-service.ts:47).

Se comprueba `busy` antes de consultar la versión, pero no después de esperar
la respuesta ni antes de descargar. La descarga real tampoco lleva timeout,
tope de tamaño o cancelación al empezar una corrección.

**Reproducción sin red:** el proveedor ficticio de versiones hace que comience
la corrección mientras llega la respuesta. El actualizador inicia de todos
modos la descarga y devuelve ready. Contradice la política de reservar la red
a la corrección mientras está activa.

**Propuesta:** volver a comprobar el estado antes de descargar, cancelar o
aplazar cuando empiece el examen y dar un presupuesto a la descarga. Conservar
la aplicación que funciona si no se completa. La publicación e instalación
desde una release real no se verificaron en esta auditoría.

## Hallazgo P3 · robustez secundaria

### A18 · Un motor que no puede arrancar notifica el cierre dos veces

**Ubicación:** [run.ts:171](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/run.ts:171).

Los eventos `error` y `close` del proceso llaman a `finish` sin guarda de una
sola ejecución.

**Reproducción:** ruta de motor inexistente; el callback de cierre recibió dos
notificaciones. Puede duplicar copias y actualizar dos veces el estado o el
temporizador del modo examen. No se demostró pérdida de notas por este caso.

**Propuesta:** garantizar una sola finalización conservando el error original;
probar ENOENT, permisos insuficientes y cierre normal.

## Revisión de interfaz

La identidad visual es coherente y adecuada a una herramienta del profesor:
pantallas concretas, navegación estable, estados con texto e iconos, componentes
compartidos, temas y ampliación para proyector. **Falla la integridad funcional
del guardado**, como muestran A06 y A07. No se recomienda un rediseño.

Puntuación orientativa de la interfaz inspeccionada, siguiendo Impeccable y
UI/UX Pro Max; no equivale a una certificación del producto completo:

| Dimensión | Puntuación / 4 | Evidencia principal |
|---|---:|---|
| Accesibilidad | 2 | Contraste insuficiente; hay etiquetas, foco y diálogo con gestión de teclado |
| Rendimiento | 2 | Vistas separadas; copias e I/O síncronos en el proceso principal |
| Adaptación a ventana de escritorio | 3 | Editor comprobado a 1280×820 y 960×640, con contenido desplazable |
| Temas | 3 | Tokens compartidos; estados incorrectos sobre barra lateral oscura en tema claro |
| Integridad de implementación | 2 | Componentes coherentes; el guardado puede confirmar otro documento |
| **Total** | **12/20** | **Aceptable visualmente, requiere correcciones funcionales importantes** |

No se exige adaptación a móvil a una aplicación distribuida para Linux x64
con una ventana mínima de 960×640. No se certifica reflow completo a gran zoom,
uso con lector de pantalla ni navegación de todas las pantallas solo por
teclado. Esas comprobaciones deben formar parte de la siguiente aceptación.

El detector de Impeccable solo señaló el uso de Inter como estilo frecuente.
Se descartó como incidencia: no prueba ningún perjuicio y cambiar la tipografía
no resuelve los problemas encontrados. La reducción de movimiento existe;
su regla global puede refinarse, pero no se demostró aquí que impida una tarea.

Capturas del caso A06 con datos ficticios:

![Editor: borrador inválido y confirmación de guardado, tema oscuro](/mnt/datos/Applications/Claude/Heimdall/docs/audits/2026-10-02/evidence/editor-dark.png)

![Editor: mismo caso en tema claro](/mnt/datos/Applications/Claude/Heimdall/docs/audits/2026-10-02/evidence/editor-light.png)

## Qué funciona y conviene preservar

- Cálculo de notas separado del transporte y de la interfaz; el PLAN se fija
  antes de conectar y los errores técnicos ordinarios quedan sin evaluar.
- Contraseñas por stdin, sin contraseña en argv ni en el aula generado.
  La aceptación de secretos pasa también con el proceso vivo.
- Renderer con aislamiento de contexto, sin integración Node, preload
  CommonJS para sandbox y CSP incluida en el HTML de producción.
- Salidas mostradas como texto y límites explícitos de memoria. No se encontró
  uso de `dangerouslySetInnerHTML` para mostrar salida de alumnos.
- Escritura atómica del artefacto, parciales y referencias de procedencia.
- Identidad SSH por ejecución consistente con la decisión explícita del ADR;
  no se presenta como vulnerabilidad nueva la confianza en el primer contacto.
- Exportaciones con defensa frente a fórmulas en las entradas habituales y
  notas incompletas vacías, sin convertirlas en cero.
- Laboratorio RA2 y clase de 100 alumnos evaluados correctamente con los topes.
- Dependencias sin avisos npm y sin vulnerabilidades alcanzables de Go en el
  análisis ejecutado.

La sospecha inicial sobre `safeStorage` y el almacén básico de Linux se descartó:
en Electron 43.7.3 se observó `backend=basic_text`, `available=false` y
`stored=false`. No se guardó la contraseña ficticia. La
[documentación de Electron](https://www.electronjs.org/docs/latest/api/safe-storage)
advierte sobre el proveedor básico; la prueba de la versión efectiva es la
evidencia que permite concluir que ese camino no almacenó una contraseña aquí.

## Orden de trabajo recomendado

1. **Notas:** A01, A02, A03; añadir primero regresiones con el laboratorio.
2. **Terminación y cancelación:** A04, A14; verificar que ninguna fase SSH
   pueda retener un worker y que el informe diga lo que realmente ocurrió.
3. **Datos del profesor:** A05, A06, A07, A15. Comprobar recuperación de las
   últimas notas y guardado exacto del texto validado.
4. **Sesión, formato y lectura:** A08–A13; unificar el contrato en sus límites.
5. **Interfaz y actualización:** A16–A18. Para interfaz: `$impeccable harden`,
   `$impeccable colorize` y, al terminar, `$impeccable polish`.
6. Repetir la aceptación, añadir pruebas del renderer y solo después ejecutar
   la prueba real de aula pendiente de T084. Automatizar los checks en CI;
   no se encontró una configuración de CI versionada en este repositorio.

Los cambios críticos deben seguir la regla del proyecto de tareas y commits
separados. No se han creado tareas ni marcado como resuelto ningún hallazgo.

## Límites y documentación que debe actualizarse

- No se publicaron notas, releases ni actualizaciones y no se usaron alumnos
  reales. La auditoría no sustituye al examen real pendiente de T084.
- Se verificó el paquete 0.9.0 existente en `linux-unpacked`; no se instaló el
  `.deb`, no se rehízo el paquete ni se certificó su correspondencia exacta con
  cada cambio de interfaz posterior a su compilación.
- La prueba GUI empleó un perfil temporal y el argumento `--no-sandbox`, como
  los scripts de aceptación del proyecto; no certifica el aislamiento del
  proceso de sistema. La configuración de producción se revisó en el código.
- No se verificaron firma de releases, instalación real de una actualización,
  apagón físico, disco lleno real, lector de pantalla ni carga máxima de
  artefactos de 64 MiB. Se señalan como pendientes, no como pruebas superadas.
- La arquitectura documenta 8 alumnos concurrentes, pero el PLAN por defecto
  del código utiliza 16. También describe comandos sin shell: el cliente local
  no interpreta comandos, pero SSH envía una cadena entrecomillada que el
  servidor normalmente ejecuta con su shell. No se encontró inyección en el
  entrecomillado revisado; la explicación debe precisar ese límite.
- Los documentos sobre modos de fallo y cierre de fase deben incorporar estos
  casos antes de afirmar que solo queda pendiente la autenticación por clave.

## Evidencias y reproducción

Las evidencias acompañan al informe en
[/docs/audits/2026-10-02/evidence/](/mnt/datos/Applications/Claude/Heimdall/docs/audits/2026-10-02/evidence).
Incluyen registros de aceptación, cobertura, carreras, paquete, dependencias,
diagnósticos Go/TypeScript y capturas. Solo contienen datos ficticios.

Los ficheros `ssh_probe_test.go.txt` y `model_probe_test.go.txt` son los
diagnósticos utilizados: se copiaron temporalmente como pruebas al paquete
correspondiente y se retiraron al terminar. Los scripts TypeScript se
compilaron con el esbuild ya instalado en `gui/` y se ejecutaron desde `/tmp`.
No son pruebas de aceptación que deban incorporarse sin cambiar sus
expectativas: comprueban que el defecto actual es reproducible.

El resultado de Go sobre OpenPGP es un aviso de módulo no alcanzable:
[GO-2026-5932](https://pkg.go.dev/vuln/GO-2026-5932). No se convierte ese aviso
en una vulnerabilidad del producto porque Heimdall importa SSH, no OpenPGP.
