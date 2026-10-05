# Laboratorio SSH de pruebas

```bash
make lab         # levanta el contenedor
make lab-status  # ¿está escuchando?
make lab-down    # lo borra
```

Un solo contenedor, `alu1`, en **`127.1.2.3:2201`**. Nunca `127.0.0.x`: Teuton
trata cualquier dirección que contenga `127.0.0.` como ejecución local (F-01) y
el criterio A-11 comprueba que el motor nuevo no lo hace.

El alumno roto de `testdata/proto` apunta a `127.1.2.3:2299`, un puerto cerrado.
No hace falta un segundo contenedor para probar el fallo de conexión.

`make lab` es idempotente: reconstruye la imagen solo si no existe y reemplaza
el contenedor si ya estaba. `make lab-down` deja el equipo como estaba.

## Credenciales de prueba

Ficticias, públicas y solo válidas dentro del contenedor:

| usuario | contraseña |
|---|---|
| `alumno` | `HEIMDALL_SECRET_TEST_12345` |

Nunca se usan credenciales reales en desarrollo ni en tests.

## HOME aislado

Las pruebas manuales con `ssh` se lanzan con `HOME` a un directorio temporal y
un `known_hosts` propio. Una entrada ed25519 previa para `127.1.2.3` en el
`known_hosts` real tumba la ejecución (F-12), y el contenedor solo publica clave
RSA.

```bash
D=$(mktemp -d)
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=$D/known_hosts \
    -p 2201 alumno@127.1.2.3 'id'
```

## Requisitos del equipo

`podman` y el `timeout` de coreutils (con `--kill-after`). `test/lab.sh` falla
con un mensaje claro si falta alguno.

## Laboratorio del examen RA2

El examen RA2 real (KEA + BIND, 16 comprobaciones) necesita máquinas con los
ficheros de configuración del temario y con `named` de verdad. Son dos:

```bash
make lab-ra2        # levanta ra2-bien y ra2-parcial
make lab-ra2-down   # los borra
test/ra2.sh         # ejecuta el examen y comprueba el resultado
```

| Máquina | Puerto | Entrega |
|---|---|---|
| `ra2-bien` | `127.1.2.3:2211` | Ejercicio completo: 16 de 16 |
| `ra2-parcial` | `127.1.2.3:2212` | Cuatro errores y `named` parado: 11 de 16 |

Son contenedores con systemd (`--systemd=always`) porque el examen pregunta a
`systemctl` si el servicio está activo, y con `NET_ADMIN` porque el examen lee
la tarjeta `enp2s0`, que el laboratorio crea como interfaz `dummy` con
`10.0.0.1/8`.

Credenciales, también ficticias: `usuario` / `HEIMDALL_SECRET_RA2_TEST`. El aula
de verdad usa `usuario`/`usuario`; aquí no, porque en desarrollo no se usan
credenciales reales.

Los ficheros que entrega cada alumno están en `test/ra2/configs/<variante>/`.
Editarlos y volver a levantar el laboratorio es la forma de probar una
comprobación nueva.

## Suites y diagnóstico del entorno

`make check` solo ejecuta el motor; `make gui-check` ejecuta tipos y Vitest.
`make gui-build` incluye la verificación del preload. Para `make test`, levanta
primero **ambos** laboratorios: `make lab` y `make lab-ra2`.
`test/progress_pipe.py` también se ejecuta en `make test`: usa un proceso real
con alumnado ficticio, satura la tubería de eventos sin leerla y comprueba el
resultado guardado tanto al terminar como al cancelar. No necesita SSH.

Los arneses SSH, editor, modo examen y secretos comparten laboratorio y pueden
alterar sus procesos/archivos. Ejecútalos secuencialmente, incluidas las
comprobaciones de paquetes, con exámenes y perfiles temporales.

Si `make gui-check` falla con `getaddrinfo EAI_AGAIN localhost`, comprueba la
resolución con `node -e "require('node:dns').lookup('localhost', console.log)"`.
En sesiones anteriores Vitest falló al resolver localhost dentro del
aislamiento; las mismas pruebas pasaron fuera de él. Las pruebas de cierre
también agotaron su espera dentro del aislamiento con el código anterior.
Contrasta el fallo con la base antes de modificar configuración o pruebas.
Cuando el entorno lo permita, repite el comando con los permisos necesarios;
registra comando, síntoma y resultado de ambas ejecuciones.

La [verificación de recuperación](../docs/audits/2026-10-03/RECUPERACION.md)
registra el caso y su evidencia. Los límites del entorno no justifican debilitar
pruebas ni afirmar que una suite pasó sin ejecutarla.

## Lecturas compartidas de Kea (T175)

`make lab-ra2` y `make rendimiento-ficheros` ejecutan el caso de
[testdata/shared-files](../testdata/shared-files/examen.yaml): 30 alumnos
ficticios alternados entre dos contenedores, 15 requisitos de texto del mismo
fichero. El script hace dos pares de calentamiento y diez pares alternados,
con concurrencia 16 y tope por destino 4. Guarda medidas y recuentos SSH en
`var/performance/shared-files`; `--out` permite otra ubicación.

La prueba de integración `TestKeaSharedFileReadsAgainstSSH` cuenta llamadas
reales al transporte y bytes de stdout/stderr una vez por llamada. El arnés
compara tiempo y RSS del binario CLI y operaciones reales de lectura y copias
GUI. Las métricas de transporte proceden de una muestra instrumentada separada
con el mismo contenido estable; no cuentan cabeceras ni cifrado SSH.
Los informes repiten evidencia por requisito y no se usan para sumar lecturas.

Ejecutar secuencialmente respecto a otros arneses SSH/secretos. El laboratorio
local no representa 30 máquinas independientes y el examen busca texto: no
certifica la validez ni el funcionamiento del servicio Kea. La medición tampoco
incluye toda la memoria de Electron. Los artefactos y copias de medición son
temporales y se eliminan; la evidencia numérica permanece en `--out`.
