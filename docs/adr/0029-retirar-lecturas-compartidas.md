# ADR-0029 · Retirar lecturas compartidas de ficheros

- Estado: **aceptada** · 2026-10-05
- Sustituye [ADR-0028](0028-lecturas-compartidas.md).
- Evidencia: [medición T175](../reviews/evidence/T175/RESULTADOS.md).

Adrià solicita retirar la opción `fichero`: declarar una fuente adicional en
cada comprobación añade complejidad de autoría que no compensa el ahorro
medido en el laboratorio local. La diferencia de medianas fue 0,065 s y
aproximadamente 1 MiB de RSS; el informe creció un 4,9 % y las copias no
mejoraron claramente. La reducción de operaciones SSH por sí sola no
justifica ampliar el formato y el formulario.

Se restaura el motor, el parser, el editor y sus pruebas al estado anterior a
T173. Las fuentes vuelven a ser `cmd` y `valor`; no se comparten lecturas ni
se transforma ningún comando automáticamente. Los exámenes que usaban
comandos mantienen su comportamiento. `fichero` vuelve a rechazarse como
clave desconocida, sin conectarse a máquinas ni cambiar exámenes del usuario.
No se introduce migración ni compatibilidad para la opción experimental.

Se retiran los arneses, fixtures y pruebas exclusivos de la función y sus
instrucciones de uso. Las medidas y capturas T173–T175 se conservan como
historia, claramente marcadas como retiradas. Los resultados JSON guardados
siguen usando el contrato actual y pueden consultarse normalmente.

Cualquier nueva optimización se valorará contra un problema real de aula y
su coste de uso. Esta retirada no implementa otra alternativa.
