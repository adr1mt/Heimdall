# Decisiones que siguen abiertas

Solo las que de verdad lo están. Las cerradas están en `docs/adr/`.

| # | Decisión | Por qué sigue abierta | Cuándo se puede cerrar |
|---|---|---|---|
| **D-5** | Detección de valores repetidos (anticopia) | Tiene valor pedagógico y hoy pone la nota a 0 automáticamente, cosa descartada. Falta decidir si se implementa como **marca** en el informe | Cuando haya un caso real; no bloquea nada |
| **D-8** | Escala y conversión de nota en la GUI | El motor publica 0-100 entero y los números crudos. Falta decidir **cómo presenta la GUI un `INCOMPLETE`** y qué acción ofrece al profesor | En **T053**, al construir la pantalla de resultados de Heimdall GUI |

## Lo que se ha cerrado en esta sesión y antes estaba abierto

- **D-9** (formato de los eventos NDJSON): cinco eventos por `stdout` con
  `--events=ndjson`, más el esquema del artefacto. ADR-0017.
- **La compatibilidad con Teuton**: retirada. Heimdall es independiente y tiene
  GUI propia sobre contrato nativo. ADR-0016, que sustituye a ADR-0008.
- **D-1** (cómo se paran los comandos que no terminan): envoltura con `timeout`
  de coreutils cuando el host lo tiene, `remote_process: UNKNOWN` cuando no.
  Ver `05-SECRETOS-TIMEOUTS-REINTENTOS.md` §3.
- **D-4** (dónde viven las credenciales): el almacén cifrado que la GUI ya
  tiene, entregadas por stdin. ADR-0009.
- **D-2** (SSH nativo o delegar en el binario `ssh`): nativo, con
  `x/crypto/ssh`. Medido con A-5, A-6 y A-11 sobre el laboratorio. ADR-0010.
- **D-6** (cuántos alumnos en paralelo): 16 por defecto, medido, y 4 aperturas
  por máquina de destino. ADR-0012 y ADR-0013.
- **D-3** (política de claves de host): la identidad se fija por ejecución y no
  se guarda entre exámenes. El alumnado usa máquinas virtuales desechables.
  ADR-0011.
- **El acantilado de expresividad del YAML**: medido contra dos exámenes reales.
  Dos primitivas nuevas y ningún scripting. ADR-0003.
