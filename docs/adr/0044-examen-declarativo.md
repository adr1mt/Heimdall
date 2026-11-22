# ADR-0044 · Exámenes declarativos

Aceptada el 22 de noviembre de 2026. Sustituye ADR-0036 y ADR-0043.

Cada comprobación compara la salida de un comando en la máquina evaluada
o un valor del inventario con la aserción del YAML. El profesor define en
ese fichero los criterios, las respuestas y los pesos. Se retiran el campo
`checker`, los perfiles instalables y los materiales de RA1 del producto.
Los exámenes que usan una clave desconocida fallan durante la validación.
