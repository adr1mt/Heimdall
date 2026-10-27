# Laboratorio RA1 (T204)

Todos los datos son ficticios. El laboratorio publica únicamente SSH en
127.1.2.3:2299. No se accede a máquinas del alumnado ni se instala nada en el host.
La configuración de servicios, interfaces y reglas se hace dentro del contenedor.

Pruebas rápidas: `make ra1-check`. Casos positivos, negativos, límites de salida,
lectura real de procfs, reservas, herencia, Netplan, sysctl, nftables y rotación
CSV. Las pruebas Go de PLAN/motor y las GUI se ejecutan con sus gates habituales.

Para reproducir la integración desde la raíz del repositorio:

```sh
podman build -t localhost/heimdall-ra1-qa -f test/exams/ra1/Containerfile test/exams/ra1
podman run -d --name heimdall-ra1-qa --privileged --systemd=always \
  -p 127.1.2.3:2299:22 -v "$PWD:/work:ro" localhost/heimdall-ra1-qa
podman exec heimdall-ra1-qa sh /work/test/exams/ra1/setup.sh
podman exec heimdall-ra1-qa systemctl restart kea-dhcp4-server
podman exec heimdall-ra1-qa busybox udhcpc -i personal-client -n -q -t 3 -T 1 -s /bin/true
podman exec heimdall-ra1-qa python3 /work/test/exams/ra1/lab_probe.py
podman exec heimdall-ra1-qa python3 /work/test/exams/ra1/lab_variants.py
podman rm -f heimdall-ra1-qa
```

`setup.sh` prepara dos archivos Netplan y reservas con órdenes y separaciones
diferentes. Si podman añade una ruta por defecto, hay que asignarle una métrica
mayor que la de la ruta ficticia de examen; no se altera la ruta del host.
El cliente DHCP y Kea intercambian una concesión real por un par veth interno.
upc.edu se resuelve con `/etc/hosts` dentro del contenedor: este laboratorio no
certifica conectividad con Internet ni consulta DNS externos.

`lab_probe.py` usa un proceso independiente por criterio. Es esencial porque
las pruebas de reglas guardadas cambian el espacio de red de su propio proceso.
`lab_variants.py` restaura archivos y reglas en `finally`; comprueba entre otras
cosas que las reglas activas no cambian al analizar las guardadas.

Para probar con el motor real, copiar el examen mantenido y `aula.yaml` a un
proyecto temporal. Por el NAT de podman, sustituir solo en ese examen temporal
`${host1.ip}` por `192.168.236.60`: la IP SSH es 127.1.2.3, pero la IP de examen
interna al contenedor es 192.168.236.60. No modificar el examen registrado real.

La contraseña pública del contenedor es `RA1_TEST_ONLY_827`. Se facilita al motor
por el sobre stdin `{"schema":1,"secrets":{"AULA_PASSWORD":"RA1_TEST_ONLY_827"}}`.
La ejecución real correcta debe dar 31 PASS, peso 35 y nota 100. Quitando
provisionalmente Python solo dentro del contenedor debe dar 31 UNEVALUATED y
ninguna nota final. Restaurar el intérprete en `finally` antes de continuar.

No confundir estos resultados con una prueba del aula real (T084).
