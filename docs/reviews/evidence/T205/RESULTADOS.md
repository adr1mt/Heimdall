# T205 · Encaminamiento mínimo y descripciones orientativas

27 de octubre de 2026. Base y head anteriores a la implementación: los
registrados en `TASKS.json` (commit T204 `d312c27`). Revisión que incluye cambios
locales de esta tarea: examen mantenido, tabla privada, documentación del
laboratorio y contador de criterios del arnés. No cambia el motor ni su programa.

## Cambio autorizado por el profesor

En encaminamiento solo se evalúa que `net.ipv4.ip_forward` esté activo con valor
exacto 1. Se retiran `fwd-persistent` y los siete criterios `nft-*`: no se corrige
NAT, masquerade, reglas guardadas/cargadas ni servicio nftables.

El examen pasa de 31 criterios/peso 35 a **23 criterios/peso 27**. No se reparte
el peso retirado entre los demás. Los 23 restantes conservan IDs, argumentos,
revisión de comprobador y pesos; cambian únicamente sus descripciones.

Ejemplos públicos: «Rang KEA · inici», «Rang KEA · capacitat», «Xarxa de treball
DHCP», «Reserva KEA · web», «IP forwarding». No se muestran IP, MAC ni la solución
numérica del rango. La correspondencia detallada permanece en la tabla privada.

## Verificación

- Comparación estructural antes/después: exactamente ocho criterios retirados,
  ningún criterio nuevo y sin cambios de ejecución o peso en los conservados.
- Único criterio del grupo Encaminament: `fwd-actiu`. La selección no invoca
  comprobaciones nftables ni crea espacios de red de prueba.
- Examen aceptado por el motor compilado y por el motor del paquete local.
- [PLAN ficticio](plan.txt): 23 comprobaciones, peso 27. Sin conexiones SSH.
- `make check`, `make docs-check tools-check` y `git diff --check`: correctos.
- [Instalación local](instalacion-local.json): archivo registrado idéntico a la
  copia mantenida; versiones anterior y nueva verificadas en el almacén nativo
  de copias recuperables. No cambia el AppImage ni se solicita otra instalación.

No se repite el laboratorio de T204: no cambian las implementaciones que ya
verificó, solo su selección y los nombres del examen. La evidencia histórica
31/31 de T204 permanece como tal, no se presenta como una ejecución nueva 23/23.
El arnés de laboratorio cuenta ahora los criterios seleccionados sin fijar 31.
Las pruebas históricas del programa fijo, incluidas nftables, se conservan.

El enunciado de material no se modifica; esta petición limita expresamente lo
que corrige Heimdall. Sin evaluación de alumnado ni cambios en notas o clases.
