# T175 · Comparación Kea con lecturas compartidas

## Método

30 alumnos ficticios alternados entre `ra2-bien` y `ra2-parcial`, dos
contenedores locales en 127.1.2.3:2211/2212. Quince requisitos de texto sobre
`/etc/kea/kea-dhcp4.conf`, idénticos en ambas variantes. Ambas usan el mismo
binario 0.9.1 construido con los cambios T173/T174, timeout 20 s,
concurrencia global 16 y por destino 4. La variante de comandos ejecuta
`cat -- ruta` por requisito; la otra declara `fichero`.

Dos pares de calentamiento descartados, diez pares medidos alternando el
orden. Las mediciones publicadas se ejecutaron tras terminar los otros arneses
SSH. `/usr/bin/time` mide tiempo (resolución 0,01 s) y RSS máximo del proceso
motor. Cada muestra GUI usa un proceso Node nuevo: mide lectura y validación
reales, creación de una copia y segunda pasada sin crear otra. No mide memoria
ni tiempo de toda la ventana Electron. Se verificó también que las copias
conservan notas, pesos y estados y omiten la salida remota.

Reproducir: `make lab-ra2` y `make rendimiento-ficheros`, secuencialmente
respecto a otros arneses. La fuente es `testdata/shared-files`; no se utilizan
inventarios ni credenciales reales. El programa conserva solo las medidas:
los resultados y perfiles de copia de la medición son temporales.

## Operaciones SSH verificadas

La prueba `TestKeaSharedFileReadsAgainstSSH` instrumenta `Session.Run` y cuenta
los bytes de stdout/stderr retornados por cada operación, no la evidencia
repetida del informe. [Salida directa](ssh-counts.txt):

| Medida | Comandos individuales | Lectura compartida |
|---|---:|---:|
| Lecturas reales | 450 | 30 |
| Contenido recibido (bytes) | 390.150 | 26.010 |
| Resultados académicos | 450 PASS | 450 PASS |

Las operaciones y el contenido bajan un **93,3 %**. Estos bytes se midieron en
una muestra instrumentada separada con el mismo contenido estable; no son
tráfico total de red y no incluyen protocolo, conexión ni cifrado SSH.
La prueba compara pesos, estados, notas y aserciones; el arnés también compara
las conclusiones completas de cada uno de los diez pares.

## Tiempo, memoria y copias

| Medida: mediana (mínimo–máximo) | Comandos individuales | Lectura compartida |
|---|---:|---:|
| Tiempo motor (s) | 0.770 (0.640–0.800) | 0.705 (0.480–0.750) |
| RSS máximo motor (MiB) | 24.54 (23.34–25.65) | 23.56 (20.97–24.34) |
| Resultado (MB decimales) | 1.065 (1.065–1.065) | 1.117 (1.117–1.117) |
| Leer y validar resultado (ms) | 6.25 (6.09–10.85) | 6.41 (6.16–9.40) |
| Crear copia de notas (ms) | 9.00 (8.38–14.82) | 9.05 (8.63–9.33) |
| Revisar copias sin crear nuevas (ms) | 5.56 (5.10–8.68) | 5.66 (5.27–6.08) |

Medidas individuales y configuración: [measurements.json](measurements.json).

La diferencia de medianas de tiempo es 0,065 s (**8,4 %**). En nueve de los diez
pares la variante compartida fue más rápida; la mediana de las diferencias
emparejadas fue 0,075 s. Los rangos se solapan: no es una garantía para el aula.
La mediana de RSS baja 0,98 MiB (24,54 a 23,56 MiB), una mejora pequeña.

El resultado crece un **4,9 %**: conserva evidencia por requisito y añade la
explicación de procedencia de la captura. No hay una mejora clara en lectura,
creación o revisión de copias. Reducir el tamaño del informe requeriría otro
cambio del contrato, que no se introduce en esta tarea.

## Validación y revisión

- `make test`: suite Go rápida, integración SSH, versión, secretos,
  13 criterios de aceptación, eventos, tubería de progreso, sesión de examen,
  examen RA2 y carga de 100 alumnos correctos.
- `make gui-check gui-build`: 534 pruebas, TypeScript, build y preload correctos.
- `go test -race ./...`, enlaces, herramientas y revisión de diff al cierre.
  Tras la revisión del presupuesto de exámenes antiguos, se repitieron `make
  check` y race en PLAN/motor; se añadió una regresión de consolidación de
  resultados compartidos con reintento selectivo. El ajuste de metadatos solo
  omite el campo vacío de la fuente antigua; no cambia los casos medidos.
- Los dos arneses TypeScript nuevos pasan también comprobación estricta directa
  con tsc, porque los scripts de laboratorio no están incluidos en las suites
  TypeScript habituales.
- La prueba SSH inicial detectó usuario ficticio equivocado en el inventario
  nuevo (`alumno` frente al `usuario` del laboratorio RA2); corregido.
- La primera medición no completó el calentamiento: el arnés de copias recibió
  una carpeta donde esperaba la ruta del examen. Se corrigió y se ejecutó
  de nuevo la serie completa, después de la aceptación; no se conservaron
  mediciones incompletas ni mezcladas con esos arneses.

## Límites

La prueba busca texto en configuración estable: no valida su estructura ni el
funcionamiento de Kea. Dos contenedores locales no representan 30 máquinas del
aula. No se midió la memoria total de Electron, tráfico SSH total, fallos de
alimentación ni un examen real de aula. No hay porcentaje mínimo de ahorro
exigido: los criterios verificables son compartir lecturas, preservar notas y
publicar la medición honesta. Los laboratorios se apagan al cerrar la sesión.
