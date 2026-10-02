# ADR-0027 · Presupuesto de evidencia del resultado

Estado: aceptada · Fecha: 2026-10-02

R05 produjo un resultado de 72 MiB que la GUI no podía abrir ni copiar. Se
conserva el contrato de 64 MiB y las notas completas en el mismo artefacto.

El PLAN admite hasta 2000 celdas (alumnos × comprobaciones) y 1 MiB de su
representación JSON sin respuestas de inventario. Esos límites se comprueban
antes de SSH y reservan espacio para metadatos, repetición de campos, mensajes,
fechas y expansión de redacciones. Los valores del inventario tienen además el
mismo máximo de 65536 bytes que los flujos SSH. El límite de lectura SSH y su
función en las aserciones se mantienen.

El escritor distribuye 16 MiB de JSON de evidencia entre stdout, stderr y
fragmento encontrado de todas las celdas, con máximo de 65536 bytes serializados
por campo. Cuenta la expansión JSON y corta en frontera UTF-8. La distribución
es igual para todos y no depende del orden de llegada. Las comparaciones y notas
se resuelven **antes** del recorte de persistencia; el recorte no se convierte
en un error técnico ni modifica PASS/FAIL. Los reintentos usan como máximo la
misma política aplicada al aula original para evitar ampliar su evidencia.

Los flujos recortados mantienen el total y señalan `truncated`; una aserción cuyo
fragmento o ubicación se recorta señala `evidence_truncated`. El resultado avisa
con `EVIDENCE_TRUNCATED` de que se ha guardado un extracto de la evidencia tras
compararla. Expectativas, pesos y estados se conservan. Los mensajes técnicos
se limitan a 1024 bytes serializados y los avisos a dos por celda más 16.

El escritor verifica también el tamaño final antes de publicar: un resultado
que incumpla el contrato se informa como error de escritura, nunca como éxito.
