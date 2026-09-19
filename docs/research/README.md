# Investigación: sucesor de Teuton

Fase de investigación empírica sobre Teuton y Teuton GUI, previa a escribir
ningún código del motor nuevo. **No se ha modificado ninguno de los dos
repositorios originales.**

## Documentos

| Fichero | Contenido |
|---|---|
| [REPRODUCIR.md](REPRODUCIR.md) | Entorno, comandos y limitaciones. Todo lo demás sale de aquí |
| [CURRENT-BEHAVIOR.md](CURRENT-BEHAVIOR.md) | Arquitectura, CLI, DSL, ejecución local, SSH, evaluación, informes, concurrencia |
| [FAILURE-MODES.md](FAILURE-MODES.md) | 16 modos de fallo confirmados, ordenados por daño a la nota |
| [SECURITY.md](SECURITY.md) | Matriz de fuga de secretos por artefacto, inyección de comandos y CSV |
| [PERFORMANCE.md](PERFORMANCE.md) | Escalado por alumnos y por tamaño de salida, latencias de error |
| [GUI-CONTRACT.md](GUI-CONTRACT.md) | Los 11 puntos de acoplamiento y qué código de la GUI es andamio del motor |
| [KEEP-DROP-CHANGE.md](KEEP-DROP-CHANGE.md) | Conservar / eliminar / cambiar, y la taxonomía de estados |
| [PROPOSAL.md](PROPOSAL.md) | Contraste de la dirección preliminar, arquitectura, riesgos, primer prototipo |

`evidence/` contiene los proyectos de prueba, el `Containerfile` del laboratorio
SSH y las salidas representativas.

## Convención de marcas

Las tres cosas no se mezclan nunca:

- **[PRUEBA]** — confirmado ejecutando Teuton, con el proyecto que lo demuestra.
- **[CÓDIGO]** — inferido leyendo el código, sin prueba que lo aísle.
- **[PROPUESTA]** — decisión para el motor nuevo. Todo `PROPOSAL.md` lo es.

## Los cinco hallazgos que más pesan

1. **Un typo en el DSL borra la comprobación y encoge el denominador de la nota.**
   Peso 5 de 8 desaparecido, examen puntuado sobre 3, exit code 0. (F-02)
2. **Un alumno que revienta aborta la clase entera y no queda ningún informe.**
   (F-03)
3. **La propia concurrencia sin límite produce ceros:** 53 de 100 alumnos con un
   0 por conexiones rechazadas, contra el mismo servidor que atiende a 10 sin
   problema. (F-05)
4. **Un host `127.0.0.x` se evalúa en la máquina del profesor**, no en la del
   alumno, y el informe no avisa. (F-01)
5. **La nota depende del idioma del equipo del profesor:** 80 en español, 60 en
   inglés, mismo examen y mismo alumno. (F-08)

Todos siguen presentes en la v3.0.0 del repositorio.

## Estado de las suites

| Suite | Resultado |
|---|---|
| Teuton, tests rápidos | 96 en verde, 0,74 s |
| Teuton, todos | 164 en verde, 11,86 s |
| Teuton GUI, `typecheck` | limpio |
| Teuton GUI, unitarios | 192 en verde, 1,02 s |
| Teuton GUI, e2e (UAT hostil) | 40 en verde, 2 omitidos, ~60 s |
| Teuton GUI, `verify:parsing` contra 100 alumnos reales | 9 comprobaciones, todas correctas |
