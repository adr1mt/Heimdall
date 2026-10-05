# T170 · Parciales sin preparación repetida

Base: `424bac4`. Caso sintético sin SSH de T166: 20 comprobaciones por alumno,
respuesta de 65536 bytes reutilizada en cada comprobación. Se ejecutó el mismo
arnés antes y después del cambio; tiempos de esta máquina, no referencia para
otros equipos.

| Alumnos | Versión | Tiempo de ejecución y guardado | Bytes publicados (parciales + final) | Máximo RSS |
|---:|---|---:|---:|---:|
| 30 | Antes | 2,34 s | 105103252 | 241744 KiB |
| 30 | Después | 0,87 s | 105102926 | 240920 KiB |
| 100 | Antes | 12,90 s | 421388863 | 809616 KiB |
| 100 | Después | 2,43 s | 421389714 | 811032 KiB |

Se siguen publicando 30 o 100 parciales atómicos, uno tras cada alumno, más
el resultado final. Los bytes varían ligeramente entre ejecuciones por los
tiempos registrados; el volumen publicado sigue siendo esencialmente igual.
Cada alumno terminado se redacta y recorta una vez; el resultado canónico se
serializa y publica entero en cada parcial. La caché del escritor contiene
solo copias derivadas de resultados terminados; el motor conserva el resultado
original y el final se prepara desde ese original.

La regresión `TestCachedPartialsMatchFullPreparation` compara, byte a byte,
parciales fuera de orden con la preparación completa anterior: secretos,
advertencias cambiantes, límites de evidencia y UTF-8. También pasaron las
pruebas de muerte por SIGKILL, secretos, presupuesto, escritura atómica y la
suite rápida `make check`.

Límite: estos casos no representan el uso medio; el PLAN seguía consumiendo
mucha memoria en esta medición y se trata en T171.
