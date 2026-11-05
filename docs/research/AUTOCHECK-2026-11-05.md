# AutoCheck y oportunidades para Heimdall

Fecha: 5 de noviembre de 2026. Revisión estática de arquitectura, funcionalidades y riesgos de integración; no certificación de seguridad ni prueba de explotación.

AutoCheck: commit `20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d` de master. Heimdall: HEAD `88e5ad6`, árbol limpio al comenzar. Se consultaron código, documentación, plantillas y pruebas de AutoCheck; no se ejecutó su suite ni se desplegó su web. No hay dotnet disponible en este entorno. En Heimdall pasó `make check` con `GOCACHE=/tmp/heimdall-go-cache`; el intento inicial falló por permisos de la caché habitual. No se ejecutaron GUI ni laboratorios SSH y no se modificó el producto.

## Dictamen

AutoCheck ofrece ideas muy útiles para ampliar las materias evaluables: conectores especializados, corrección de entregas locales por lotes, plantillas y análisis de similitud. Heimdall ya aporta un fundamento especialmente valioso: criterios fijados antes de corregir, distinción entre avería y fallo académico, evidencia y recuperación de resultados. Recomiendo conservar ese fundamento y añadir correctores especializados de manera gradual.

No recomiendo incorporar AutoCheck entero como motor intercambiable ni interpretar directamente sus notas como notas canónicas de Heimdall. Sus reglas de ejecución y calificación son distintas. Una integración experimental como proceso separado sería posible, pero necesitaría traducción verificable de cada comprobación y tratamiento explícito de errores.

## Qué ofrece realmente AutoCheck

| Capacidad observada | Evidencia | Aplicación a Heimdall |
|---|---|---|
| HTML: estructura, XPath, formularios, etiquetas y tablas; validación con Nu HTML Checker local | `core/connectors/Html.cs`; `scripts/templates/html5.yaml` | Muy útil para Lenguajes de Marcas; priorizar comprobaciones de estructura y mensajes concretos |
| CSS: propiedades y aplicación sobre HTML; validación W3C | `core/connectors/Css.cs` | Útil, diferenciando análisis estático de una comprobación visual real en navegador |
| XML, DTD/XSD, consultas; RSS y Atom | `core/connectors/Xml.cs`, `Rss.cs`, `Atom.cs` | Correctores de entregas documentales, con recursos externos controlados |
| PostgreSQL y Odoo: consultas, vistas, privilegios, tablas y operaciones de preparación | `core/connectors/Postgres.cs`, inventario de `Odoo.cs` y plantillas | Muy útil para bases de datos; preparar bases efímeras por alumno y separar preparación de evaluación |
| Java por compilación y entradas/salidas | `scripts/templates/mineseeker.yaml` | Caso real para un primer corrector de programación; necesita ejecución aislada |
| Lotes locales y remotos, variables, herencia de scripts, preparación y limpieza | `core/main/Script.cs`, guía docente | Reutilización de exámenes y corrección de carpetas/entregas; no obliga a adoptar su lenguaje |
| Similitud de código mediante JPlag | `core/copy/SourceCode.cs` | Informe auxiliar para revisión docente, sin suspenso automático |
| Descarga de entregas de DMOJ | `core/connectors/Dmoj.cs` | Fuente de entregas; no confundir con un juez de programación integrado |
| Conector GDrive | `core/connectors/GDrive.cs`, ejemplo upload_gdrive | Posible inspiración para destinos de informes; requiere revisión propia de permisos e identidad |

El proyecto actual usa .NET 10 en el csproj, aunque la descripción de GitHub menciona .NET 8. El árbol conserva documentación API de Moodle, LocalShell y RemoteShell que no corresponde a clases presentes en `core/connectors` del commit estudiado. Esa documentación histórica no demuestra que exista hoy un conector Moodle operativo.

