# T206 · Pesos de opciones DHCP y retirada del registro

27 de octubre de 2026. Base/head anteriores: commit T205 `8c11e2b`, SHA completo
en TASKS.json. Revisión que incluye cambios locales del examen, su tabla privada,
documentación de laboratorio y estado de proyecto.

Petición del profesor: peso 2 para «Porta d'enllaç DHCP» (`kea-porta-enllac`) y
«DNS DHCP» (`kea-dns`); eliminar «Concessió DHCP del client» (`client-concessio`,
peso anterior 3). Se elimina también el grupo Client al quedar vacío.

Resultado: **22 comprobaciones, peso total 26** (27 + 1 + 1 - 3). No se cambia
ningún otro criterio, descripción, peso, orden, argumento o revisión del programa.
No se evalúa el cliente ni se consulta el registro de concesiones en este examen.

Verificación: comparación estructural exacta antes/después; validación nativa
`check --exam-only`; [PLAN ficticio](plan.txt) de 22 criterios/peso 26, sin SSH;
`make check`, `make docs-check tools-check` y `git diff --check` correctos.
[Instalación local](instalacion-local.json): copia cargada idéntica a la mantenida,
con original y propuesta verificados en las versiones recuperables nativas.

No cambia el motor ni la aplicación. No se repite el laboratorio de T204 porque
solo se modifican la selección declarativa y dos pesos. No se evalúa alumnado,
no se modifican notas/clases y no se cambia el enunciado del material.
