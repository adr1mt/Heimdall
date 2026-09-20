<h1 align="center">Heimdall</h1>

<p align="center">
  <strong>Corrige por SSH las prácticas de sistemas y redes de toda una clase.</strong><br>
  Un examen en YAML, un binario, un informe en JSON.
</p>

<p align="center">
  <img alt="Go 1.26+" src="https://img.shields.io/badge/Go-1.26%2B-00ADD8?logo=go&logoColor=white">
  <img alt="Estado: fase 3 de 8" src="https://img.shields.io/badge/estado-fase%203%20de%208-orange">
  <img alt="Dos dependencias" src="https://img.shields.io/badge/dependencias-2-brightgreen">
</p>

---

Heimdall es un motor de evaluación automática de prácticas de informática,
pensado para sistemas, redes y servicios. Sucesor de
[Teuton](https://github.com/teuton-software/teuton), escrito desde cero en Go.
El nombre viene de Heimdall, el guardián de la mitología nórdica, conocido por
su vigilancia constante.

Los exámenes se escriben en YAML sencillo y legible. A partir de ellos Heimdall
entra por SSH en las máquinas del alumnado, ejecuta las comprobaciones y
produce los resultados y la calificación:

```
examen.yaml + aula.yaml  →  Heimdall  →  máquinas del alumnado  →  resultados
```

Comprueba, entre otras cosas, configuración de servicios, ficheros y sus
parámetros, comandos y estados del sistema, DNS, DHCP y red, y el resultado
concreto que se espera de cada ejercicio. Corrige un aula entera de forma
concurrente, controlada y reproducible, y deja un informe detallado de cada
comprobación. Hoy se usa desde la terminal; está diseñado para integrarse con
una interfaz gráfica.

> **Todavía no es una herramienta terminada.** El motor corrige exámenes reales
> contra máquinas reales, pero no hay binario publicado ni interfaz gráfica
> adaptada. Ver [ROADMAP](docs/ROADMAP.md).

## El problema

Un examen de servicios en red se corrige entrando por SSH en la máquina de cada
alumno y comprobando cosas: que el servicio escucha, que el fichero de
configuración dice lo que debe, que el cliente resuelve. A mano son horas. Y la
automatización ingenua tiene un fallo peor que el trabajo manual:

> Con 100 alumnos contra un mismo servidor, Teuton dejaba **53 ceros**. Ninguno
> era del alumnado: el servidor SSH rechazaba las conexiones antes de que nadie
> escribiera una contraseña.

Un cero así es indistinguible de un examen mal hecho. Eso es lo que este motor
existe para no repetir.

| | Teuton 2.10.6 | Heimdall |
|---|---|---|
| 100 alumnos, un servidor | 2,1 s · 156 MB · **53 ceros** | 2,9 s · 14 MB · **0 ceros** |
| Una máquina que suelta 300 MB | 2,8 s · **970 MB** | 0,2 s · **12 MB** |
| Un alumno con la máquina apagada | contagia al resto | no afecta a nadie |

Medido en este equipo con `/usr/bin/time`: [`make rendimiento`](test/rendimiento.sh),
[ADR-0013](docs/adr/0013-alumnos-en-paralelo.md).

## El examen

```yaml
examen: "Servidor DHCP y DNS"
version: 1
hosts: [servidor]
por_defecto: { peso: 1, timeout: 20s }

grupos:
  - grupo: "DHCP"
    comprobaciones:
      - id: kea-activo
        descripcion: "El servicio de DHCP está levantado"
        en: servidor
        cmd: ["systemctl", "is-active", "kea-dhcp4-server"]
        igual_a: "active"

      - id: kea-rango
        descripcion: "El rango es el que se pidió"
        en: servidor
        peso: 2
        cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]
        cerca_de:
          ancla: "pools"
          lineas: 3
          contiene: "${alumno.rango}"
```

Declarativo y nada más: sin condicionales, sin bucles, sin expresiones
regulares y **sin shell**. Cada `cmd` es un vector de argumentos que llega
literal a la máquina del alumno.

El inventario (`aula.yaml`) dice quién es cada alumno y dónde está su máquina.
Las contraseñas no van ahí: va una **referencia**, y el valor entra por stdin.

## El resultado

```
Examen:   examen.yaml
Aula:     aula.yaml
Estado:   PARTIAL

  alumne01     PARTIAL        provisional 80/100, 1 de peso sin evaluar
  alumne02     NOT_EVALUATED  sin evaluar

aviso HOST_KEY_ACCEPTED (student:alumne01/host:host1): la identidad de
127.1.2.3:2201 se ha aceptado y anotado para esta ejecución: SHA256:EXIozD…

Artefacto: var/run-01M2YYCQB3CT4ZM5DZ9JEAD15C.json
```

Junto al resumen queda un JSON con **todo**: qué comando se ejecutó, qué
contestó la máquina, qué se esperaba y por qué cada comprobación salió como
salió. Un suspenso siempre se puede enseñar; una avería también.

Los códigos de salida discriminan: `0` todo evaluado · `2` configuración
inválida · `3` ejecución parcial · `4` cancelado.

## Lo que no se negocia

1. **Un error técnico nunca es un suspenso.** Una máquina apagada sale *sin
   evaluar*, con el motivo escrito. Nunca un 0.
2. **Ningún error silencioso.** Si el motor falla, lo dice en el informe.
3. **Ningún alumno puede tumbar la evaluación de los demás.**
4. **El denominador se fija antes de tocar ninguna máquina.** Todos los alumnos
   reciben las mismas comprobaciones y los mismos pesos, pase lo que pase.
5. **Ningún comando puede colgar la corrección.** Todo tiene tope.
6. **Los secretos no aparecen** en el informe, ni en los logs, ni en `ps`.

Y una consecuencia incómoda a propósito: si quedan comprobaciones sin evaluar,
**no hay nota final**, solo una provisional marcada. La nota se publica cuando
se puede defender.

## Ponerlo en marcha

```bash
make build          # binario en bin/heimdall
make check          # suite rápida: lógica pura, sin red (segundos)
make lab            # laboratorio SSH en podman
make test           # + integración y criterios de aceptación
make rendimiento    # mide escalado y memoria (no es un test)
```

Corregir:

```bash
heimdall check ./examen-ra2                      # valida sin tocar ninguna máquina
heimdall run --secrets=stdin ./examen-ra2        # corrige
```

Dependencias del módulo: `x/crypto/ssh` y `yaml.v3`. Ninguna más —los
identificadores de ejecución los genera el propio motor—, y cualquier añadido
necesita un [ADR](docs/adr/).

## Documentación

| Necesitas… | Lee |
|---|---|
| Cómo está montado | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Por qué está montado así | [docs/adr/](docs/adr/) |
| Hacia dónde va | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Formato del examen | [docs/design/02-FORMATO.md](docs/design/02-FORMATO.md) |
| Estados y cálculo de la nota | [docs/design/03-ESTADOS-Y-NOTA.md](docs/design/03-ESTADOS-Y-NOTA.md) |
| Qué falló en Teuton y cómo se midió | [docs/research/](docs/research/) |
| Estado actual del trabajo | [docs/project/PROGRESS.md](docs/project/PROGRESS.md) |

## Contexto

Lo escribe [Adrià Muñoz](https://github.com/adr1mt), profesor de informática en
el Institut El Puig, para corregir los exámenes de servicios en red de SMX. Las
credenciales que aparecen en los tests son ficticias y solo valen dentro de los
contenedores del laboratorio.
