# Heimdall GUI

Interfaz de escritorio del motor Heimdall. Electron + React + Tailwind.

La aplicación habla con el motor **solo** por el contrato nativo: argumentos,
secretos por `stdin`, eventos NDJSON y artefacto canónico
([docs/design/09-CONTRATO-GUI.md](../docs/design/09-CONTRATO-GUI.md)). No lee
ningún fichero de Teutón y no conoce `internal/legacy`.

## Qué hay hoy (T052)

La aplicación corrige. Se eligen el examen y el aula, se escriben las
contraseñas que el aula nombra, y la corrección avanza en pantalla comprobación
a comprobación, alumno a alumno, con un botón para detenerla. Al terminar dice
qué ha pasado y dónde ha quedado el resultado.

- **T053**: matriz de resultados, notas y causas técnicas.

Las contraseñas viven en memoria y solo en memoria: viajan por `stdin` al
motor, nunca en `argv`, nunca al disco y nunca a un fichero de ajustes
(ADR-0009). Elegir otro aula las borra; terminar una corrección también.

El examen tiene que llamarse `examen.yaml` y el aula estar en su misma carpeta:
el motor recibe un directorio, no dos rutas. El artefacto se escribe en `var/`
dentro de esa carpeta.

De `teuton-gui` se conservan la base técnica (Electron, Vite, CSP, preload
aislado), el sistema visual (`components/ui`, `styles/globals.css`,
`tailwind.config.js`) y el flujo de trabajo. Nada de su contrato. Los tests que
no han pasado están listados en [docs/TESTS-RETIRADOS.md](docs/TESTS-RETIRADOS.md).

## Comandos

```bash
npm install
npm run dev          # aplicación en desarrollo
npm test             # suite rápida (vitest)
npm run typecheck    # main, renderer y tests
npm run build        # compila a out/ y verifica el preload
npm run screenshot   # captura visual de la ventana ya compilada
npm run icon         # regenera build/icon.png y build/icons/
```

Aceptación de T052, contra el laboratorio (`make lab`, `make build`,
`npm run build`):

```bash
PROJECT=/ruta/al/examen HEIMDALL_ENGINE=../bin/heimdall \
  LAB_SECRET_FILE=/ruta/al/fichero/con/la/clave npm run lab-run
./scripts/secretos.sh   # corrección entera + ninguna contraseña fuera de memoria
```

`lab-run` corrige a través de la aplicación construida —preload, IPC y vistas
reales— y escribe en pantalla lo que ve el profesor. Lo único simulado es el
diálogo de ficheros del sistema, que no se puede pulsar desde un script.
`CANCEL_MS=1200` pulsa «Detener» a mitad. Desde la raíz: `make gui-lab`.

Desde la raíz del repositorio: `make gui-check` (typecheck + tests) y
`make gui-build`. `make check`, la suite del motor, no depende de este árbol.
