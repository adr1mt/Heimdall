# Segunda auditoría de Heimdall · 2 de octubre de 2026

## Dictamen

La base del proyecto permite mantener una solución sencilla. La separación entre
ejecución, comprobaciones y notas es útil, las dependencias son pocas y las suites
existentes pasan. No hace falta cambiar de arquitectura.

Sin embargo, quedan **11 incidencias confirmadas: 2 P1, 8 P2 y 1 P3**. Las dos
prioritarias afectan a la igualdad de oportunidades y a la copia de las notas:

- Un segundo reintento vuelve a comprobar un suspenso anterior. En el laboratorio
  se consiguió una nota final de **100/100 donde correspondía 50/100**.
- Al cerrar durante una corrección, la aplicación sale antes de crear su copia
  automática. En tres reproducciones se conservaron los originales, pero hubo
  **cero copias**.

Resolvería ambos antes de publicar notas reales. Los P2 deben cerrarse antes de
dar por fiable la distribución 1.0, especialmente actualización, recuperación y
compatibilidad entre lo que produce el motor y lo que admite la aplicación.

**Esta sesión es una auditoría.** Solo se añaden documentación y evidencias;
el código del producto no se modifica. Las propuestas siguientes son cambios
acotados, con criterios para comprobarlos.

## Alcance y evidencia

Estado revisado: commit `6d51ef876f8d4036211822bb34280d3d4d2f019b`, versión del
producto 0.9.0. Árbol inicialmente limpio. Esta revisión es posterior a las
reparaciones T127–T144; el informe anterior conserva su validez como descripción
del estado anterior, no como diagnóstico del código actual.

Se revisaron motor, PLAN y YAML, SSH y límites de salida, notas, sesiones,
reintentos, validación y persistencia de resultados, IPC y cierre de Electron,
editor, clases, histórico, copias, exportación y actualizaciones. Los proyectos
antiguos de `workspace/` quedaron fuera. Se usaron únicamente alumnos y
credenciales ficticios y perfiles temporales, sin tocar el perfil del profesor.

Las reproducciones utilizan código real del proyecto. Cuando se simula una
respuesta HTTP o se fabrican resultados de prueba se indica expresamente. La
prueba adicional del modelo se ejecuta mediante un overlay de Go: no se añade
ningún test al árbol de código del producto.

| Verificación | Resultado de esta sesión |
|---|---|
| `make check` | Correcto: análisis estático y suite rápida |
| `go test -race -count=1 ./...` | Correcto |
| `go test -race -count=1 -tags=integration ./...` | Correcto, contra SSH local |
| `make test` | Correcto: integración, secretos, eventos, sesiones, RA2 y carga de 100 alumnos |
| Tipos de main, renderer y tests | Correctos |
| Vitest | 410 pruebas correctas en 29 ficheros |
| Compilación de GUI | Correcta; preload CommonJS y ruta verificados |
| Aceptación del editor | Correcta: D-1…D-7, A06-1…A06-7 y A09-1/2 |
| Aceptación GUI y secretos | Correcta en ejecución secuencial: S-0…S-4, H-1, X-1/2 y B-1…B-3 |
| `npm audit` | 0 avisos en las dependencias bloqueadas |
| `govulncheck` | 0 vulnerabilidades alcanzables y 0 en paquetes importados; 1 aviso de módulo sobre OpenPGP, que el proyecto no importa |
| Diagnósticos adicionales | Los 11 defectos siguientes se reprodujeron |

Entorno: Linux x64, Go 1.27.1, Node 24.20.0; Vitest ejecutado 4.1.11.
Los contenedores ya existentes escuchan en `127.1.2.3`.

## R01 · P1 · Un segundo reintento vuelve a evaluar un suspenso

Ubicación: [retry.go:65](/mnt/datos/Applications/Claude/Heimdall/cmd/heimdall/retry.go:65),
[engine.go:114](/mnt/datos/Applications/Claude/Heimdall/internal/engine/engine.go:114).

La selección mira solo el último resultado. Lo que no se repitió aparece allí
como `UNEVALUATED / NOT_RUN`, aunque ya tuviera PASS o FAIL en una ejecución
anterior. Al repetir ese reintento, se selecciona de nuevo.

**Reproducción SSH real:** dos comprobaciones de igual peso. La primera suspende;
la segunda agota su tiempo. El primer reintento ejecuta solo la segunda, como
corresponde. El segundo ejecuta ambas. Después de resolver la avería y cambiar
el estado de un fichero temporal del laboratorio, ambas aprueban y la vista
consolidada publica 100. Conservar el suspenso original habría dado 50.

