# Examen RA1 · DHCP amb Kea

Copia mantenida del examen real de 0227. La copia registrada por el profesor está
en `/home/adr1/apps/0227/heimdall/ra1-dhcp-kea/examen.yaml`.

Tras el ajuste docente T207, contiene **19 comprobaciones y peso total 24**.
Gateway y DNS DHCP pesan 2 cada uno; se retira el registro de concesiones del
cliente. Las cuatro reservas se agrupan en «Reserves KEA», de peso 2: deben
estar las cuatro parejas MAC/IP correctas para aprobar, sin puntuación parcial.
Los demás criterios conservan sus IDs y pesos. El alumno recibe nombres
como «Rang KEA · capacitat» o «Xarxa de treball DHCP»; la siguiente tabla es documentación privada del profesor.
No distribuir este directorio como material de examen.

| Descripción pública | Criterio privado | Peso |
|---|---|---:|
| Adreça de la xarxa d'examen | IP externa guardada y activa | 1 |
| Adreçament estàtic del servidor | IP externa estática, DHCP desactivado y duración ilimitada | 1 |
| Netplan de la xarxa d'examen | Netplan combinado coherente con la IP externa activa | 1 |
| Porta d'enllaç del servidor | Gateway externo 192.168.236.1 guardado y activo | 1 |
| DNS del servidor | DNS externo 192.168.236.1 guardado y activo | 1 |
| Adreça de la xarxa de treball DHCP | IP interna 10.23.97.1/8 guardada y activa | 1 |
| Xarxa de treball DHCP | Netplan interno guardado y activo, con DHCP desactivado | 1 |
| Configuració de la xarxa de treball | Interfaz interna sin default route guardada ni activa, ni DHCP | 1 |
| Sortida del servidor | Ruta hacia 9.9.9.9 por la interfaz externa | 1 |
| Resolució de noms del servidor | El servidor resuelve upc.edu | 1 |
| Interfície del servei DHCP | Kea declara exclusivamente la interfaz interna | 1 |
| Xarxa DHCP a KEA | Subred aplicable 10.0.0.0/8 | 1 |
| Rang KEA · inici | Pool único comenzando en 10.23.97.100 | 1 |
| Rang KEA · capacitat | Pool único 10.23.97.100–10.23.98.93, exactamente 250 direcciones | 2 |
| Porta d'enllaç DHCP | Opción routers efectiva 10.23.97.1 | 2 |
| DNS DHCP | Opción domain-name-servers efectiva 9.9.9.9 | 2 |
| Reserves KEA | Las cuatro reservas MAC/IP de correo, web e impresoras correctas, cada una en su ámbito aplicable | 2 |
| Servei KEA | Servicio Kea activo | 2 |
| IP forwarding | Valor activo net.ipv4.ip_forward exactamente 1 | 1 |

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
y asociadas a su propia MAC. La comprobación agrupada evalúa las cuatro sobre
una misma lectura: una ausente o incorrecta hace fallar el criterio de peso 2. Las opciones admiten nombre o código, formato CSV
o hexadecimal e herencia de subred/red compartida/global.

En encaminamiento se comprueba únicamente el valor activo de
`net.ipv4.ip_forward`. No se exige su persistencia ni se consulta, carga o evalúa
nftables, NAT o masquerade. Al no seleccionarse esos criterios, esta versión del
examen no crea espacios de red de prueba al corregir.

## Límites que no deben confundirse con una comprobación completa

- No se evalúa el cliente ni se consultan sus concesiones o el registro de Kea.
- Los criterios de configuración Kea comprueban el archivo guardado y válido;
  el servicio activo es un criterio distinto. No se afirma que
  cada valor del archivo coincida con la configuración interna de un proceso
  que el alumno haya iniciado con otro archivo o no haya recargado.
- La selección por nombre/MAC de interfaces Netplan está soportada. Selecciones
  adicionales no interpretables se dejan sin evaluar.

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
