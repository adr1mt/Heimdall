# Reproducir la segunda auditoría

Los programas de `evidence/` son diagnósticos, no código del producto.
La prueba Go lleva extensión `.go.txt` para que la suite ordinaria no la ejecute.
Su resultado rojo es intencional y demuestra R09. Las suites existentes pasan.

Todos los datos son ficticios. Los scripts usan `/tmp/heimdall-post-audit` y
rutas absolutas del equipo auditado; en otro equipo deben adaptarse. Los
resultados grandes y los perfiles temporales no se incorporan al repositorio.

## Preparación

Desde la raíz de Heimdall:

```bash
mkdir -p /tmp/heimdall-post-audit
cp docs/audits/2026-10-02/post/evidence/* /tmp/heimdall-post-audit/
GOCACHE=/tmp/heimdall-audit-gocache go build -o /tmp/heimdall-audit-engine ./cmd/heimdall
python3 /tmp/heimdall-post-audit/prepare.py
```

R01 y R02 requieren el contenedor `alu1` en `127.1.2.3:2201`. Ya estaba
levantado al empezar. En un entorno de desarrollo dedicado puede crearse con
`make lab`; ese comando reemplaza el contenedor del mismo nombre.

## R01: nota alterada por reintentos

```bash
python3 /tmp/heimdall-post-audit/retry-grade.py
```

El programa crea un fichero de nombre aleatorio dentro del contenedor y lo
elimina en `finally`. No cambia el examen entre vueltas. Usa `podman exec`
como el usuario ficticio `alumno` para cambiar ese único fichero. Se observa
FAIL → NOT_RUN → PASS y nota consolidada 100 donde correspondía 50.

## R03, R04, R06, R07 y R08

Desde `gui/`:

```bash
./node_modules/.bin/esbuild /tmp/heimdall-post-audit/node-probe.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-post-audit/node-probe.mjs
node /tmp/heimdall-post-audit/node-probe.mjs
./node_modules/.bin/esbuild /tmp/heimdall-post-audit/restore-probe.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-post-audit/restore-probe.mjs
node /tmp/heimdall-post-audit/restore-probe.mjs
```

Para una repetición limpia, borrar previamente solo las carpetas temporales
`history` y `data` bajo `/tmp/heimdall-post-audit`.

El primer programa fabrica 51 resultados válidos, cambia sus fechas de fichero
y hace una copia real. R50 depende de R0; los intermedios son independientes.
El segundo elimina **solo** `/tmp/heimdall-post-audit/history/var` y restaura
desde la copia. La cadena de dos eslabones ya no puede consolidarse.

La actualización recibe un HTTP 200 vacío simulado mediante `fetch`; el
descargador, el actualizador y el disco son reales. Solo se sustituye
`/tmp/heimdall-post-audit/working.AppImage`, creado por el diagnóstico.

## R02: cierre de la aplicación real

Compilar primero con `npm run build`. Desde `gui/`:

```bash
./node_modules/electron/dist/electron /tmp/heimdall-post-audit/close.cjs 1 --no-sandbox
./node_modules/electron/dist/electron /tmp/heimdall-post-audit/close.cjs 2 --no-sandbox
./node_modules/electron/dist/electron /tmp/heimdall-post-audit/close.cjs 3 --no-sandbox
```

El wrapper carga `gui/out/main/index.js` y sus manejadores reales de cierre.
Utiliza los perfiles temporales `close-1/profile`, `close-2/profile` y
`close-3/profile`, sin abrir el perfil del profesor. Tras el fin del alumno
rápido, intercepta un enlace ficticio para solicitar `app.quit()` sin abrir
un navegador. El segundo alumno sigue ejecutando `sleep`.

Después de salir, comprobar desde otro proceso `project/var`, `profile/copias`
y `engine-close.json`. En las tres ejecuciones originales: un resultado final,
cero copias y callback de cierre no recibido. Antes de repetir un número de
perfil hay que borrar solo su carpeta temporal para no contar resultados viejos.

## R05: resultado grande del motor

Ejecutar `python3 /tmp/heimdall-post-audit/large.py`. Genera un examen sin SSH
de 30 alumnos por 20 comprobaciones con respuestas de 20.000 bytes que JSON
expande. Puede usar varios cientos de MB temporalmente y escribe unos 73 MB.

Desde `gui/`:

```bash
./node_modules/.bin/esbuild /tmp/heimdall-post-audit/large-check.ts --bundle --platform=node --format=esm --outfile=/tmp/heimdall-post-audit/large-check.mjs
node /tmp/heimdall-post-audit/large-check.mjs
```

El motor devuelve 0; la GUI y la copia real rechazan el resultado.

## R09: vuelta perfecta con pérdida de precisión

Después de `prepare.py`, desde la raíz del repositorio:

```bash
python3 - <<'PY'
import json
from pathlib import Path
target = str(Path.cwd() / 'internal/model/post_audit_test.go')
replacement = '/tmp/heimdall-post-audit/model-probe_test.go.txt'
Path('/tmp/heimdall-post-audit/overlay.json').write_text(
    json.dumps({'Replace': {target: replacement}}))
PY
GOCACHE=/tmp/heimdall-audit-gocache go test -overlay=/tmp/heimdall-post-audit/overlay.json -run TestPostAudit -v ./internal/model
```

No se añade un fichero al producto. Se espera **FAIL**: la segunda vuelta es
perfecta, pero se conserva la primera y la sesión queda ACTIVE.

## R10 y R11: YAML ambiguo

```bash
python3 /tmp/heimdall-post-audit/yaml-probe.py
```

Las dos configuraciones ambiguas devuelven 0 en `check` y `run`; el identificador
duplicado termina sustituido por `replaced`.

## Suites y limitaciones

Se conservan logs de `make test`, SSH con carreras, tipos, 410 pruebas GUI,
editor, secretos/recuperación, npm y govulncheck. Vitest necesitó salir del
aislamiento: dentro fallaba la resolución de `localhost` antes de arrancar.

**No ejecutar `make gui-lab` y `make gui-editor` simultáneamente.** El segundo
arnés incluye la contraseña ficticia en su entorno y el detector global de
procesos del primero lo detecta. El fallo concurrente se conserva; al repetir
la aceptación de secretos por separado pasan las once comprobaciones.

Los límites adicionales, incluida la ausencia de una actualización desde una
release real y del examen real de aula, están declarados en el informe.

En los logs se normalizaron únicamente espacios finales y líneas vacías al
final del fichero; se conservan los mensajes y resultados observados.