**Cambio mínimo:** resolver la selección sobre toda la cadena usando los
resultados efectivos, sin copiar notas antiguas dentro del nuevo resultado.
Comprobar todos los eslabones antes de abrir SSH. La cantidad que anuncia la
GUI debe corresponder a esa selección.

**Aceptación:** tres o más reintentos consecutivos; un PASS/FAIL de cualquier
eslabón nunca vuelve a ejecutarse y nunca cambia en la consolidación. Al cerrar
todos los pendientes, no se ofrece otro reintento. Debe funcionar también desde
la CLI, aunque la GUI se equivoque.

Evidencia: [retry-grade.log](evidence/retry-grade.log) y su programa de reproducción.

## R02 · P1 · Cerrar durante una corrección deja la nota sin copia automática

Ubicación: [index.ts:107](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/index.ts:107),
[ipc.ts:340](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/ipc.ts:340).

El cierre cancela el motor y solo espera las copias que ya estén en marcha.
La copia de la corrección actual se inicia después, al recibir el cierre del
motor. Electron puede terminar antes de recibir ese evento.

**Reproducción con la aplicación compilada:** un alumno termina y otro sigue
ejecutando un comando. Se solicita `app.quit()`, el mismo camino que toma el
cierre de la aplicación. En tres perfiles limpios, el motor dejó su resultado
final CANCELLED en la carpeta del examen, pero Electron no recibió el callback
de cierre y no creó ninguna copia. Borrar después la carpeta del examen se
llevaría esas notas. No se observó pérdida del original en estas tres pruebas.

**Cambio mínimo:** una secuencia de cierre que cancele, espere la finalización
del motor y después espere su copia. Conservar la ventana o el proceso hasta
completar esa secuencia. Un cierre forzado del sistema debe explicarse como un
límite distinto del cierre normal.

**Aceptación:** cerrar con un motor activo, entre vueltas y con una copia ya
iniciada; verificar desde otro proceso que existen original y copia, y recuperar
las notas después de eliminar el original. Probar también un fallo de copia.

Evidencia: [close-results.json](evidence/close-results.json), `close.cjs` y los tres logs.

## R03 · P2 · Una actualización vacía sustituye la aplicación que funciona

Ubicación: [update-download.ts:32](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/update-download.ts:32),
[updater.ts:197](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/updater.ts:197).

Un cuerpo HTTP existente puede contener cero bytes. Solo se comprueba el máximo
de tamaño, y después se instala el fichero sin validar su contenido.

**Reproducción:** respuesta HTTP 200 de longitud 0 simulada; descarga, escritura
y sustitución reales sobre un fichero temporal. `check()` devuelve `ready`,
`applyOnQuit()` devuelve `true` y la aplicación anterior queda reemplazada por
un fichero de cero bytes. No se probó una release real ni se sustituyó un
AppImage del usuario.

