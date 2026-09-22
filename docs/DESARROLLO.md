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
necesita un [ADR](docs/adr/).

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
