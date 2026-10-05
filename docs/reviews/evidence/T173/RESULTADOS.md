# T173 · Lecturas compartidas

Caso y decisiones: [ADR-0028](../../../adr/0028-lecturas-compartidas.md).

## Verificación

- `GOCACHE=/tmp/heimdall-plan-go-cache make check`: correcto.
- `GOCACHE=/tmp/heimdall-plan-go-cache go test -race ./...`: correcto.
- `make docs-check tools-check` y `git diff --check`: correctos.
- Pruebas nuevas: validación de fuentes, null/vacío, rutas, NUL, sustitución
  literal y secretos; timeout tras sustitución; huella y compatibilidad.
- Motor: 15 notas independientes, separación por alumno/host/ruta, comandos
  intermedios, copia de contenedores mutables, fallos completos con salida
  parcial, problemas de conexión/autenticación/tiempo, recorte y corte duro,
  cancelación/presupuesto, reintentos selectivos y capturas frescas entre vueltas.

Una primera ejecución detectó que los indicadores internos de presencia YAML
alteraban la comparación de estructuras de un examen antiguo. Se limitaron a
la nueva fuente; la regresión original pasa sin debilitarla. La comprobación
de huellas antiguas sigue pasando.

## Límites

Estas pruebas son rápidas y con transporte simulado. La evidencia SSH real y
las mediciones de Kea se registran por separado en T175. El JSON mantiene
la evidencia por requisito; no se promete una reducción del tamaño en disco.
