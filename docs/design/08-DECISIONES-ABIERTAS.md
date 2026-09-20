# Decisiones que siguen abiertas

Solo las que de verdad lo están. Las cerradas están en `docs/adr/`.

| # | Decisión | Por qué sigue abierta | Cuándo se puede cerrar |
|---|---|---|---|
| **D-5** | Detección de valores repetidos (anticopia) | Tiene valor pedagógico y hoy pone la nota a 0 automáticamente, cosa descartada. Falta decidir si se implementa como **marca** en el informe | Cuando haya un caso real; no bloquea nada |
| **D-6** | Número de alumnos en paralelo | El mecanismo y el tope por máquina están cerrados y medidos (ADR-0012: 4 aperturas por destino, cero rechazos con 100 alumnos). Falta medir el tope **global**, hoy 8 por conjetura | Con las mediciones de 10/30/100 alumnos y de memoria (T031) |
| **D-7** | Nombre del producto | Provisional `Evalon`. Afecta al módulo Go, al binario y al README | Antes del primer binario que salga del equipo |
| **D-8** | Escala y conversión de nota en la GUI | El motor publica 0-100 entero y los números crudos. Falta decidir **cómo presenta la GUI un `INCOMPLETE`** y qué acción ofrece al profesor | Al adaptar la GUI, después del prototipo |
| **D-9** | Formato definitivo de los eventos NDJSON | Deliberadamente aplazado: primero el escritor legacy. El modelo canónico ya fija qué información existe | Cuando la UAT pase con el motor nuevo |

## Lo que se ha cerrado en esta sesión y antes estaba abierto

- **D-1** (cómo se paran los comandos que no terminan): envoltura con `timeout`
  de coreutils cuando el host lo tiene, `remote_process: UNKNOWN` cuando no.
  Ver `05-SECRETOS-TIMEOUTS-REINTENTOS.md` §3.
- **D-4** (dónde viven las credenciales): el almacén cifrado que la GUI ya
  tiene, entregadas por stdin. ADR-0009.
- **D-2** (SSH nativo o delegar en el binario `ssh`): nativo, con
  `x/crypto/ssh`. Medido con A-5, A-6 y A-11 sobre el laboratorio. ADR-0010.
- **D-3** (política de claves de host): la identidad se fija por ejecución y no
  se guarda entre exámenes. El alumnado usa máquinas virtuales desechables.
  ADR-0011.
- **El acantilado de expresividad del YAML**: medido contra dos exámenes reales.
  Dos primitivas nuevas y ningún scripting. ADR-0003.
