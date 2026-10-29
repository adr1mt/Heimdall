# T225 · Actualización integral de dependencias

2026-10-29. Base: `f489aba`. Petición explícita de Adrià: actualizar y migrar
todo lo necesario, sin paquetes deprecated ni vulnerabilidades conocidas.

## Cambios

- Todas las dependencias directas están en su última versión estable consultada;
  `npm outdated` devuelve `{}`. Versiones exactas y huellas en el lock, incluida
  la dependencia directa esbuild que antes se usaba de forma transitiva.
- React 19.3.1, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.0.5, Zustand 5.0.16,
  Electron 45.1.0, Monaco 0.57.0 y js-yaml 5.5.0. Se adaptan imports públicos de
  Monaco, registro YAML diferido local, opciones de serialización, configuración
  de TypeScript/Rolldown y tipos JSX. No cambian contrato, criterios ni notas.
- Go 1.27.3, x/crypto 0.58.0 y x/sys 0.49.0. Parser YAML mantenido
  `go.yaml.in/yaml/v3` 3.0.5 en lugar del repositorio archivado.
- Node 26.13.0 y npm 12.2.1 para desarrollo/CI; `.nvmrc`, engines y política de
  scripts explícitos. `npm ci` instala el runtime Electron, salvo omisión
  explícita de CI. Solo se aprueba el instalador esbuild 0.28.2 revisado.
- El último electron-builder conserva dependencias deprecated; se sustituye
  por @electron/packager 20.3.0, @electron/asar 4.3.1, herramientas Linux y
  runtime AppImage oficial fijado por ID de asset y SHA-256. Misma identidad
  `heimdall-gui`, nombre de paquetes y motor incluido. Binario del deb accesible
  también mediante `/usr/bin/heimdall-gui`. Ver [ADR-0041](../../../adr/0041-dependencias-y-empaquetado-mantenidos.md).
- Solo js-yaml y argparse permanecen como dependencias de ejecución; el editor,
  su worker y React van compilados en el renderer. Monaco requiere override
  específico a DOMPurify 3.4.17 para evitar su versión vulnerable fijada upstream.
- CI usa las versiones actuales de checkout/setup-node/setup-go y no permite
  vulnerabilidades ni dependencias deprecated. Se retira la excepción de build.
  Se comprueba también que el lock contiene orígenes y huellas completos.
- Laboratorios genéricos SSH/RA2 en Debian 13 estable. El laboratorio RA1 conserva
  Ubuntu 26.04, la versión LTS que reproduce el aula y su configuración Kea.

## Evidencia de seguridad y versiones

- [Instalación limpia](npm-ci.log): sin deprecated, vulnerabilidades ni scripts
  bloqueados. `npm approve-scripts --allow-scripts-pending`: ninguno pendiente.
- [Auditoría completa](npm-audit.json) y [producción](npm-audit-production.json):
  **0 vulnerabilidades**. El lock contiene **0 dependencias deprecated** y todos
  sus paquetes descargados conservan origen e integridad.
- [Versiones instaladas](npm-versions.json), [consulta inicial](consulted-versions.json)
  y [dependencias directas atrasadas](npm-outdated.json): ninguna.
- Las dependencias internas siguen los rangos o versiones exactas de sus
  mantenedores; algunas corresponden a otras versiones mayores mantenidas.
  [Detalle](transitive-upstream-pins.json). No se fuerzan saltos incompatibles
  para conseguir un número de versión; todas pasan la auditoría completa.
- [Govulncheck completo](govulncheck.log): cero vulnerabilidades en funciones o
  paquetes importados. GO-2026-5932 afecta a x/crypto/openpgp, abandonado dentro
  del módulo oficial x/crypto, sin parche upstream. Heimdall no lo importa ni lo
  incluye en el binario; se deja visible, sin bifurcar SSH para ocultarlo.
- Electron incorpora Node 24.22.1, Undici 7.30.1 y Chromium 156.0.8078.49; son
  los componentes del Electron estable actual, no el Node de compilación.
- [Versiones, metadatos y huellas de los paquetes](verification.json).

## Validación

