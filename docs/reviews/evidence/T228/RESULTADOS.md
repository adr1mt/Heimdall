# T228 · Búsqueda y reintento de actualizaciones

- Ajustes muestra la versión instalada, la última publicada que pudo consultar
  y el resultado de la búsqueda. La búsqueda manual comparte la descarga con
  la automática.
- Si empieza una corrección, se cancela la petición. Se reintenta una vez al
  terminar la actividad, también si termina antes de completarse la
  cancelación. Durante el modo examen se espera a pausarlo o finalizarlo.
- La descarga sigue verificándose antes de sustituir la AppImage al cerrar.
- Validación local del cambio con 654 pruebas GUI, tipos, Go, herramientas,
  documentación y coherencia de versión.
- Como evidencia de aula previa se comprobaron copias locales de correcciones
  RA1 del curso con 14 notas completas en un solo recorrido. Esta evidencia
  corresponde a una compilación anterior. Se conserva en el equipo del
  profesor y el repositorio solo recoge el recuento.
- La auditoría de la primera candidata detectó avisos nuevos en las
  dependencias de empaquetado glob y minimatch. Se fijaron las versiones
  corregidas 14.0.3 y 11.0.4 para @electron/asar. La auditoría de npm vuelve a
  dar cero vulnerabilidades y cero dependencias obsoletas.
  [Glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) · [Minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## Publicación

- La versión 1.0.2 se publicó el 3 de noviembre de 2026. La etiqueta apunta a
  `739e3df723167eaaf91da236c16ebc79069bea66`. La AppImage, el paquete Debian
  y SHA256SUMS publicados coinciden con los archivos verificados.
  [Publicación](https://github.com/adr1mt/Heimdall/releases/tag/v1.0.2)
- Checks y Release validation pasaron para esa revisión, incluidos los
  laboratorios SSH, la auditoría y las pruebas de los paquetes.
  [Checks](https://github.com/adr1mt/Heimdall/actions/runs/41670807603) · [Release validation](https://github.com/adr1mt/Heimdall/actions/runs/41670807266)
- La AppImage 1.0.2 mostró la versión en Ajustes y reintentó la búsqueda al
  desactivar el modo examen. Una copia temporal de la AppImage 1.0.1 descargó
  la versión pública y la instaló al cerrar. Su SHA-256 coincidió con el
  de la publicación. El motor de 1.0.2 superó las tres comprobaciones de DEMO en Isard.
