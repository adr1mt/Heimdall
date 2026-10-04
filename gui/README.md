# Heimdall GUI

Interfaz de escritorio del motor Heimdall. Electron + React + Tailwind.

La aplicación habla con el motor **solo** por el contrato nativo: argumentos,
secretos por `stdin`, eventos NDJSON y artefacto canónico
([docs/design/09-CONTRATO-GUI.md](../docs/design/09-CONTRATO-GUI.md)). No lee
ningún fichero de Teutón y no conoce `internal/legacy`.

## Referencias

| Necesitas… | Lee |
|---|---|
| Uso y flujo de clases, editor, resultados y copias | [Guía](../docs/GUIA.md) |
| Estado y tareas pendientes | [PROGRESS](../docs/project/PROGRESS.md); `python3 ../scripts/tasks.py` |
| Código y pruebas por trabajo | [Desarrollo](../docs/DESARROLLO.md#entradas-por-trabajo) |
| Persistencia de la contraseña del aula | [ADR-0023](../docs/adr/0023-la-contrasena-del-aula-se-recuerda-cifrada.md) |
| Pruebas de la GUI antigua retiradas | [Registro histórico](docs/TESTS-RETIRADOS.md) |

La contraseña del aula se recuerda cifrada con `safeStorage` en un fichero
propio de datos de usuario. Sin cifrado disponible se teclea en cada ejecución;
no hay respaldo en claro. Hacia el motor viaja por `stdin` (ADR-0009).

El motor recibe el directorio del examen. La GUI genera el aula a partir de la
clase elegida ([ADR-0022](../docs/adr/0022-aula-generada-derivada-de-la-clase.md));
los resultados quedan en `var/` junto al examen.

## Comandos

```bash
npm ci
npm run dev          # aplicación en desarrollo
npm test             # suite rápida (vitest)
npm run typecheck    # main, renderer y tests
npm run build        # compila a out/ y verifica el preload
npm run screenshot   # captura visual de la ventana ya compilada
npm run icon         # regenera build/icon.png y build/icons/
```

Arnés de corrección e histórico, contra el laboratorio (`make lab`, `make build`,
`npm run build`):

```bash
PROJECT=/ruta/al/examen HEIMDALL_ENGINE=../bin/heimdall \
  LAB_SECRET_FILE=/ruta/al/fichero/con/la/clave npm run lab-run
./scripts/secretos.sh   # corrección y comprobación de secretos
```

`lab-run` corrige a través de la aplicación construida —preload, IPC y vistas
reales— y escribe en pantalla lo que ve el profesor. Lo único simulado es el
diálogo de ficheros del sistema, que no se puede pulsar desde un script.
`CANCEL_MS=1200` pulsa «Detener» a mitad y `OPEN_CHECK=p5-lento` abre esa
comprobación en Resultados. Al terminar reabre esa misma corrección desde el
histórico y compara las dos pantallas (H-1). Desde la raíz: `make gui-lab`.

Arnés de modo examen, con el mismo laboratorio:

```bash
PROJECT=/ruta/al/examen HEIMDALL_ENGINE=../bin/heimdall \
  LAB_SECRET_FILE=/ruta/al/fichero/con/la/clave CHAIN=1 npm run examen-lab
```

`examen-lab` enciende el modo examen desde la interfaz real y comprueba que la
vuelta sale sola, que nunca hay dos motores a la vez, que el proyector tapa las
direcciones de las máquinas y que cerrar la ventana con el examen en marcha
pregunta antes. `CHAIN=1` espera además a la segunda vuelta de la cadena, que
tarda un intervalo entero (5 min).

Desde la raíz del repositorio: `make gui-check` (typecheck + tests) y
`make gui-build`. `make check`, la suite del motor, no depende de este árbol.

## Empaquetado

`make gui-dist` compila el motor y deja en `gui/dist` un AppImage y un `.deb`
con el binario dentro, en `resources/heimdall`. Sin nada guardado en ajustes,
la aplicación usa ese motor: quien instala el paquete no instala nada más. Una
ruta elegida a mano en Ajustes manda siempre sobre el motor embebido.

`make gui-paquete` comprueba el paquete ya construido: que lleva el motor, que
ese motor corrige igual que el compilado del repositorio con el entorno vacío
y que la aplicación arranca sin ningún `heimdall` en el `PATH`. Necesita
`make gui-dist` y `make lab`.
