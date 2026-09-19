# ADR-0009 · Los secretos van por stdin y nunca al resultado

- Estado: **aceptada** · 2026-09-19
- Contexto: `SECURITY.md` §1-§3 y §6, `05-SECRETOS-TIMEOUTS-REINTENTOS.md` §1

## Contexto

Teuton vuelca el `config.yaml` entero en la cabecera de los cinco formatos de
informe, guarda el `command` literal, registra el comando completo en el log
ante un error SSH, y el salto por pasarela pone la contraseña en `argv`
(visible en el `ps` de cualquier usuario). Como la GUI empuja las credenciales
del aula a `global:`, la contraseña acaba en `resume.json`, el fichero que la
GUI lee siempre.

La GUI **ya tiene** un almacén cifrado (`safeStorage`, `default-globals.enc`).

## Decisión

1. Los secretos **no viven** en `examen.yaml` ni en `aula.yaml`. El inventario
   lleva referencias: `password_ref: "${AULA_PASSWORD}"`. Una contraseña literal
   es error de PLAN.
2. La GUI descifra en memoria y escribe un **sobre JSON de una línea en el stdin**
   del motor, que lo lee, lo guarda en memoria y cierra stdin
   (`--secrets=stdin`). Ni `argv`, ni fichero temporal.
3. Para uso CLI sin GUI, `--secrets=env` resuelve las referencias desde el
   entorno. Una referencia sin variable definida es error, no contraseña vacía.
4. Las referencias **solo** son válidas en los campos de autenticación del
   inventario. Un `${MAYUSCULAS}` en un comando o en un valor esperado es error
   de validación. Esa regla hace la garantía estructural: si un secreto no puede
   entrar en un comando, no puede salir en el resultado.
5. El artefacto guarda `"secret_ref": "${AULA_PASSWORD}"`, nunca el valor. Un
   filtro de redacción actúa como segunda línea de defensa, no como mecanismo
   principal.

## Consecuencias

- El motor y la GUI comparten un único almacén: el que la GUI ya tiene.
- `redact.ts` sale del camino crítico y se conserva solo para las IPs, que sí
  son legítimas en el informe y aun así no deben proyectarse en el aula.
- Si en el futuro el motor necesitara stdin para otra cosa, el sobre se mueve a
  un descriptor extra sin cambiar nada más.
