# T203 · Autoría del examen sin clase

2026-10-22. Base: `5258db16dc2d288dc5c43966e8eb0146c3dba7bb`.
Cambios y pruebas locales de T203; sin publicación ni instalación de paquetes.

## Problema y solución

El editor y su IPC exigían una clase para validar y guardar incluso un cambio
del nombre. Se añade `check --exam-only` al motor, compartiendo las reglas del
examen con el PLAN completo y la gramática de referencias con la sustitución.
La GUI lo usa sin consultar clases. Se mantiene la escritura atómica y las
versiones recuperables de fuentes.

También se reproduce que Inicio conserva el nombre antiguo en recientes
después de guardar el nuevo. La lista lee ahora el nombre del fichero actual;
si no puede leerlo conserva el nombre recordado y permite reabrir la carpeta.

## Evidencia por criterio

| Criterio | Resultado |
|---|---|
| Guardar/validar sin clase | CLI sin aula y con aula corrupta; IPC con clases corruptas; Electron con perfil nuevo y ninguna clase. |
| Preservar original y texto | Validar no escribe. Guardar y Ctrl+S conservan bytes y comentarios; el arnés comprueba copias anterior y propuesta. |
| Errores del examen | Pruebas de sintaxis, claves, IDs, hosts, pesos, aserciones y referencias, con fichero y línea. |
| Campos del alumnado pendientes | Valida `${alumno.campo_pendiente}` sin clase; PLAN completo sigue rechazando campos o direcciones ausentes. `sudo` se admite durante la autoría sin contraseña. |
| Alcance y fallos visibles | Mensaje explica la comprobación posterior de los datos de clase. Peso negativo impide sobrescribir y conserva el borrador. |
| Nombre en Inicio | Regresión fallida antes del arreglo y correcta después; captura y reapertura con el nombre nuevo. |

Las referencias se prueban en comando, valor, contiene, no_contiene, igual_a
y ambas partes textuales de cerca_de: campos pendientes, atributos válidos
de hosts, secretos, llaves sin cerrar, referencias incompletas, hosts ajenos y
atributos de host no permitidos. `check` ordinario conserva el PLAN completo;
`--exam-only` no emite hash de PLAN ni lee aulas ni escribe artefactos.

## Comprobaciones ejecutadas

- `GOCACHE=/tmp/heimdall-t203-go-cache make check build`: correcto.
- `GOCACHE=/tmp/heimdall-t203-go-cache go test -race ./internal/plan ./cmd/heimdall`: correcto.
- `make gui-check`: tipos y **582 pruebas** correctas.
- `make gui-build`: correcto; preload CommonJS con sandbox verificado.
- `make docs-check tools-check`: enlaces y 10 pruebas correctas.
- `git diff --check`: correcto.
- Arnés real: `gui/scripts/exam-authoring-lab.ts`, empaquetado con esbuild y
  ejecutado con Electron y `--no-sandbox`, salida 0:

```text
T203 OK: no classes; real engine validation; rename/save/reopen; Ctrl+S; exact comments; retained versions; invalid draft preserved; corrupt classes ignored. Fictional data only.
```

El arnés usa perfil temporal, examen ficticio y motor compilado actual; sin
SSH ni datos reales. Comprueba UI, preload, IPC, motor y disco. La primera
ejecución descubre el nombre obsoleto de Inicio; otra detecta una carrera del
propio arnés al navegar antes de terminar Abrir. Se corrigen la lectura del
nombre y la espera de la apertura; la última ejecución pasa completa.

El aislamiento del entorno impide procesos locales de algunas pruebas
(`EPERM`/timeout) y el arranque Electron. Los mismos controles pasan fuera de
ese aislamiento, sin debilitar pruebas. El caché Go se redirige a `/tmp` porque
el predeterminado se monta de solo lectura. No es una validación nueva del
sandbox del paquete ni de una publicación; tampoco se prueba aula real.

## Capturas

- [Guardar sin clase](guardado-sin-clase.png)
- [Error del examen sin sobrescribir](error-sin-clase.png)
- [Inicio con el nombre nuevo](inicio-renombrado.png)
