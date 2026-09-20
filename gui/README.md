# Heimdall GUI

Interfaz de escritorio del motor Heimdall. Electron + React + Tailwind.

La aplicación habla con el motor **solo** por el contrato nativo: argumentos,
secretos por `stdin`, eventos NDJSON y artefacto canónico
([docs/design/09-CONTRATO-GUI.md](../docs/design/09-CONTRATO-GUI.md)). No lee
ningún fichero de Teutón y no conoce `internal/legacy`.

## Qué hay hoy (T051)

La semilla: la aplicación arranca con su identidad, encuentra el motor, dice su
versión y recuerda los dos ficheros con los que se va a trabajar. Todavía no
corrige.

- **T052**: lanzar el motor y seguir la ejecución con progreso real.
- **T053**: matriz de resultados, notas y causas técnicas.

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

Desde la raíz del repositorio: `make gui-check` (typecheck + tests) y
`make gui-build`. `make check`, la suite del motor, no depende de este árbol.
