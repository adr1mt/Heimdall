# ADR-0025 · Integridad en los límites de evidencia y peso

- Estado: **aceptada** · 2026-10-02
- Evidencia: auditoría A01, A02, A08 y A11 y sus regresiones.
- Amplía ADR-0015 y ADR-0006. Sustituye el criterio de elección y empate
  de ADR-0020 §1; el resto de la política de sesión se conserva.

Una salida conservada de 64 KiB no representa los bytes posteriores. Con un
flujo recortado, solo se decide cuando el prefijo demuestra el resultado:
`contiene` o `cerca_de` con coincidencia, y `no_contiene` con texto prohibido.
La ausencia sin prueba y `igual_a` quedan UNEVALUATED / OUTPUT_OVERFLOW con
explicación del recorte. `exit_code` utiliza la terminación confirmada y no
necesita el texto. El corte duro de 8 MiB mantiene su política anterior.

`no_contiene` solo aprueba con exit 0. Un comando inexistente o que no pudo
leer el fichero no demuestra la ausencia del texto. Sigue siendo un resultado
académico FAIL si terminó; `exit_code` permite exigir un código distinto de 0.

Los pesos deben ser finitos y no negativos; la suma del PLAN debe ser finita
y positiva. Toda comprobación UNEVALUATED con peso positivo impide una nota
final, por pequeño que sea ese peso. La tolerancia numérica solo limpia residuos
aritméticos cuando no queda ninguna comprobación con peso positivo pendiente.

La mejor vuelta completa se elige por el peso obtenido sin redondear. A empate
real vale la primera. FINISHED exige PASS en todas las comprobaciones de peso
positivo: un 99,6 % publicado como 100 todavía puede mejorar. Los pesos cero
siguen siendo diagnósticos.

La lectura del resultado comprueba el PLAN, las comprobaciones, sus evidencias,
los estados y la coherencia de los números antes de utilizar la nota. EXCLUDED
y RESTORED_FROM_BACKUP tienen excepciones explícitas. Es una defensa frente a
corrupción y omisiones, no una firma de autenticidad.
