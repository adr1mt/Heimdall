# T204 · Corrección robusta del examen real RA1

27 de octubre de 2026. Base/head anteriores a la implementación:
`07d7c4e698b1d7573592938db3487ce763070655`. Incluye los cambios locales
que se enumeran debajo. Revisión del resultado de esta tarea, sin aula real.

## Resultado y criterios

La copia registrada y la mantenida contienen los mismos 31 IDs y pesos originales
(total 35), con descripciones públicas neutras. Se sustituyeron las ventanas de
texto por un comprobador fijo, declarativo y versionado (ADR-0036). No se escribe
código Python en el YAML ni se instala un programa en el alumno.

| Criterio | Evidencia |
|---|---|
| Reservas por pareja y ámbito, orden/formato libre | Unitarias y laboratorio: compacto, multilínea, IP antes de MAC, inclusión, comentarios, parejas incorrectas y reservas globales aplicables. |
| Un único pool exacto e interfaz exclusiva | Positivos reales; negativos con interfaz externa adicional y extremos repartidos entre dos pools. |
| Netplan combinado y activo | Dos YAML en el montaje correcto; 4 positivos tras combinarlos en uno; prefijo persistente /16 con activo /8 rechazado. Selección por nombre o MAC probada. |
| nftables equivalente y aplicable | Orden inverso, iif/oif y nombres, saltos, conjuntos, políticas y descartes previos. Reglas guardadas cargadas en espacio de red exclusivo; comparación exacta del ruleset real antes/después. |
| Fallos del corrector fuera de nota | SSH real sin Python: 31 UNEVALUATED, estado PARTIAL, NOT_EVALUATED y ninguna nota final. Simulación de permisos, salida desconocida y dependencia ausente. Construcción nftables no soportada: salida técnica 70. |
| PLAN previo y compatibilidad | Revisión SHA-256 o criterio desconocido, mezcla de ejecutables, expectativa distinta de OK y secretos rechazados antes de conectar. Hashes anteriores conservados por regresión existente. PLAN ficticio de 60 alumnos/1860 celdas aceptado sin multiplicar el código del programa. |
| Aplicación y copia original | Editor real, preload sandboxed, IPC y motor empaquetado: validar y guardar exactamente el examen con 31 perfiles, sin clases. AppImage extraído contiene el mismo motor que el verificado. Instalación local con originales y versiones recuperables. |

## Comprobaciones ejecutadas

- `GOCACHE=/tmp/heimdall-go-cache make check`: todas las suites Go correctas.
- `go test -race ./internal/engine ./internal/plan`: correcto.
- `make ra1-check`: **22 pruebas Python** correctas.
- `make gui-check`: tipos y **583 pruebas** correctas fuera del aislamiento.
- `make gui-dist`: AppImage y .deb construidos, preload verificado. No publicados.
- `make docs-check tools-check` y `git diff --check`: correctos.
- Laboratorio Ubuntu 26.04 con Kea 3.0.3, Netplan, systemd y nftables reales:
  **31/31**, procesos independientes; **29 casos de variantes** correctos.
- Concesión real mediante busybox udhcpc sobre un par veth del contenedor.
- Motor real por SSH, sudo por stdin: **31 PASS, peso 35, nota 100**.
- Motor real por SSH, intérprete retirado provisionalmente del contenedor y
  restaurado en `finally`: **31 UNEVALUATED, sin nota final, exit 3**.
- Ambos artefactos aceptados por el lector canónico (`heimdall consolidate`).
- Arnés Electron `gui/scripts/ra1-editor-lab.ts`: salida 0.

La primera suite GUI dentro del aislamiento falló en cuatro pruebas existentes
de procesos externos (`spawnSync`/timeouts). La suite completa pasó fuera del
mismo aislamiento, sin cambiar pruebas ni límites. La caché Go predeterminada
no era escribible y se utilizó `/tmp`. No son regresiones atribuidas al cambio.

El laboratorio detectó y permitió reparar errores de la primera implementación:
`expire` es el campo real del CSV de Kea; listar nftables en la misma transacción
puede omitir reglas aún pendientes; pedir un read enorme de un sysctl puede
provocar ENOMEM. Las pruebas finales incluyen las reparaciones. El arnés del
editor respetó que Guardar está deshabilitado cuando no hay cambios y probó el
mismo puente nativo de guardado con el contenido intacto.

## Instalación local

[Manifest de instalación](instalacion-local.json) con rutas y huellas.

- Examen anterior conservado al lado como
  `examen.yaml.antes-ra1-2026-10-27.bak`, privado.
- AppImage anterior conservado como
  `Heimdall.AppImage.antes-ra1-2026-10-27.bak`.
- El mecanismo nativo de versiones recuperables contiene tanto el original como
  la propuesta y verifica sus huellas antes de publicar el cambio.
- Aplicación local con la misma versión nominal 1.0.1; es una compilación local
  modificada, no una nueva publicación. Hay que cerrar y abrir Heimdall para
  dejar de usar el motor de la instancia que ya estaba ejecutándose.
- No se modificaron clases, contraseñas, correcciones previas ni máquinas reales.

## Fuentes y evidencia retenida

- [Correcto por SSH](correcto-ssh.json), [sin Python por SSH](sin-python-ssh.json).
- [31 criterios](laboratorio-31.txt), [variantes](variantes.txt), [editor](editor.txt).
- [Tabla privada de criterios y límites](../../../../exams/ra1-dhcp-kea/README.md).
- [Montaje reproducible y datos ficticios](../../../../test/exams/ra1/README.md).

Fuentes primarias consultadas para las diferencias de formato:
[Netplan get](https://netplan.readthedocs.io/en/1.1.1/netplan-get/),
[configuración Kea](https://kea.readthedocs.io/en/stable/arm/config.html),
[archivos Kea](https://kb.isc.org/docs/kea-files),
[nftables](https://netfilter.org/projects/nftables/manpage.html).

Cambios revisados: `internal/probe`, integración de `comprobador` en PLAN/motor,
conservación del perfil en `gui/src/shared/exam.ts`, regresiones Go/GUI/Python,
examen mantenido, arnés y laboratorio, ADR-0036 y documentación de tarea.
El programa revisado tiene SHA-256
`d06d111abdc6e4253a3fbdf76765c58770f69145d911cea5cc8a22296531babe`.
Los artefactos solo contienen alumnado y credenciales de referencia ficticios;
la contraseña del laboratorio no aparece en sus salidas.

## Límites

No se certifica aula real ni se cierran T070/T084. No hay acceso ni identificación
inequívoca del cliente: la evidencia es una concesión vigente del rango en el
registro memfile, no la configuración efectiva del escritorio. Kea se comprueba
en el archivo válido guardado; no se certifica cada valor interno del proceso
activo. nftables se interpreta sobre los flujos representativos documentados;
las expresiones relevantes no soportadas quedan sin evaluar. No se consultó DNS
externo ni se certificó Internet: upc.edu está en hosts del contenedor.
