# Examen RA1 · DHCP amb Kea

Copia mantenida del examen real de 0227. La copia registrada por el profesor está
en `/home/adr1/apps/0227/heimdall/ra1-dhcp-kea/examen.yaml`.

Conserva los 31 IDs y pesos originales (total 35). El alumno recibe solo nombres
como «DHCP · 04»; la siguiente tabla es documentación privada del profesor.
No distribuir este directorio como material de examen.

| Descripción pública | Criterio privado |
|---|---|
| Xarxa · 01 | IP externa presente en estado activo y configuración Netplan combinada |
| Xarxa · 02 | IP externa estática, DHCP desactivado y duración ilimitada |
| Xarxa · 03 | IP externa persistente y activa mediante Netplan |
| Xarxa · 04 | Gateway 192.168.236.1 guardado y activo en la interfaz externa |
| Xarxa · 05 | DNS 192.168.236.1 guardado y activo en la interfaz externa |
| Xarxa · 06 | IP interna 10.23.97.1/8 guardada y activa |
| Xarxa · 07 | IP interna persistente y activa, con DHCP desactivado |
| Xarxa · 08 | Interfaz interna sin default route guardada ni activa, ni DHCP |
| Xarxa · 09 | La ruta hacia 9.9.9.9 usa la interfaz externa |
| Xarxa · 10 | El servidor resuelve upc.edu |
| DHCP · 01 | Kea declara exclusivamente la interfaz interna |
| DHCP · 02 | Subred aplicable 10.0.0.0/8 |
| DHCP · 03 | Un único pool, comenzando en 10.23.97.100 |
| DHCP · 04 | Pool único 10.23.97.100–10.23.98.93, exactamente 250 direcciones |
| DHCP · 05 | Opción routers efectiva para la subred: 10.23.97.1 |
| DHCP · 06 | Opción domain-name-servers efectiva: 9.9.9.9 |
| DHCP · 07–10 | Parejas MAC/IP de mail, web e impresoras en reservas aplicables |
| DHCP · 11 | Servicio Kea activo |
| Encaminament · 01 | Forwarding IPv4 activo |
| Encaminament · 02 | Última asignación efectiva de arranque de forwarding es exactamente 1 |
| Encaminament · 03 | Reglas guardadas permiten el tráfico hacia fuera |
| Encaminament · 04 | Reglas guardadas permiten las respuestas establecidas |
| Encaminament · 05 | Reglas guardadas aplican masquerade hacia fuera |
| Encaminament · 06 | Reglas activas aplican masquerade hacia fuera |
| Encaminament · 07 | Reglas activas permiten el tráfico hacia fuera |
| Encaminament · 08–09 | Servicio nftables activo y habilitado |
| Client · 01 | Registro memfile de Kea contiene una concesión vigente, no eliminada, del rango y la subred aplicables |

## Cómo se corrige

`comprobador:` identifica un programa fijo incluido en el motor por su SHA-256.
No contiene Python escrito por el profesor. Una versión incompatible del motor
rechaza el examen antes de conectar: no permite una corrección parcial accidental.
Se necesita esta compilación local de Heimdall; no basta con editar el YAML en
la versión pública anterior.

Los argumentos externos siguen siendo las columnas `if_ext`, `if_int` y la IP
SSH de `host1`. No se cambian las clases ni sus contraseñas. Todos los criterios
se ejecutan con `sudo: true`, por el mecanismo seguro que ya utiliza Heimdall.

El programa usa Python 3 en Ubuntu y el lector `python3-yaml` que acompaña a
Netplan. Comprueba sus capacidades por criterio. Una dependencia del corrector,
un permiso o una construcción no soportada produce «no se pudo comprobar» y
nota incompleta; no añade un suspenso. Los errores académicos devuelven FAIL.
No hace falta preparar un laboratorio para cada corrección de clase.

Netplan se lee con `netplan get`, por lo que se admite modificar el YAML original
o crear otros. Kea se valida con `kea-dhcp4 -t` y se lee por estructura, admitiendo
propiedades reordenadas, formato compacto, saltos de línea, comentarios,
inclusiones y comas adicionales. Las reservas solo cuentan dentro de su ámbito
y asociadas a su propia MAC. Las opciones admiten nombre o código, formato CSV
o hexadecimal e herencia de subred/red compartida/global.

Para nftables se leen reglas JSON. Las guardadas se cargan en un nuevo espacio
de red exclusivo del proceso comprobador, reproduciendo nombres e índices de
interfaces. Se consultan en una transacción posterior a su carga. Nunca se
cargan en la red real del alumno. Se admiten condiciones de interfaces por nombre
o índice, orden alternativo, conjuntos, prefijos IPv4, estado de conexión,
contadores, saltos y retornos. Se respetan hooks, políticas y descartes previos.
Se prueban flujos TCP/80, UDP/53 e ICMP de ambos extremos del pool y de una reserva;
no se certifica la equivalencia de cualquier programa nftables. Una expresión
relevante desconocida queda sin evaluar.

## Límites que no deben confundirse con una comprobación completa

- No hay acceso al cliente ni su MAC en la clase. Se constata una concesión
  vigente del rango en el registro de Kea; no se identifica inequívocamente al
  cliente del alumno ni se prueban su prefijo, gateway, DNS o resolución efectiva.
- La concesión se comprueba en el registro CSV memfile, incluyendo sus archivos
  de compactación. Otra base de datos queda sin evaluar.
- Los criterios de configuración Kea comprueban el archivo guardado y válido;
  el servicio activo y la concesión son criterios distintos. No se afirma que
  cada valor del archivo coincida con la configuración interna de un proceso
  que el alumno haya iniciado con otro archivo o no haya recargado.
- La selección por nombre/MAC de interfaces Netplan está soportada. Selecciones
  adicionales no interpretables se dejan sin evaluar.
- La persistencia de sysctl se consulta en la configuración combinada de
  `systemd-sysctl`. Un `/etc/sysctl.conf` aislado que el arranque no incluya no
  prueba persistencia.

## Mantenimiento y validación

Programa: [ra1.py](../../internal/probe/ra1.py).
Decisión: [ADR-0036](../../docs/adr/0036-comprobador-acotado-ra1.md).
Pruebas: [test/exams/ra1](../../test/exams/ra1).

Cuando cambie el programa, hay que actualizar en todos los criterios del YAML
su SHA-256 y volver a compilar el motor. Se mantienen los IDs para auditoría,
pero el hash del PLAN cambia: no consolidar correcciones del examen anterior
como si fueran de los mismos criterios.

Controles: `make check`, `make ra1-check`, `make gui-check` y el laboratorio
explicado en [README de pruebas](../../test/exams/ra1/README.md).