**Cambio mínimo:** exigir tamaño válido y verificar el digest publicado del
asset antes de declararlo listo; conservar el programa anterior si la
verificación falla. GitHub incluye `size` y `digest` en los metadatos de assets.
[Documentación oficial](https://docs.github.com/en/rest/releases/assets).

**Aceptación:** cuerpo vacío, HTML de error con estado 200, tamaño y digest
incorrectos. Ninguno debe modificar el programa instalado. Un asset correcto sí.

Evidencia: `empty_update` en [node-probe.log](evidence/node-probe.log).

## R04 · P2 · La rotación de copias puede romper una cadena todavía reciente

Ubicación: [backup.ts:100](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup.ts:100).

Se conservan 50 ficheros por fecha, sin conservar los antecedentes que necesita
un reintento reciente para recuperar su nota consolidada.

**Reproducción con resultados sintéticos válidos:** 51 correcciones. La última
apunta a la primera; las 49 intermedias son independientes. La copia descarta la
primera sin avisar. Tras borrar los originales y restaurar las 50 copias,
`consolidate` rechaza la última porque no encuentra su antecedente. La cadena
afectada tiene dos eslabones, por debajo del límite de 50 de la CLI.

**Cambio mínimo:** conservar cadenas completas como unidades de recuperación,
con retención acotada y explícita. No borrar un antecedente mientras una copia
conservada lo necesite. La política puede requerir ajustar el ADR de retención.

**Aceptación:** más de 50 resultados, cadenas de dos y varios eslabones mezcladas
con ejecuciones independientes, varias rotaciones y recuperación sin originales.
Cada cadena ofrecida como recuperable debe consolidarse entera.

Evidencia: [restore-probe.log](evidence/restore-probe.log).

## R05 · P2 · El motor produce resultados que la aplicación no puede abrir ni copiar

Ubicación: [artifact.ts:9](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/artifact.ts:9),
[backup.ts:105](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/backup.ts:105).

El límite global de 64 MiB no es compatible con los límites por comprobación.
La serialización JSON también expande caracteres de control.

**Reproducción con el motor real:** 30 alumnos ficticios, 20 comprobaciones de
inventario y 20.000 bytes por respuesta, sin superar el límite de 64 KiB de
ningún flujo. El motor termina con exit 0 y todas las notas completas, pero
produce **72.761.127 bytes**. La GUI rechaza su apertura y la copia automática
devuelve «resultado demasiado grande para copiar».

**Cambio mínimo:** definir un presupuesto coherente de evidencia para el
resultado completo y asegurar que no impida conservar las notas. El presupuesto
no debe cambiar el resultado académico ni la igualdad entre alumnos. Subir
arbitrariamente el máximo desplazaría el problema; acordar límites de entrada y
salida es más sencillo que añadir un nuevo sistema de almacenamiento.

**Aceptación:** clase de tamaño admitido con ambos flujos grandes, caracteres
que JSON expande y evidencia cerca del máximo. Todo resultado exitoso debe
abrirse y copiarse; una configuración no soportada se rechaza antes de SSH.

Evidencia: [large-real.log](evidence/large-real.log) y [large-check.log](evidence/large-check.log).

## R06 · P2 · Un examen con todos los pesos a cero se acepta y después se rechaza

Ubicación: [resolve.go:145](/mnt/datos/Applications/Claude/Heimdall/internal/plan/resolve.go:145),
[validate.go:22](/mnt/datos/Applications/Claude/Heimdall/internal/model/validate.go:22).

**Reproducción:** una comprobación de peso 0. `check` y `run` salen con 0 y se
escribe un resultado. Tanto la GUI como `session` lo rechazan porque el peso
total no es positivo. La aplicación permite editar ese peso.

**Cambio mínimo:** exigir al menos una comprobación con peso positivo al
validar el examen, manteniendo el cero para diagnósticos acompañados de checks
evaluables. Si se quiere un modo íntegramente diagnóstico, tendría que admitirse
de forma coherente en todos los lectores; no hace falta añadirlo para resolver
el defecto actual.

**Aceptación:** examen solo con ceros rechazado antes de ejecutar; mezcla de
pesos cero y positivos conservada y legible.

Evidencia: `zero` en los logs de Node y del lector CLI.

## R07 · P2 · Una respuesta de inventario larga invalida el resultado que acaba de producirse

Ubicación: [student.go:205](/mnt/datos/Applications/Claude/Heimdall/internal/engine/student.go:205).

Las respuestas `valor` se guardan completas sin el límite aplicado a SSH, pero
los lectores rechazan flujos de más de 65.536 bytes sin distinguir su origen.

**Reproducción:** respuesta ficticia de 65.539 bytes con una coincidencia al
principio. El PLAN y la ejecución son válidos y la nota se publica; después GUI
y CLI rechazan el resultado como «flujo inválido».

**Cambio mínimo:** comprobar la longitud de los valores resueltos durante el
PLAN, o conservar evidencia acotada con una política explícita que permita
validar su resultado. Para el caso actual, rechazar el valor demasiado largo
antes de ejecutar es la opción más pequeña.

**Aceptación:** valores por debajo, exactamente en y por encima del límite,
incluyendo texto UTF-8. El motor no escribe resultados que sus lectores rechacen.

Evidencia: `longvalue` en [node-probe.log](evidence/node-probe.log) y el log CLI.

## R08 · P2 · Copiar una carpeta puede ocultar la corrección más reciente del histórico

Ubicación: [history.ts:55](/mnt/datos/Applications/Claude/Heimdall/gui/src/main/history.ts:55).

Se eligen 50 resultados por fecha del fichero y solo después se ordenan por
fecha de corrección. El segundo ordenamiento no recupera lo que se descartó.

**Reproducción:** 51 resultados válidos cuyas fechas de modificación están en
orden inverso a sus fechas reales. El histórico muestra R49 como último y
omite R50, que es la corrección más reciente. Este desfase puede aparecer al
copiar o recuperar una carpeta. Los ficheros siguen existiendo.

**Cambio mínimo:** usar la fecha canónica para seleccionar y ordenar, leyendo
cabeceras acotadas como ya hacen las copias. Mantener visible cualquier error de
lectura relevante.

**Aceptación:** más de 50 ficheros con fechas de modificación alteradas. Las
últimas 50 correcciones reales siempre aparecen, incluyendo la última.

Evidencia: `history` en [node-probe.log](evidence/node-probe.log).

## R09 · P3 · Un peso muy pequeño todavía puede impedir terminar una sesión perfecta

Ubicación: [session.go:232](/mnt/datos/Applications/Claude/Heimdall/internal/model/session.go:232).

La reparación de A08 evita comparar porcentajes redondeados, pero dos pesos
obtenidos distintos matemáticamente pueden convertirse en el mismo `float64`.

**Reproducción mediante el modelo real:** pesos 1 y `1e-100`. La primera vuelta
aprueba la comprobación grande y suspende la pequeña; la segunda aprueba ambas.
En las dos, el peso obtenido almacenado es 1. El desempate conserva la primera
y el alumno permanece ACTIVE aunque haya una vuelta totalmente aprobada.
Los dos resultados pasan la validación del motor.

**Cambio mínimo:** que la condición de terminado reconozca una vuelta completa
con todos los pesos positivos en PASS, independientemente de la pérdida de
precisión de la suma. No se justifica introducir aritmética decimal nueva para
este caso aislado.

**Aceptación:** una vuelta imperfecta seguida de una perfecta con pesos de
distintas magnitudes debe terminar al alumno, preservando la procedencia correcta.

Evidencia: [model-probe.log](evidence/model-probe.log). El FAIL de ese diagnóstico
es intencional: demuestra el defecto; no pertenece a la suite del producto.

## R10 · P2 · El motor ignora documentos adicionales dentro del YAML

Ubicación: [load.go:58](/mnt/datos/Applications/Claude/Heimdall/internal/plan/load.go:58).

`yaml.Unmarshal` lee el primer documento y no comprueba que el fichero termine
ahí. Se puede añadir `---` y un segundo documento inválido sin obtener ningún
error. El hash del fichero incluye ese texto, aunque la ejecución lo ignore.

**Reproducción:** un examen válido seguido de `---` y
`esto_no_es_un_examen: true`. Tanto `check` como `run` salen con 0 y corrigen
únicamente el primer documento.

**Cambio mínimo:** leer exactamente un documento y exigir EOF después de él;
rechazar documentos adicionales, con fichero y línea. Sin formatos nuevos.

**Aceptación:** documento adicional válido, inválido y vacío; contenido
malformado después del primer documento; examen e inventario. Ningún fragmento
de configuración debe ignorarse silenciosamente.

Evidencia: [yaml-probe.log](evidence/yaml-probe.log).

## R11 · P2 · Un identificador repetido dentro de una fila se sustituye sin aviso

Ubicación: [types.go:197](/mnt/datos/Applications/Claude/Heimdall/internal/plan/types.go:197).

La lectura personalizada de alumnos comprueba duplicados en los campos libres,
pero permite repetir claves conocidas. La última aparición gana. La comprobación
de ids repetidos entre alumnos no detecta dos claves `id` en el mismo alumno.

**Reproducción:** una fila con `id: initial` seguida de `id: replaced` se acepta
y la ejecución queda asociada a `replaced`, sin aviso. Esto debilita la lectura
estricta justo en el dato que identifica a quién pertenece una nota.

**Cambio mínimo:** detectar cualquier clave repetida antes de asignarla,
incluyendo las conocidas; conservar la ubicación de ambas apariciones.

**Aceptación:** duplicados de id, nombre, exclusión, hosts y campos libres;
rechazar el PLAN completo y no escribir resultados.

Evidencia: [yaml-probe.log](evidence/yaml-probe.log).

## Orden recomendado y límites

1. R01 y R02, cada uno como una corrección crítica separada y con regresión.
2. R03–R08, R10 y R11: validación, recuperación y uso cotidiano.
3. R09: extremo numérico poco probable en un examen real.

Conservaría las capas, los resultados inmutables, los argumentos literales,
los límites de concurrencia y las dependencias actuales. No propondría migrar
Electron, añadir una base de datos, una cola de trabajos o un framework de
actualización. Los defectos confirmados se resuelven con reglas consistentes en
los límites y pruebas de extremo a extremo.

La aceptación GUI de secretos falló inicialmente en S-1/S-2 al ejecutarla a la
vez que el arnés del editor. Ese arnés pone la contraseña ficticia en su entorno
y en el comando de lanzamiento, y el detector de procesos lo incluye. Se
conserva el log inicial y la repetición sin el editor en paralelo pasó completa.
Esos fallos iniciales no se atribuyen al producto ni se ocultan.

No se han instalado de nuevo el .deb ni el AppImage, aplicado una actualización
desde una release real, simulado un apagón físico ni realizado una revisión
visual sistemática o con lector de pantalla. El cierre Electron se prueba con
`--no-sandbox`, como los arneses existentes; no certifica el aislamiento de
producción. La prueba de tamaño grande usa inventario y datos de control
deliberados, no demuestra que un examen habitual alcance ese tamaño.

No se certifica ausencia total de fallos. La prueba real de aula T084 sigue
pendiente, y la autenticación por clave SSH continúa fuera del producto actual.
Las evidencias y cómo repetirlas están en [REPRODUCIR.md](REPRODUCIR.md).
