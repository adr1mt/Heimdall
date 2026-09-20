<h1 align="center">Heimdall</h1>

<p align="center">
  <strong>Comprueba por SSH, en muchas máquinas a la vez, que la infraestructura es la que se pidió.</strong><br>
  Una definición en YAML, un binario, un informe en JSON.
</p>

<p align="center">
  <img alt="Go 1.26+" src="https://img.shields.io/badge/Go-1.26%2B-00ADD8?logo=go&logoColor=white">
  <img alt="Estado: fase 5 de 8" src="https://img.shields.io/badge/estado-fase%205%20de%208-orange">
  <img alt="Dos dependencias" src="https://img.shields.io/badge/dependencias-2-brightgreen">
</p>

---

Heimdall es un evaluador automático de infraestructura: comprueba sobre un
conjunto de máquinas que los servicios, la configuración y la red están como se
pidió, y puntúa el resultado. Está orientado a sistemas, redes y servicios, y
su uso principal son los exámenes, donde cada máquina se evalúa y se califica
por separado. Escrito en Go, un binario único.

El nombre viene de Heimdall, el guardián de la mitología nórdica, asociado a la
vigilancia y la atención constante.

La definición se escribe en YAML sencillo y legible. A partir de ella Heimdall
entra por SSH en las máquinas, ejecuta las comprobaciones y produce los
resultados y la calificación:

```
examen.yaml + aula.yaml  →  Heimdall  →  máquinas del alumnado  →  resultados
```

Comprueba, entre otras cosas, configuración de servicios, ficheros y sus
parámetros, comandos y estados del sistema, DNS, DHCP y red, y el resultado
concreto que se espera de cada punto. Recorre decenas de máquinas de forma
concurrente, controlada y reproducible, y deja un informe detallado de cada
comprobación.

Cada comprobación termina en uno de tres estados —`PASS`, `FAIL` o
`UNEVALUATED`—, de modo que un fallo real y un problema técnico del propio
evaluador nunca se confunden: una máquina apagada no es un trabajo mal hecho.

## Estado del proyecto

En desarrollo, **fase 5 de 8** del [roadmap](docs/ROADMAP.md).

- El motor evalúa y califica por SSH contra máquinas reales, en exámenes de
  verdad.
- La aplicación propia, **Heimdall GUI**, vive en [`gui/`](gui/) y está en
  desarrollo avanzado: Inicio, Resultados, Histórico, Ajustes y Ayuda, con
  **modo examen** —vueltas encadenadas mientras dura la sesión— y **modo
  proyector** para enseñar el progreso en pantalla grande.
- Todavía **no hay release para usuario final ni empaquetado definitivo**: se
  compila desde el repositorio. El binario embebido en la aplicación llega en
  la fase 7.

El estado detallado, sesión a sesión, está en
[docs/project/PROGRESS.md](docs/project/PROGRESS.md).

## La definición

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
literal a la máquina evaluada.

El inventario (`aula.yaml`) dice a quién corresponde cada máquina y dónde está.
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
make check          # suite rápida del motor: lógica pura, sin red (segundos)
make lab            # laboratorio SSH en podman
make test           # + integración y criterios de aceptación
make rendimiento    # mide escalado y memoria (no es un test)
```

La aplicación es un árbol Node aparte, con su propio ciclo:

```bash
make gui-check      # suite de la GUI
make gui-build      # empaqueta la aplicación
make gui-lab        # la arranca contra el laboratorio
```

Corregir desde la terminal:

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
| Formato de la definición | [docs/design/02-FORMATO.md](docs/design/02-FORMATO.md) |
| Estados y cálculo de la nota | [docs/design/03-ESTADOS-Y-NOTA.md](docs/design/03-ESTADOS-Y-NOTA.md) |
| Contrato entre el motor y la aplicación | [docs/design/09-CONTRATO-GUI.md](docs/design/09-CONTRATO-GUI.md) |
| Estado actual del trabajo | [docs/project/PROGRESS.md](docs/project/PROGRESS.md) |
| Investigación previa y mediciones | [docs/research/](docs/research/) |

## Contexto

Lo escribe [Adrià Muñoz](https://github.com/adr1mt), profesor de informática en
el Institut El Puig, para corregir los exámenes de servicios en red de SMX. Las
credenciales que aparecen en los tests son ficticias y solo valen dentro de los
contenedores del laboratorio.
