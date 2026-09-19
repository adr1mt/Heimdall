# Cómo reproducir esta investigación

Todo lo que aparece marcado como **CONFIRMADO MEDIANTE PRUEBA** en los demás
documentos sale de los comandos de este fichero. Ninguno de los dos
repositorios originales se ha modificado.

## Entorno usado

| Pieza | Versión |
|---|---|
| SO | Linux 7.0.0-31-generic, es_ES.UTF-8 |
| Ruby | 3.2.3 (el gemspec de Teuton 3.0.0 pide >= 3.2.8) |
| Teuton instalado (el que usa la GUI) | gem 2.10.6 |
| Teuton HEAD | 3.0.0, commit `1094454` (2026-08-27) |
| net-ssh | 7.3.3 · net-telnet 0.2.0 · thor 1.5.0 |
| Node / npm | 24.20.0 / 11.19.0 |
| Contenedores | podman 4.9.3 (rootless) |

## 1. Clonado (sin tocar los originales)

```bash
mkdir -p ~/workspace && cd ~/workspace
git clone https://github.com/teuton-software/teuton.git teuton
git clone https://github.com/adr1mt/teuton-gui.git teuton-gui
cp -r teuton teuton-run      # copia de trabajo: los originales quedan intactos
```

`bundler` no está disponible en este equipo y `ruby-dev` tampoco, así que el
HEAD se ejecuta sin Bundler mediante un envoltorio:

```bash
cat > teuton30 <<'SH'
#!/bin/bash
exec ruby -I$HOME/workspace/teuton-run/lib $HOME/workspace/teuton-run/bin/teuton "$@"
SH
chmod +x teuton30
```

## 2. Suite de tests de Teuton

`rake` no se puede usar (necesita `standard`, que no está instalado). El
equivalente directo:

```bash
cd teuton-run
# rápidos
ruby -Ilib -Itest -e 'Dir["test/**/*_test.rb"].reject{|f| f=~/slow_/}.each{|f| require File.expand_path(f)}'
# todos
ruby -Ilib -Itest -e 'Dir["test/**/*_test.rb"].each{|f| require File.expand_path(f)}'
```

Resultado obtenido: 96 tests / 0,74 s (rápidos) y 164 tests / 11,86 s (todos),
100 % en verde. Los 68 tests lentos (`test/command/slow_*`) son los que lanzan
el binario `teuton` como subproceso.

## 3. Laboratorio SSH reproducible

`Containerfile` está en `evidence/Containerfile`. Es Debian 12 + OpenSSH real,
usuario `alumno`, contraseña ficticia `TEUTON_SECRET_TEST_12345`, y **sin
claves de host ed25519/ecdsa** (ver `FAILURE-MODES.md`, F-12).

```bash
podman build -t teutonlab-ssh .
podman run -d --name alu1 -p 127.1.2.3:2201:22 teutonlab-ssh
```

Dos decisiones no obvias:

- **`127.1.2.3` y no `127.0.0.1`.** Teuton desvía a ejecución *local* toda IP
  que contenga la subcadena `127.0.0.` (`execute_manager.rb:46`). Con
  `127.0.0.1` las pruebas no habrían tocado SSH en ningún momento — es el
  hallazgo F-01.
- **`HOME` aislado** (`sshlab/fakehome`). Teuton hereda el `known_hosts` del
  profesor; con una entrada ed25519 dentro, net-ssh revienta antes de conectar
  (F-12). El `HOME` aislado permite ejecutar el resto de pruebas.

## 4. Proyectos de caracterización

Están en `evidence/proyectos/`. Cada uno es un `config.yaml` + `start.rb`.
Se ejecutan desde el directorio padre:

```bash
teuton run c01-normal            # ejecución normal, pesos, stdout/stderr
teuton run c02-fail              # comando inexistente y typo de DSL
teuton run c03-shell             # semántica de shell e inyección
teuton run c04-exit              # exit codes inconsistentes
teuton run c05-badyaml           # YAML corrupto
teuton run c06-nocases           # config sin casos
teuton run c07-noconfig          # sin config.yaml
teuton run c08-badruby           # error de sintaxis Ruby
teuton run c09-raise             # excepción interna
teuton run c10-isolation         # un alumno revienta, ¿qué pasa con el resto?
teuton run c11-secrets           # fuga de secretos por formato
teuton run c12-csv               # inyección CSV en moodle.csv
teuton run c13-skip              # tt_skip (regresión en 3.0.0)
teuton run c14-check             # DSL dinámico: denominador variable

HOME=.../fakehome teuton run s02-ssh      # SSH correcto
HOME=.../fakehome teuton run s03-sshfail  # 4 fallos de conexión
HOME=.../fakehome teuton run s04-none     # expect_none bajo fallo
HOME=.../fakehome teuton run s05-hang     # comando que no termina
HOME=.../fakehome teuton run s06-drop     # conexión cortada a mitad
HOME=.../fakehome teuton run s07-big      # stdout enorme
HOME=.../fakehome teuton run s09-scale    # 10/30/100 casos
HOME=.../fakehome teuton run s11-key      # autenticación por clave
```

Búsqueda automatizada de secretos en los artefactos:

```bash
grep -rn "TEUTON_SECRET" var/c11-secrets/
```

## 5. Suites de Teuton GUI

```bash
cd teuton-gui
npm install
npm run typecheck          # limpio
npm test                   # 192 tests, 21 ficheros, 1,02 s
npm run build              # IMPRESCINDIBLE antes de la e2e: sin out/ fallan las 40
npm run test:e2e           # 40 pasan, 2 se saltan (~1 min)
npm run verify:parsing -- <proyecto ya ejecutado>
```

`npm run verify:parsing` se ejecutó contra la salida real de `s09-scale` con
100 alumnos: las 9 comprobaciones pasaron.

## 6. Limitaciones del entorno

- **No hay Go instalado.** Ninguna afirmación sobre rendimiento del motor nuevo
  está medida; todas las cifras de este informe son de Teuton.
- **No hay `ruby-dev`**, así que `ed25519` y `bcrypt_pbkdf` no se pudieron
  compilar. Eso *es* parte del hallazgo F-12, no un impedimento.
- **Sin `bundler`**: las dependencias ya estaban instaladas como gemas de
  sistema/usuario, así que el HEAD se ejecuta con `-Ilib`.
- **Podman rootless**: los contenedores no tienen IP alcanzable desde el host,
  de ahí la publicación de puertos en `127.1.2.3`.
