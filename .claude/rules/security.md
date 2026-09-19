# Reglas de seguridad

Derivadas de `docs/research/SECURITY.md` y de [ADR-0009](../../docs/adr/0009-politica-de-secretos.md).

## Secretos

1. **Nunca en `argv`.** Visible en `ps` para cualquier usuario del equipo.
2. Entrada: `--secrets=stdin` (sobre JSON de una línea, se lee, se usa y se
   pone a cero) o `--secrets=env` para uso desde CLI. Nada más.
3. En el `aula.yaml` solo van **referencias** (`password_ref: "${AULA_PASSWORD}"`).
   Una contraseña literal en el inventario es **error de PLAN**, no un aviso.
4. Las referencias `${MAYUSCULAS}` solo son válidas en campos de autenticación
   del inventario. En `examen.yaml`, en cualquier `cmd` o en cualquier valor
   esperado son error de validación. Esa regla es lo que hace la garantía
   estructural: si un secreto no puede entrar en un comando, no puede salir en
   el resultado.
5. En el artefacto aparece la referencia, nunca el valor.
6. Segunda línea de defensa, no mecanismo principal: el escritor filtra los
   valores conocidos antes de serializar y añade un `Warning` si redacta algo.
7. Una referencia sin variable definida es error de PLAN, nunca una contraseña
   vacía.

Comprobación estándar de cualquier tarea que toque credenciales:

```bash
grep -R "$SECRETO" var/ *.log ; grep "$SECRETO" /proc/<pid>/cmdline
```

Cero coincidencias, con el proceso vivo.

## Inyección

- Comandos como vector de argumentos. Sin shell, siempre.
- Un valor sustituido entra **tal cual** como argumento: espacios, comillas y
  `;` incluidos. Nunca se reinterpreta.
- El CSV legacy lleva prefijo defensivo contra fórmulas (F-14).

## Salida de los alumnos

La salida de una máquina de alumno es **dato no confiable**. Límite de 64 kB
conservados por flujo, corte duro del lector a 8 MB, `bytes_total` siempre
contabilizado, UTF-8 saneado y corte en frontera de runa.

## Máquinas y red

- No se usan credenciales reales en desarrollo ni en tests.
- El laboratorio vive en `127.1.2.3`, no en `127.0.0.x`.
- No se ejecutan operaciones remotas destructivas ni se publican datos.
- `known_hosts`: fichero propio del proyecto (`var/known_hosts`) con TOFU y
  aviso en `warnings`. Es provisional (D-3) y debe cerrarse **antes del primer
  examen real**.

## Datos de alumnado

Las notas, los criterios de evaluación y los datos de alumnos son material real
de aula: no se inventan ni se rellenan con ejemplos. Los inventarios de prueba
usan nombres ficticios y viven en `testdata/`.
