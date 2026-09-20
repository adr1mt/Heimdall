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
