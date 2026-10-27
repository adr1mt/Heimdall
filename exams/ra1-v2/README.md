# RA1 v2

Examen separado para la segunda clase. 12 comprobaciones, peso total 19:
cuatro de red con peso 1, siete de Kea con peso 2 y una de encaminamiento
con peso 1. Nombres públicos acordados con el profesor, sin IP, MAC, extremos
del rango ni comandos que revelen las respuestas.

| Nombre público | Criterio privado | Peso |
|---|---|---:|
| Configuració de la xarxa externa | IP de examen estática en Netplan y activa | 1 |
| Porta d’enllaç del servidor | Gateway externo 192.168.236.1 guardado y activo | 1 |
| DNS del servidor | DNS externo 192.168.236.1 guardado y activo | 1 |
| Configuració de la xarxa interna | IP 10.23.97.1/8 en Netplan y activa, DHCP desactivado | 1 |
| Interfície del servei DHCP | Solo la interfaz interna declarada en Kea | 2 |
| Subxarxa del servei DHCP | Subred aplicable 10.0.0.0/8 | 2 |
| Rang d’assignació dinàmica | Pool único 10.23.97.100–10.23.98.93, exactamente 250 direcciones | 2 |
| Porta d’enllaç dels clients | Opción routers efectiva 10.23.97.1 | 2 |
| DNS dels clients | Opción domain-name-servers efectiva 8.8.8.8 | 2 |
| Reserves d’adreces | Las cuatro parejas MAC/IP del enunciado; todas o ninguna | 2 |
| Estat del servei DHCP | Servicio Kea activo | 2 |
| Configuració de l’encaminament IPv4 | net.ipv4.ip_forward=1 en la configuración persistente combinada de sysctl | 1 |

La petición final del profesor limita encaminamiento al valor **guardado**.
No se consulta el valor activo, no se reinicia y no se corrige NAT ni nftables.
Se admiten los archivos sysctl que se aplican al arranque, respetando precedencia.

La revisión fija `cc653e10b6087ad31ce72344a361f53599376188cfef6aea560d67f2fb8f9811`
difiere del corrector original únicamente en el DNS DHCP esperado. El motor
conserva ambas revisiones, seleccionadas por su huella; el examen original y
su corrector siguen intactos. Un motor anterior rechaza v2 antes de conectar.
Los argumentos siguen siendo `if_ext`, `if_int` e IP de `host1` de la clase.

Los límites de lectura de Netplan/Kea y de configuración declarada frente a
configuración efectiva del cliente son los del [examen original](../ra1-dhcp-kea/README.md).
Este directorio es material privado del profesor.

Validación: `make check ra1-check build`, validación sin clase y PLAN con el
inventario ficticio del laboratorio RA1. Sin correcciones de alumnado.
