# Cómo reproducir los diagnósticos

Estos programas **verifican que los defectos existen** en el commit auditado.
Un resultado PASS aquí es una reproducción, no una certificación de calidad.
Al corregir los defectos, deben convertirse en regresiones que comprueben el
comportamiento correcto.

Todos los datos y contraseñas incluidos son ficticios. Los diagnósticos Go
usan un servidor SSH local generado por la propia prueba; no requieren
contenedores ni conexiones a máquinas del alumnado.

## Diagnósticos Go

Desde la raíz del repositorio, en una sesión sin otra prueba compilando esos
paquetes, copiar los dos archivos de texto a sus paquetes correspondientes,
ejecutar solo `TestAudit` y retirar los archivos temporales:

```bash
test ! -e internal/ssh/audit_probe_test.go || exit 1
test ! -e internal/model/audit_probe_test.go || exit 1
cp docs/audits/2026-10-02/evidence/ssh_probe_test.go.txt internal/ssh/audit_probe_test.go
cp docs/audits/2026-10-02/evidence/model_probe_test.go.txt internal/model/audit_probe_test.go
trap 'rm -f internal/ssh/audit_probe_test.go internal/model/audit_probe_test.go' EXIT
go test -race -count=1 -run TestAudit -v ./internal/ssh ./internal/model
```

Cubren A01, A03, A04, A08, el caso de peso pequeño de A11 y A12. Los registros
de la ejecución realizada son `ssh-probes.log` y `model-probes.log`.

## Diagnósticos de lógica de la GUI

Los archivos TypeScript conservan las rutas del entorno auditado. Para usar
otro checkout, adaptar ese prefijo y la ubicación del fixture, sin cambiar las
expectativas del diagnóstico. Utilizan dependencias existentes del proyecto.

Desde `gui/`:

```bash
node_modules/.bin/esbuild ../docs/audits/2026-10-02/evidence/gui-probe.ts \
  --bundle --platform=node --format=esm --outfile=/tmp/heimdall-gui-audit.mjs
node /tmp/heimdall-gui-audit.mjs
```

Se crean directorios nuevos en `/tmp`; no se toca el almacén real del profesor.
Cubre A05, A07, A09, A10, A13, A17 y A18. La consulta del actualizador usa
proveedores ficticios: no descarga ni instala una actualización. El registro
realizado es `gui-probes.log`.

## Reproducción del editor en Electron

Requiere compilar primero la GUI y tener el motor de auditoría en
`/tmp/heimdall-audit/heimdall`, o adaptar su ruta en el diagnóstico. Desde la raíz:

```bash
mkdir -p /tmp/heimdall-audit
go build -ldflags '-X main.version=0.9.0' -o /tmp/heimdall-audit/heimdall ./cmd/heimdall
```

Desde `gui/`:

```bash
npm run build
node_modules/.bin/esbuild ../docs/audits/2026-10-02/evidence/electron-probe.ts \
  --bundle --platform=node --format=esm --external:electron \
  --outfile=/tmp/heimdall-editor-audit.mjs
node_modules/electron/dist/electron /tmp/heimdall-editor-audit.mjs \
  --no-sandbox --password-store=basic
```

Abre una ventana temporal con un perfil y una clase ficticios, escribe un
borrador inválido y pulsa Guardar. Cubre A06 y comprueba que el proveedor básico
no guarda la contraseña en la versión efectiva de Electron. Las capturas se
escriben en `/tmp/heimdall-audit`, y el perfil en un directorio temporal nuevo.
No se ejecuta la corrección del alumno ficticio.

`electron-probes.log` contiene la observación ejecutada. Las tres capturas
adjuntas corresponden a esa reproducción y solo incluyen contenido ficticio.

## Evidencia SSH real y aceptación

`ssh-results.json` resume artefactos producidos por el motor contra `alu1` en
`127.1.2.3:2201`: contiene las comprobaciones de A01, A02, A03 y A14. La
observación de A14 incluyó comprobar, con `pgrep` dentro del contenedor, que
`sleep 11` seguía vivo inmediatamente después de cancelar.

`acceptance.log` es la salida de `make test` con los laboratorios principal y
RA2 levantados. `package.log` es la aceptación del paquete existente, no una
recompilación de distribución. `coverage.log` y `race.log` pertenecen a la
suite rápida sin etiquetas de integración. `integration.log` pertenece a la
ejecución adicional con dichas etiquetas.
