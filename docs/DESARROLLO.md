# Desarrollo

Cómo se compila, se prueba y se escribe un examen de Heimdall. Si lo que
quieres es corregir, la guía es [GUIA.md](GUIA.md).

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

## Herramientas

La versión mínima de Go está en `go.mod`; Node 24 y Python 3 completan el
entorno de desarrollo. Desde `gui/`, `npm ci` instala las dependencias fijadas
por `package-lock.json`. Si Go está instalado fuera del PATH, se puede indicar
su ejecutable con `make GO=/ruta/a/go check`.

## Ponerlo en marcha

```bash
make build          # binario en bin/heimdall
make check          # suite rápida del motor: lógica pura, sin red (segundos)
make lab            # laboratorio SSH en podman
make lab-ra2        # laboratorio KEA + BIND necesario para make test
make test           # + integración y criterios de aceptación
make rendimiento    # mide escalado y memoria (no es un test)
```

La aplicación es un árbol Node aparte, con su propio ciclo:

```bash
make gui-check      # suite de la GUI
make gui-build      # compila la aplicación
make gui-dist       # .deb y AppImage con el motor dentro, en gui/dist
make gui-lab        # la arranca contra el laboratorio
```

El número de versión es uno solo para todo el producto: vive en `VERSION`, el
motor se sella con él al compilar y `make version` comprueba que el motor y la
aplicación dicen lo mismo.

Corregir desde la terminal:

```bash
heimdall check ./examen-ra2                      # valida sin tocar ninguna máquina
heimdall run --secrets=stdin ./examen-ra2        # corrige
```

Dependencias del módulo: `x/crypto/ssh` y `yaml.v3`. Ninguna más —los
identificadores de ejecución los genera el propio motor—, y cualquier añadido
necesita un [ADR](adr/).

## Estructura

```
cmd/heimdall/      CLI
internal/plan/     YAML, validación, resolución del PLAN
internal/model/    tipos canónicos y funciones puras de nota
internal/ssh/      sesión, exec, límites de salida, timeouts
internal/engine/   worker pool, presupuesto por alumno, cancelación
internal/assert/   aserciones
internal/report/   escritura atómica del artefacto
internal/events/   contrato nativo NDJSON hacia la GUI
testdata/          exámenes e inventarios de prueba
test/              scripts de aceptación e integración
gui/               Heimdall GUI (Electron, TypeScript)
```

`gui/` es un árbol Node independiente: `make check` no depende de él y su
suite se ejecuta aparte.

## Entradas por trabajo

| Trabajo | Código de entrada | Pruebas y decisiones |
|---|---|---|
| Leer resultados | [CLI](../cmd/heimdall/artifact.go), [lector GUI](../gui/src/main/artifact.ts) | [lector](../gui/tests/artifact-reader.test.ts), ADR-0027 |
| Validar resultados | [JSON Go](../internal/model/validate_json.go), [modelo Go](../internal/model/validate.go), [GUI](../gui/src/shared/artifact.ts) | [corpus compartido](../testdata/artifacts/corpus.json), [Go](../cmd/heimdall/artifact_corpus_test.go), [GUI](../gui/tests/artifact-corpus.test.ts) |
| Copiar, retener, recuperar | [backup.ts](../gui/src/main/backup.ts), incluye `BackupChain` | [copias](../gui/tests/backups.test.ts), [recuperación](../gui/tests/backup-recovery.test.ts), ADR-0026 |
| Reintentar y consolidar | [reintentos](../cmd/heimdall/retry.go), [consolidación](../cmd/heimdall/consolidate.go) | ADR-0018 y ADR-0019 |
| Sesión de examen | [CLI](../cmd/heimdall/session.go), [GUI](../gui/src/main/session.ts) | ADR-0020; arnés `gui/scripts/examen-lab.ts` |
| Credenciales del aula | [vault.ts](../gui/src/main/vault.ts) | ADR-0009 y ADR-0023 |
| Actualizar y distribuir | [feed](../gui/src/main/updater.ts), [servicio](../gui/src/main/update-service.ts), [descarga](../gui/src/main/update-download.ts) | [verificación 0.9.1](releases/0.9.1/VERIFICACION.md); `make gui-dist` |
| Pantallas y estado visual | [routes/](../gui/src/renderer/src/routes/), [stores/](../gui/src/renderer/src/stores/) | [tests GUI](../gui/tests/) |

La nota se calcula en Go. La GUI valida la coherencia de los resultados;
el corpus compartido comprueba la aceptación en ambos árboles. El recorrido de
copias vive dentro de `backup.ts`: la consolidación de notas y la sesión tienen
sus propios límites en el motor.

## Navegación y comprobaciones del repositorio

```bash
python3 scripts/tasks.py          # pendientes, prioridad y dependencias
python3 scripts/tasks.py T160     # tarea completa y alcance de revisión
python3 scripts/tasks.py --json   # pendientes para otras herramientas
make docs-check                  # enlaces locales de documentación mantenida
make tools-check                 # regresiones de las herramientas de navegación
```

La consulta lee directamente [TASKS.json](project/TASKS.json); no mantiene otra
lista. El relevo y las revisiones se registran según
[AGENT-WORKFLOW.md](project/AGENT-WORKFLOW.md).

[CI](../.github/workflows/check.yml) ejecuta las suites rápidas Go y GUI, versión,
build/preload, enlaces y herramientas en cada push y pull request. Los
laboratorios SSH y las pruebas de paquetes se ejecutan por separado; sus
requisitos y el diagnóstico del aislamiento están en [test/README.md](../test/README.md).
El workflow se activa cuando estos cambios llegan a GitHub.

El comprobador cubre los Markdown de la raíz, reglas, docs de primer nivel,
design, ADR, informes de revisión, README de GUI/tests/corpus y los Markdown de
proyecto excepto DECISIONS.
Comprueba destinos de enlaces inline, referencias e imágenes HTML; no anclas
ni sitios externos. Excluye research, audits, releases, retrospectives y
DECISIONS porque conservan evidencia histórica y rutas de otras máquinas.

## Más

| Necesitas… | Lee |
|---|---|
| Cómo está montado | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Por qué está montado así | [adr/](adr/) |
| Hacia dónde va | [ROADMAP.md](ROADMAP.md) |
| Formato de la definición, al detalle | [design/02-FORMATO.md](design/02-FORMATO.md) |
| Estados y cálculo de la nota | [design/03-ESTADOS-Y-NOTA.md](design/03-ESTADOS-Y-NOTA.md) |
| Contrato entre el motor y la aplicación | [design/09-CONTRATO-GUI.md](design/09-CONTRATO-GUI.md) |
| Los 16 modos de fallo del sistema viejo | [MODOS-DE-FALLO-HEIMDALL.md](MODOS-DE-FALLO-HEIMDALL.md) |
| Estado actual del trabajo | [project/PROGRESS.md](project/PROGRESS.md) |
| Investigación previa y mediciones | [research/](research/) |

Para compartir una lectura, sustituye `cmd: ["cat", "/etc/kea/kea-dhcp4.conf"]`
por `fichero: "/etc/kea/kea-dhcp4.conf"` en las comprobaciones de contenido.
La misma ruta y host usan una captura por alumno y corrección; todos sus
timeouts deben coincidir. Los comandos actuales conservan su comportamiento.
Véase [ADR-0028](adr/0028-lecturas-compartidas.md).
