# T174 · Fichero en el editor

> Evidencia histórica: funcionalidad retirada en T176 por petición de Adrià.
> Los arneses y ejemplos citados ya no están activos; véase
> [ADR-0029](../../../adr/0029-retirar-lecturas-compartidas.md).

- `make gui-check gui-build`: correcto, 534 pruebas y preload verificado.
  Vitest necesitó ejecución fuera del aislamiento por `EAI_AGAIN localhost`.
- Pruebas: lectura, serialización, duplicación y reapertura conservan ruta,
  host y aserción. Fuentes mezcladas, tipos no representables y `exit_code`
  con fichero se rechazan. Una ruta vacía mantiene su modalidad en el borrador.
- Arnés `gui/scripts/shared-files-editor.ts` contra Electron compilado:
  selección inicial, tres fuentes, ruta vacía bloquea guardar, guardado real
  en disco y reapertura conservan fichero. `exit_code` deshabilitado para fichero.
- Capturas a 1280 y 960 px, temas claro y oscuro, sin desbordamiento horizontal.
  Inspección visual de [1280 oscuro](1280-dark.png) y [960 claro](960-light.png).
  Radios agrupados con nombre, etiquetas visibles y ayuda junto a la ruta;
  controles y foco siguen los estilos existentes.
- Detector Impeccable sobre `Editor.tsx`: sin hallazgos (`[]`).

Reproducir desde `gui/`: compilar el arnés con esbuild (bundle, node, esm,
external electron) y abrirlo con Electron pasando `--no-sandbox`, como el
arnés existente `editor-lab`. Usa proyecto y perfil temporales; no datos reales.
