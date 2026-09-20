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
| `alumno` | `TEUTON_SECRET_TEST_12345` |

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

Credenciales, también ficticias: `usuario` / `EVALON_SECRET_RA2_TEST`. El aula
de verdad usa `usuario`/`usuario`; aquí no, porque en desarrollo no se usan
credenciales reales.

Los ficheros que entrega cada alumno están en `test/ra2/configs/<variante>/`.
Editarlos y volver a levantar el laboratorio es la forma de probar una
comprobación nueva.
