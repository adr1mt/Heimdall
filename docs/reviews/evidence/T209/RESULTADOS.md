# T209 · Validación de Kea con la identidad del servicio

Reparación urgente autorizada durante el examen, 27 de octubre de 2026.

## Causa y cambio

En Ubuntu 26.04/Kea 3.0.3, `/etc/kea` pertenece a `_kea:_kea` con modo 750.
El validador arrancado como root necesita saltarse esos permisos; AppArmor
rechaza `dac_override`/`dac_read_search`. El servicio, que corre como `_kea`,
puede acceder sin esos privilegios. Se confirmó por SSH en solo lectura.

El proceso fijo de un único criterio consulta User/Group del servicio, establece
sus grupos suplementarios y abandona root antes de leer archivo/inclusiones y
validar con Kea. Sin User/Group conserva el comportamiento de paquetes antiguos.
Los errores de cambio de identidad/lectura quedan técnicos (salida 70). El
mensaje fijo del parser Kea «Unable to open file», con LC_ALL=C, se reconoce
exclusivamente como diagnóstico técnico; no se usa un mensaje localizado del
sistema para decidir un aprobado. El resto de rechazos del parser conserva FAIL.
Se conserva el final de stderr después de stdout para no ocultar el error real
bajo los mensajes informativos de Kea.

## Pruebas

- `GOCACHE=/tmp/heimdall-go-cache make check ra1-check build`: correcto.
- 30 pruebas Python: identidad textual/numérica, grupo explícito y por defecto,
  grupos suplementarios, servicio root, privilegios insuficientes, lectura tras
  abandonar root, acceso denegado técnico, configuración inválida académica y
  diagnóstico preservado aunque stdout sea largo. Pruebas Go completas correctas.
- Primera revisión de la reparación probada por SSH en la máquina autorizada:
  desaparece «Unable to open file» y se alcanza el rechazo real de configuración
  (pool fuera de la subred). Ningún archivo o servicio del alumno modificado.
- La revisión final solo mejora el orden y límite del diagnóstico. Su repetición
  SSH fue rechazada por revisión automática por transmitir el código fijo a una
  máquina no confiable; no se reintentó ni se eludió el bloqueo. Esa mejora se
  verificó con regresión local. No se conserva información personal ni secretos.
- Examen mantenido aceptado por el motor final y por el motor extraído del
  AppImage final. Revisión e identidades verificadas; 19 criterios/peso 24 intactos.
- AppImage construido desde la aplicación instalada, reemplazando únicamente su
  motor: app.asar conserva SHA-256
  `23f983e295fdbb7f67eea06e3223c63c48edfb514a443c47791100b47fe15921`.
  No incluye los cambios paralelos T208. Motor empaquetado idéntico al compilado.

## Instalación

[Manifest verificado](instalacion-local.json): AppImage y examen cargado
actualizados, copias anteriores al lado y versiones recuperables del examen por
el mecanismo nativo. Instalación comprobada mediante huellas. La instancia que
sigue abierta necesita cerrarse y abrirse para cargar el motor nuevo. No se cierra
ni reinicia automáticamente, no se cambian correcciones guardadas ni se publica.
La nueva revisión exige una nueva corrección; no reutilizar la anterior mediante
reintento de su PLAN antiguo. No se certifica una corrección completa del aula.