Fuentes: [árbol fijado](https://github.com/FherStk/AutoCheck/tree/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d), [plantillas](https://github.com/FherStk/AutoCheck/tree/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/scripts/templates), [conectores](https://github.com/FherStk/AutoCheck/tree/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/core/connectors).

## Extensibilidad: qué hay y qué falta

La guía propone crear clases C# que hereden de una base. `ParseConnector`, líneas 1597–1604, busca clases dentro del ensamblado del propio motor y las instancia por reflexión. La implementación revisada permite ampliar el programa mediante desarrollo y compilación; no equivale a una tienda o instalador de paquetes independientes para docentes.

En Heimdall ya existe un antecedente: el comprobador RA1 incorporado y versionado (`internal/probe/probe.go`). Es una buena referencia de contrato y trazabilidad, pero actualmente solo admite perfiles conocidos al compilar. Convertirlo en un sistema general de plugins exige una decisión arquitectónica nueva.

Propuesta de producto:

1. **Paquetes de exámenes:** plantillas, ejemplos, parámetros y rúbricas reutilizables. Sin código arbitrario; útiles inmediatamente para compartir entre profesores.
2. **Paquetes de correctores:** HTML/XML, SQL o Python/Java, con identificación, versión, parámetros documentados y pruebas de ejemplo. El profesor instala y selecciona; el autor del paquete programa.
3. **Conectores de entrega:** Moodle o correo reciben informes ya cerrados. No intervienen en la nota.

Para un primer corrector escoger una práctica real. HTML/XML reduce complejidad de ejecución; si la necesidad es programación, comenzar con un único lenguaje y casos de entrada/salida.

Contrato mínimo propuesto, aún no implementado:

- Manifiesto con versión del protocolo, identidad, versión del corrector, compatibilidad, parámetros, recursos y permisos requeridos.
- Lista de criterios y pesos congelada antes de evaluar. Un corrector no decide unilateralmente el denominador.
- Resultados por criterio: correcto, incorrecto o error técnico, con evidencia limitada. El motor calcula la nota.
- Huella del paquete y herramientas conservada con el examen; actualización prohibida durante una sesión. Las notas anteriores no se reinterpretan con otra versión.
- Proceso separado para tolerar fallos; para ejecutar entregas, aislamiento real del sistema, no solo otro proceso. Sin carpetas personales, credenciales del profesor o red salvo necesidad declarada; límites de memoria, CPU, tiempo, procesos y salida.
- El aislamiento debe impedir alterar el corrector, resultados o datos de otros alumnos. Separar pruebas del profesor y programa del alumno.
- Pruebas de aceptación con entrega correcta, incorrecta, bloqueo, salida excesiva, fallo del corrector y versión incompatible.

Fuente: [guía de desarrollo](https://github.com/FherStk/AutoCheck/blob/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/docs/tutorials/developer.md), [intérprete](https://github.com/FherStk/AutoCheck/blob/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/core/main/Script.cs#L1597).

## Hallazgos que desaconsejan copiar el motor sin adaptación

Estos hallazgos se deducen del código; no se reproducieron ataques. Las prioridades se refieren a reutilizarlo dentro de Heimdall.

| Prioridad | Evidencia y efecto | Tratamiento propuesto |
|---|---|---|
| Alta: error técnico puede alterar la nota | `Script.cs:1670–1687` admite convertir cualquier excepción capturada en el resultado esperado con `onexception: SUCCESS`; con ERROR puede acabar como fallo de pregunta | Separar excepciones esperadas de errores de infraestructura y mantener estado no evaluado |
| Alta: tiempo no acotado de forma uniforme | `Script.cs:1651` usa timeout 0 por defecto. `InvokeCommand:2264–2298` pasa el timeout al fallback shell, no impone un presupuesto externo a cualquier método | Presupuesto obligatorio supervisado fuera del corrector |
| Alta: ejecución remota y procesos hijos | `Shell.cs:234–237` configura ConnectionInfo.Timeout después de conectar; no fija explícitamente CommandTimeout. En local `308` llama a Kill sin pedir terminar todo el árbol | Verificar plazo real y terminación de descendientes; no asumir que timeout equivale a proceso terminado |
| Alta: posible bloqueo por salida | `Shell.cs:282–286` lee stdout y stderr completos, uno después de otro; un hijo puede bloquear al llenar stderr mientras el padre espera stdout | Lectura concurrente, topes de salida y prueba con ambos flujos saturados |
| Alta si se expone la web | `web/Program.cs` mapea `/homeHub` sin RequireAuthorization; `HomeHub.Run` recibe ruta de script y parámetros y llama al motor sin atributo Authorize visible | Confirmar despliegue y controles externos antes de considerarlo un servicio compartido; catálogo permitido y ejecución aislada. No se ha probado acceso remoto |
| Alta para XML no confiable | `Xml.cs:213–218` habilita XmlUrlResolver y, según modo, DTD o localización de esquemas | Limitar recursos a esquemas permitidos y bloquear accesos externos inesperados; comprobar con fixtures controlados |
| Media: denominador dependiente de recorrido | `Script.cs:1794–1795` calcula sobre Success+Fails acumulados; `1823` permite cortar el contenido por Abort/Skip | No importar esa nota directamente; exigir plan completo y marcar pendientes |
| Media: dependencia del texto de presentación | `Script.cs:1707–1729` y guía vinculan caption con tratamiento del resultado | La visibilidad de un mensaje no debe cambiar qué se evalúa |
| Media: shell y rutas | `Shell.cs:249–250` ejecuta bash; GetFileOrFolder construye find con interpolación entre comillas simples | Argumentos literales y rutas validadas; aislar cualquier ejecución de código |

La existencia de pruebas en `test/connectors` y `test/main/Script.cs` es positiva. Las pruebas de Shell inspeccionadas cubren operaciones comunes, pero no observé en ese archivo pruebas específicas de saturación de ambos flujos, descendientes o timeout remoto. Esto no permite afirmar ausencia global ni cobertura porcentual.

Fuentes: [Shell](https://github.com/FherStk/AutoCheck/blob/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/core/connectors/Shell.cs), [Script](https://github.com/FherStk/AutoCheck/blob/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/core/main/Script.cs), [XML](https://github.com/FherStk/AutoCheck/blob/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/core/connectors/Xml.cs), [web](https://github.com/FherStk/AutoCheck/blob/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/web/Program.cs), [hub](https://github.com/FherStk/AutoCheck/blob/20ed6145a8348f63a2d9a02d55a4da2a6ae6ea8d/web/Hubs/HomeHub.cs).

El repositorio identifica su licencia como AGPL-3.0 y los encabezados permiten versión 3 o posterior. Cualquier reutilización de código requiere revisar licencia y dependencias concretas. La propuesta puede desarrollarse a partir de las necesidades docentes sin copiar código. Este informe no evalúa compatibilidad jurídica de una distribución combinada.

## Zoom de Heimdall

Factibilidad alta, esfuerzo bajo. Ya existe escala persistida de 80–120 % en `gui/src/renderer/src/stores/app.ts:138–149`, mostrada en Resultados. Actualmente cambia el tamaño raíz de fuente mediante `--ui-scale`; no es idéntica al zoom completo del navegador. Monaco fija además su fuente a 14 px. El modo proyector tiene otra escala.

Implementar Ctrl+ más, Ctrl+ menos y Ctrl+0; admitir teclado numérico y variantes de tecla igual/más. Elegir una escala coherente para toda la ventana y sincronizar el selector para evitar multiplicar dos zooms. Conservar preferencia; comprobar editor enfocado, diálogos, pantallas pequeñas, proyector y recuperación al 100 %. No he comprobado en una app abierta qué atajos de Electron funcionan ya por defecto.

[Electron documenta control del zoom](https://www.electronjs.org/docs/latest/api/web-contents). Esto no requiere cambiar el motor ni las notas.

## YAML en inglés y ayuda de las aserciones

La aclaración del usuario sustituye la cuestión de condicionales: se refiere a las aserciones existentes, no a añadir if o bucles.

| Actual | Nombre inglés propuesto | Explicación docente |
|---|---|---|
| `igual_a` | `equals` | Comprobar igualdad según las reglas del motor |
| `contiene` | `contains` | Buscar texto dentro de la salida |
| `no_contiene` | `not_contains` | Comprobar ausencia de texto |
| `exit_code` | `exit_code` | Comprobar código de salida del comando |
| `cerca_de` | `near` | Buscar texto en un intervalo junto a un ancla |

Los nombres ingleses son propuesta, no sintaxis aceptada hoy. También hay que traducir coherentemente examen, grupos, comprobaciones, descripción, peso, valores por defecto y referencias reservadas al alumno/host. Los textos del examen y campos libres pueden seguir en el idioma del profesor.

Recomiendo un formato versionado con conversión explícita desde español, conservando lectura de exámenes antiguos y sus fuentes originales. No mezclar alias que permitan dos claves contradictorias. Revisar editor, validación, ejemplos, guías y huellas usadas para continuar sesiones. Traducir un archivo puede separar sesiones con la política conservadora actual; nunca reescribir un examen activo silenciosamente.

Añadir un panel «Comprobaciones disponibles», ejemplos insertables, ayuda de parámetros y errores en español. Documentar normalización de espacios/saltos de línea, combinaciones permitidas y diferencia entre comprobar texto y código de salida. Esfuerzo medio por compatibilidad, no por traducir cinco palabras.

## Informes por correo y Moodle

Ya existe informe individual y exportación CSV para Moodle. `gui/src/renderer/src/lib/export.ts:340` usa el campo Moodle como correo para emparejar las filas. No es todavía una identidad numérica estable de usuario Moodle ni un cliente de su API.

**Correo:** factible, esfuerzo medio. Seleccionar cuenta/proveedor, proteger credenciales, mostrar destinatario y adjunto por alumno, confirmar lote y registrar pendiente/enviado/error. Reintentar solo fallidos y tratar envíos de resultado incierto para evitar duplicados. Un fallo de envío nunca cambia notas. Abrir mailto no resuelve adjuntos y envío por lotes fiable. La elección SMTP/OAuth depende del correo del centro; no se ha verificado un proveedor concreto.

**Moodle sin conexión directa:** primer paso práctico, esfuerzo bajo/medio. Conservar CSV de notas y añadir ZIP de informes para una tarea, usando el mapeo de participantes que Moodle espera. No basta comprimir nombres de alumnos. La disponibilidad del flujo depende de la tarea y configuración; especialmente, comprobar actividades sin entregas de archivos. [Moodle documenta la carga por lotes y su confirmación](https://docs.moodle.org/401/en/Assignment_submissions).

**Moodle directo:** factible, esfuerzo medio/alto. Configurar servicio y token con permisos necesarios; elegir curso/tarea; resolver usuario y, cuando corresponda, grupo/intento; subir feedback y nota; comprobar respuesta y evitar duplicados/sobrescrituras accidentales. Requiere acceso de prueba al Moodle del centro, versión y configuración concretas. Moodle ofrece operaciones de calificación y carga de archivos, pero el contrato efectivo debe comprobarse en la documentación API de esa instalación: [servicios](https://docs.moodle.org/dev/Web_services), [funciones](https://docs.moodle.org/dev/Web_service_API_functions), [archivos](https://moodledev.io/docs/4.5/apis/subsystems/external/files).

No se han enviado correos, subido informes ni contactado con el compañero.

## Orden recomendado

1. Zoom y visibilidad de ayuda sobre aserciones: mejora inmediata de aula.
2. Formato inglés versionado, conversión y documentación coherentes.
3. Exportación de informes para Moodle; correo si es el canal habitual del centro.
4. Prueba de un corrector especializado con una práctica real, resultados estables y aislamiento.
5. Extraer el contrato de plugins después de validar ese caso; catálogo e instalación cuando existan paquetes útiles.
6. Conexión directa con Moodle, probada contra el centro.

Son propuestas, no decisiones arquitectónicas aceptadas ni tareas marcadas como implementadas. Una siguiente fase de auditoría dinámica de AutoCheck debería reproducir los casos de bloqueo, errores de calificación, acceso web y resolución XML en laboratorio aislado, sin datos reales; también verificar compilación, dependencias y la suite completa.
