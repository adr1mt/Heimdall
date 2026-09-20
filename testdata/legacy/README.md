# Informes reales de Teuton 2.10.6

Copia de `workspace/teuton-gui/tests/fixtures/teuton-2.10.6/full/`, capturada
el 2026-09-16 con `teuton run --export=json .` sobre tres alumnos ficticios
(Ana 100, Luis 100, Eva 50) y comprobaciones locales.

Son los *golden files* de `internal/legacy`: el escritor nuevo tiene que
producir los mismos valores en los campos que la GUI lee. Lo que Teuton
escribía y la GUI solo enseña —`expected`, `alterations`, las marcas de tiempo
y las duraciones— no se compara: su redacción es de Ruby, no del contrato.
