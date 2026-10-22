# T201 · Red del actualizador y sandbox

2026-10-22. Electron instalado 43.8.3, Node incorporado 24.22.0. Las versiones
estables 43.8.3, 44.9.3 y 45.0.0 consultadas aún incorporan 24.22.0:
[publicaciones oficiales](https://releases.electronjs.org/). No se cambia de
rama mayor para conservar el mismo Node sin parche.

## Exposición y reparación

El [aviso de Node del 21-oct](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
incluye TLS, DNS, HTTP y un fallo de descompresión Brotli. El actualizador
recibía respuestas por `fetch` de Node: esa era una entrada relevante para
respuestas comprimidas. Consulta y descarga usan ahora `net.fetch`, que según
[Electron](https://www.electronjs.org/docs/latest/api/net#netfetchinput-init)
usa la red de Chromium. El descargador exige un transporte explícito: no tiene
una alternativa implícita a Node. Conserva límite de tamaño, cancelación,
plazos y verificación SHA-256 antes de reemplazar el AppImage.

No se usan `dns.resolve`, el modelo de permisos de Node ni snapshots propios
con cachés de números aleatorios. Las direcciones de actualización son HTTPS
con hosts fijados por el actualizador. No se afirma que Node esté parcheado ni
que esta inspección pruebe ausencia de vulnerabilidades. Se actualizará Electron
cuando incorpore los parches; la mitigación no sustituye esa actualización.

Prueba con Electron real: respuesta HTTP Brotli de un servidor ficticio local,
`fetch` global sustituido por una función que falla si se usa; los bytes
recuperados son exactos con `net.fetch`. Prueba de cableado del servicio confirma
Chromium para feed y descarga. Pruebas de presupuesto y actualización conservadas.

## Arranque y aislamiento

Se extrajo el AppImage 1.0.0 existente. Su AppRun generado prueba
`unshare -Ur true`: añade `--no-sandbox` solo si falla o falta la herramienta.
Se ejecutó ese AppRun con stubs de ambas respuestas y con opción explícita:
los cuatro casos conservan los argumentos y solo añaden una opción de fallback.
La prueba no sustituye ejecutar Chromium en un sistema con esa configuración.

El paquete se prueba además directamente con y sin `--no-sandbox`, con perfiles
ficticios aislados. En ambos modos el endpoint DevTools local confirma página
empaquetada, interfaz visible y `window.heimdall` disponible. La primera prueba
de ocho segundos solo observaba el proceso y mostró errores al terminarlo; se
sustituyó por esta comprobación del renderer, que pasó en ambos modos. Se conserva `sandbox: true`,
`contextIsolation: true`, Node desactivado en renderer y CSP de producción.
El fallback reduce el aislamiento de procesos del sistema; esas otras defensas
no lo restauran. No se presenta como equivalente al arranque con sandbox.

Límites: no se ha demostrado una explotación; no se han probado otras
plataformas ni todos los perfiles AppArmor de Ubuntu. Los paquetes 1.0.1
requieren su verificación propia en T197.
