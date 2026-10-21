# ADR-0032 · Comprobaciones con `sudo`

- Estado: **aceptada** · 2026-10-21
- Amplía ADR-0009, ADR-0024 y `02-FORMATO.md`; tarea T189
- Contexto: exámenes de 0227 (Serveis en Xarxa) sobre Ubuntu 26.04 con Kea 3

## Contexto

Kea 3.0.3 en Ubuntu 26.04 deja `/etc/kea` en `750 _kea:_kea`: el usuario de la
conexión no puede leer `kea-dhcp4.conf`. `nft list ruleset` también exige root.
Los exámenes de 0227 lo resolvían con
`["bash", "-c", "printf '%s\n' usuario | sudo -S -p '' cat …"]`: funciona, pero
la contraseña de la clase queda escrita en el examen, que es justo lo que
prohíben el principio 8 y ADR-0009. Y depende de un shell en el comando.

## Decisión

1. **Clave `sudo: true`** en la comprobación o en `por_defecto:` (solo la
   heredan las que tienen `cmd:`; una puede decir `sudo: false`). Es un
   booleano; `sudo: true` sin `cmd:` y `sudo: true` en un host sin
   `password_ref` para algún alumno son errores de PLAN (exit 2).
2. **La contraseña es la del host**, el valor detrás de su `password_ref`, la
   misma con la que se abrió la sesión. No hay una segunda referencia: en el
   aula del instituto son la misma, y no hay caso de uso de otra.
3. **Ejecución.** Se envía, entrecomillado como siempre:

   ```
   sudo -S -p '' -- sh -c '<texto fijo>' heimdall-sudo [timeout … supervisor] <cmd…>
   ```

   La contraseña y un salto de línea van por la entrada estándar del canal
   SSH; nunca por `argv`. El texto fijo imprime en stderr un registro privado
   con nonce aleatorio y hace `exec "$@" </dev/null`: el comando del examen no
   puede leer la contraseña aunque sudo no la haya pedido. El supervisor de
   ADR-0024 va **dentro** de sudo, porque un `timeout` sin privilegios no puede
   matar un proceso de root. El artefacto muestra el `cmd` del examen.
4. **Clasificación.** Si vuelve un código de salida sin el registro, sudo no
   arrancó el comando: contraseña no aceptada, usuario sin sudo o máquina sin
   sudo (código 127). Es `UNEVALUATED` con causa `AUTH_FAILED` y un motivo que
   distingue «no está instalado sudo» de «no aceptó la contraseña o el usuario
   no puede usar sudo». Nunca `FAIL`: no se ha mirado nada del alumno
   (principio 3). La evidencia guarda lo que respondió sudo, sin código de
   salida y como ejecución no completa. No se vuelve a pedir sudo en ese host
   para ese alumno: la contraseña no cambiaría y se arriesga a bloquear la
   cuenta. La detección no lee los mensajes de sudo, que dependen del idioma
   (F-08).
5. Una vez arrancado el comando, todo es como sin sudo: su código de salida,
   su salida y sus tiempos son académicos o técnicos con las reglas de siempre.
6. **Hash del PLAN**: incluye `sudo` solo cuando es `true`; los PLAN anteriores
   conservan su hash y se pueden repetir.

No se añade una causa nueva: `AUTH_FAILED` ya significa «la máquina no aceptó
las credenciales», el contrato con la GUI y el esquema no cambian.

## Consecuencias

- Los exámenes dejan de llevar contraseñas y `bash -c`.
- Segunda excepción acotada a «sin shell» (arquitectura §7): el texto fijo de
  sudo, como el supervisor de ADR-0024. Los argumentos del examen siguen sin
  interpolarse en ningún programa.
- Si el usuario tiene `NOPASSWD`, la línea de la contraseña queda sin leer y se
  descarta; el comando no la ve.
- La redacción de secretos del escritor sigue como segunda defensa.
