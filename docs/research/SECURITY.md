# Seguridad: dónde acaban los secretos

Método: un proyecto (`c11-secrets`) con cuatro secretos ficticios distintos, uno
por vía de entrada, y búsqueda automatizada (`grep -rn TEUTON_SECRET`) sobre
todo lo que Teuton escribe y sobre la terminal.

| Marcador | Entra por |
|---|---|
| `TEUTON_SECRET_GLOBAL_12345` | `global:` del `config.yaml` (`admin_token`) |
| `TEUTON_SECRET_TEST_12345` | `host1_password` de un caso |
| `TEUTON_SECRET_DB_12345` | `db_password` de un caso |
| `TEUTON_SECRET_INLINE_12345` | interpolado en un comando del `start.rb` |
| `TEUTON_SECRET_STDOUT_12345` | salida del comando remoto |

No se usó ninguna credencial real.

---

## 1. Matriz de fuga **[PRUEBA]**

Número de apariciones por artefacto:

| Artefacto | pw del alumno | secreto global | comando | stdout |
|---|---|---|---|---|
| `case-01.txt` | 1 | 1 | 2 | 2 |
| `case-01.json` | 1 | 1 | 1 | 1 |
| `case-01.yaml` | 1 | 1 | 2 | 2 |
| `case-01.html` | 1 | 1 | 2 | 2 |
| `case-01.xml` | 1 | 1 | 1 | 1 |
| `resume.txt` | - | 1 | - | - |
| `resume.json` | - | 1 | - | - |
| `resume.yaml` | - | 1 | - | - |
| `resume.html` | - | 1 | - | - |
| `moodle.csv` | - | - | - | - |
| **terminal (stdout de `teuton run`)** | - | - | - | - |

Lectura:

- **Los cinco formatos de detalle vuelcan el `config.yaml` entero**, contraseñas
  incluidas, en una sección de cabecera. No hay lista de campos sensibles ni
  filtro de ningún tipo.
- **`command` se guarda literal** en los cinco. Cualquier contraseña interpolada
  en un comando (`mysql -p...`, `sshpass -p...`) queda escrita.
- **El `output` guardado es solo la primera línea** (o `"(N lines)"`), así que la
  fuga por stdout remoto es parcial — por accidente, no por diseño.
- **`resume.*` filtra los globales pero no los del caso.** Como la GUI empuja las
  credenciales compartidas del aula a `global:` (`host1_username`/`host1_password`
  como ajuste de la app), en el uso real **la contraseña del aula acaba en
  `resume.json`**, que es el fichero que la GUI lee siempre.
- **La terminal está limpia** con la configuración por defecto: `show` solo
  imprime la tabla de notas.

## 2. Salvedad importante sobre la terminal **[CÓDIGO]**

La terminal deja de estar limpia en cuanto hay un error SSH.
`execute_ssh.rb:86` registra:

```ruby
log("[#{e.class}] SSH on <#{username}@#{ip}> exec: #{action[:command]}", :error)
```

Es decir: usuario, IP y **el comando completo**. Si el comando lleva una
contraseña interpolada, va al log — y el log va tanto a la terminal como al array
`logs` del `case-NN.json`. **[PRUEBA]** `s03-sshfail` y `s06-drop` contienen
exactamente esas líneas.

## 3. `sshpass` en la línea de órdenes **[CÓDIGO]**

El salto por pasarela construye
`"sshpass -p #{password2} #{username2}@#{ip2} #{command2}"`
(`execute_ssh.rb:33`). La contraseña viaja en `argv`, visible en el `ps` de
cualquier usuario del equipo mientras dure el proceso. No se pudo probar porque
ese camino además está roto (falta el binario `ssh` tras `sshpass`), pero la
construcción de la cadena es inequívoca.

## 4. Inyección de comandos **[PRUEBA]**

`c03-shell`. Un valor del `config.yaml`:

```yaml
user_input: "pepe; touch /tmp/TEUTON_INJECTED_PWNED"
```

interpolado en `run "echo usuario_" + _user_input` creó
`/tmp/TEUTON_INJECTED_PWNED` **en la máquina del profesor**.

No hay `Shellwords` en todo el repositorio. El vector es real, no teórico: el
`config.yaml` se rellena a partir de listas de clase importadas, y el `start.rb`
puede venir de un compañero o de un repositorio de ejercicios.

Alcance: el `start.rb` ya es Ruby sin sandbox, así que quien lo escribe tiene
control total de todos modos. Lo que añade la inyección es que **el `config.yaml`
— que se percibe como datos — también es ejecutable**.

## 5. Inyección CSV **[PRUEBA]**

`c12-csv`. `tt_moodle_id: "=cmd|' /C calc'!A1"` sale sin comillas ni escape en
`moodle.csv`. Ver F-14.

## 6. Lo que esto implica para el motor nuevo

Los secretos no se filtran por descuido puntual: se filtran porque **el informe
serializa la configuración completa y el comando literal**. Cualquier rediseño
que mantenga «volcar el config en la cabecera del informe» reproducirá el
problema.

Tres reglas que se deducen de la evidencia, no de la teoría:

1. **Los secretos no viven en el fichero de configuración del examen.** Se
   resuelven desde el entorno o un almacén aparte, y en el informe aparece la
   referencia (`${AULA_PASSWORD}`), nunca el valor.
2. **El comando que se guarda es el comando con los secretos ya sustituidos por
   marcadores**, y la sustitución la hace quien lo construye, no un filtro
   posterior por heurística.
3. **Los argumentos se pasan como vector, no como cadena.** Elimina de golpe la
   inyección (§4), la inconsistencia de exit codes (F-09) y la dependencia del
   shell.

La GUI ya tiene un `redact.ts` (modo proyector) que tapa IPs y contraseñas
buscando los valores literales del config. Con el motor nuevo ese módulo debería
poder desaparecer del camino crítico: si el informe no lleva el secreto, no hay
nada que tapar. Conviene conservarlo para las IPs, que sí son legítimas en el
informe y aun así no deben proyectarse en el aula.
