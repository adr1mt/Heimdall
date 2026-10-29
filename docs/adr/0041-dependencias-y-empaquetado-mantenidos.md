# ADR-0041 · Dependencias mantenidas y empaquetado Linux verificable

- Estado: **aceptada** · 2026-10-29 · T225, petición expresa del profesor.

Se actualizan las dependencias directas a las versiones estables actuales y se
fijan sus versiones y huellas en los archivos de dependencias. `npm audit`
completo y la comprobación del lock bloquean cualquier vulnerabilidad conocida
y cualquier dependencia marcada `deprecated`, también de desarrollo. Se retira
la excepción de `sprintf-js`: no se silencian los avisos ni se fuerzan versiones
incompatibles mediante `audit fix --force`.

La última versión de `electron-builder` todavía incluye `glob` 7, `inflight`,
`rimraf` 2 y `boolean`, a través de sus herramientas de otras plataformas. Se
sustituye por `@electron/packager`, mantenido por Electron, y un script Linux
pequeño que usa `mksquashfs`, el runtime oficial AppImage y `dpkg-deb`. Mantiene
los formatos, nombres, identidad del perfil y motor incorporado. El runtime se
fija por ID de asset de GitHub y SHA-256; un cambio del binario detiene el build.
Esto exige las herramientas nativas en el equipo que construye paquetes y deja
su ensamblaje bajo responsabilidad del repositorio; evita conservar o disfrazar
una cadena abandonada para una plataforma que Heimdall no distribuye.

El editor queda compilado localmente, incluido su worker y lenguaje YAML. Se
fija DOMPurify 3.4.17 para corregir la versión vulnerable que Monaco 0.57 aún
incluye. La dependencia de ejecución de la GUI es `js-yaml`; React, Monaco y sus
bibliotecas son herramientas de compilación y viajan en el renderer compilado.
El parser Go pasa del repositorio archivado `gopkg.in/yaml.v3` al sucesor oficial
mantenido `go.yaml.in/yaml/v3`, sin adoptar la versión 4 todavía candidata.

Cero avisos npm no garantiza ausencia de fallos futuros. Go audita las funciones
y paquetes usados; el aviso GO-2026-5932 pertenece al paquete OpenPGP abandonado
del módulo `x/crypto`, que Heimdall no importa ni incorpora en su ejecutable.
Se registra ese límite explícitamente; SSH sigue usando el módulo oficial
actual y no una bifurcación local que oculte el aviso.
