# Estado del proyecto

Memoria entre sesiones. Máximo ~60 líneas. No copia `TASKS.json`.

**Actualizado**: 2026-09-19 · **Fase**: 0 — Bootstrap y contratos

## Última tarea terminada

**T001 — Toolchain Go y esqueleto del módulo.** Ya existe un módulo Go que
compila, se testea y se construye con un solo comando. Sin lógica de negocio:
solo la CLI, la tabla de exit codes y el `Makefile`.

## Estado actual

- **Go 1.27.1** en `/mnt/datos/Applications/Claude/toolchains/go`, del tarball
  oficial. `apt` solo ofrece 1.22, pide root e instala fuera de `/mnt/datos`.
  `~/.profile` añade `…/toolchains/go/bin` al `PATH`.
- `go.mod`: `module evalon`, `go 1.22` (mínimo soportado, no lo instalado). El
  nombre es provisional, D-7 sigue abierta.
- `cmd/evalon` tiene `run`, `check` y `version`; `run` y `check` imprimen «no
  implementado» y salen con 2. Exit codes como constantes: 0 ok · 2 config
  inválida · 3 parcial · 4 cancelado; el 1 queda libre a propósito.
- `Makefile` con `check`, `test`, `build`, `lab` y `lab-down`.
- Podman y `jq` están. `make lab` levanta `alu1` y `alu2` en `127.1.2.3:2201-2202`
  desde `docs/research/evidence/Containerfile`.

## Instalación de Go

```bash
curl -fLO https://go.dev/dl/go1.27.1.linux-amd64.tar.gz
echo "63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445  go1.27.1.linux-amd64.tar.gz" | sha256sum -c -
tar -C /mnt/datos/Applications/Claude/toolchains -xzf go1.27.1.linux-amd64.tar.gz
```

## Pruebas ejecutadas

`make check` verde en 3,3 s · `make build` produce `bin/evalon` ·
`bin/evalon version` → `0.1.0-dev` exit 0, `run` y `check` exit 2 ·
`make lab` / `make lab-down` suben y bajan los dos contenedores · `gofmt -l .`
sin salida.

## Problemas conocidos

- Laboratorio SSH en **`127.1.2.3`, no `127.0.0.1`**: con `127.0.0.x` Teuton
  ejecuta en local (F-01) y el criterio A-11 comprueba que el motor nuevo no.
- Ejecutar Teuton con `HOME` aislado (`workspace/sshlab/fakehome`): una entrada
  ed25519 en el `known_hosts` real tumba la ejecución (F-12).
- La e2e de la GUI falla entera (40/40) sin `npm run build` previo, con un
  error que no lo explica.
- No subir el Teuton instalado (2.10.6) a 3.0.0 sin probar: allí `tt_skip: true`
  aborta la ejecución (F-11).

## Decisiones inesperadas de esta sesión

- Go bajo `/mnt/datos/Applications/Claude/toolchains/`, no en `/usr/local`:
  nada nuevo fuera de `/mnt/datos` y sin root.
- `go.mod` declara `go 1.22`, no `1.27.1`: debe compilar con el mínimo pedido.
- `make lab` construye desde `docs/research/evidence/`, que sí se versiona, y
  no desde `workspace/`, que no.

## Siguiente tarea recomendada

Tres `READY`: **T002** (tipos canónicos de `RunResult`), **T004** (parseo
estricto de los dos YAML) y **T006** (laboratorio SSH, P1). Toca **T002**.