- `make check`, Go con detector de carreras y `make test` completos: correctos.
  Incluyen integración SSH, secretos, cancelación, eventos, sesiones, RA2 y
  corrección de 100 alumnos. [Integración](integration.log), [carreras](race.log).
- 643 pruebas GUI, tipos y build/preload correctos. Herramientas Python y 30
  pruebas RA1 correctas; los mensajes de errores simulados pertenecen a sus
  casos negativos. [Comprobaciones](checks.log).
- Interacciones de aula con React/Zustand/Electron nuevos: pausa, reanudación,
  finalización, filtros, visibilidad, ancho por teclado/ratón y ajuste del
  proyector a 1024/1366/1920, con datos ficticios y sin errores de consola.
  [Resultado](classroom-ui.json), [captura](classroom-1366.png).
- `make gui-editor`: editor real con su entrada activa actual, pegado, Ctrl+S,
  guardado exacto, borradores inválidos, reapertura, corrección SSH de cinco
  alumnos, alumno desconectado, reanudación y pausa. Notas 100/80/60/40/20,
  sin errores de consola. [Resultado](editor-ui.json), [registro](editor-ui.log),
  [editor](editor-yaml.png). Se actualizan los selectores del arnés a las
  pantallas vigentes, la API console-message de Electron y el destino del
  pegado para EditContext; se conservan las comprobaciones de nota y ficheros.
- [Construcción](packages-build.log): 29 archivos compilados idénticos en ASAR,
  motor e icono idénticos, CSP/preload conservados y solo dos dependencias de
  ejecución. [Arranque](packages-smoke.log): AppImage con sandbox, fallback y
  selección automática; deb extraído abre el renderer y preload reales.
- [Instalación y desinstalación del deb](deb-install.log) en contenedores
  desechables Ubuntu 24.04 y 26.04; symlink de arranque, xdg-open y bibliotecas
  compartidas de Electron comprobados. No se instala en el equipo anfitrión.
- `make gui-paquete`: el paquete corrige igual con el entorno vacío y abre
  sin motor externo ni herramientas de desarrollo. [Resultado](package-lab.log).
- [Herramientas y documentación finales](final-docs-tools.log): 11 pruebas y
  enlaces mantenidos correctos. RA2 reconstruye imágenes antiguas al cambiar
  el Containerfile; el contenido ya no puede quedarse en Debian 12 por caché.
- [Empaquetado final](packages-final.log) con xdg-utils/libnotify declarados
  para conservar apertura de enlaces e integración de escritorio.
- [Sumas SHA-256](SHA256SUMS). Paquetes locales en `gui/dist`, sin publicación.

## Reproducción y límites

Con Node de `.nvmrc`, npm 12.2.1, Go de go.mod, squashfs-tools y dpkg:
`cd gui && npm ci`; desde la raíz, `make gui-check gui-dist docs-check tools-check`.
`make lab lab-ra2 && make test` valida el laboratorio. `gui/scripts/release-check.sh`
comprueba los paquetes y `gui/scripts/deb-install-lab.sh` usa contenedores.

Los primeros intentos encontraron restricciones de procesos del entorno y
expectativas antiguas del arnés de interfaz. npm 12 también presenta un fallo
al regenerar un lock con dependencias opcionales bundled desde un árbol ya
instalado; el lock final se generó desde cero, con URLs y huellas completas, y
se comprobó posteriormente con `npm ci`. No se activa allow-remote globalmente,
no se usa legacy-peer-deps, force ni se suprimen avisos de seguridad.

La validación es local, no certifica CI remoto ni una prueba de aula nueva.
Las consultas reflejan la base de vulnerabilidades de esta fecha; no garantizan
que no se descubran fallos después. No se modifican datos reales ni la
instalación habitual. Node/npm de validación se preparan en `/tmp`, sin
sustituir los del sistema. No se publican paquetes, etiquetas ni se hace push.

Fuentes: [Go](https://go.dev/dl/), [Node](https://nodejs.org/dist/index.json),
[Electron](https://releases.electronjs.org/), [React 19](https://react.dev/blog/2024/04/25/react-19-upgrade-guide),
[Vite 8](https://vite.dev/guide/migration), [npm 12](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/)
y [runtime AppImage](https://github.com/AppImage/type2-runtime).
